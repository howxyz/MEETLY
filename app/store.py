"""Meeting records. Firestore on Google Cloud, JSON files on disk when running locally.

A meeting looks like:
{
  "id", "owner", "title", "date", "attendees": [...], "send_email": bool,
  "source": {"type": "upload"|"drive", "ref": "<object name or link>"},
  "status": "queued"|"downloading"|"transcribing"|"analyzing"|"emailing"|"done"|"error",
  "log": [...], "error": str|None,
  "transcript": str, "analysis": dict, "summary_md": str,
  "duration_sec": float, "emails_sent": int, "created_at": iso, "updated_at": iso
}
"""
import json
import threading
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from . import config

LIGHT_FIELDS = ("id", "owner", "title", "date", "attendees", "status", "error", "created_at",
                "duration_sec", "emails_sent")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def light(m: dict) -> dict:
    """The meeting without the big fields (for lists)."""
    return {k: m.get(k) for k in LIGHT_FIELDS}


def can_access(m: dict, email: str) -> bool:
    email = (email or "").lower()
    return bool(m) and (m.get("owner") == email or email in (m.get("attendees") or []))


# ============================================================
# Local (JSON files)
# ============================================================

class LocalStore:
    def __init__(self):
        self.dir = config.DATA_DIR / "meetings"
        self.dir.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()

    def _path(self, mid):
        return self.dir / f"{mid}.json"

    def create(self, data: dict) -> dict:
        data = {**data, "id": uuid.uuid4().hex[:12], "created_at": now_iso(), "updated_at": now_iso()}
        self._write(data)
        return data

    def _write(self, data):
        with self.lock:
            tmp = self._path(data["id"]).with_suffix(".tmp")
            tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            tmp.replace(self._path(data["id"]))

    def get(self, mid: str) -> Optional[dict]:
        p = self._path(mid)
        if not p.exists() or not mid.isalnum():
            return None
        return json.loads(p.read_text(encoding="utf-8"))

    def update(self, mid: str, **fields) -> dict:
        m = self.get(mid)
        m.update(fields, updated_at=now_iso())
        self._write(m)
        return m

    def add_log(self, mid: str, line: str):
        m = self.get(mid)
        self.update(mid, log=(m.get("log") or []) + [line])

    def delete(self, mid: str):
        self._path(mid).unlink(missing_ok=True)

    def _all(self):
        return [json.loads(p.read_text(encoding="utf-8")) for p in self.dir.glob("*.json")]

    def list_for(self, email: str) -> List[dict]:
        rows = [m for m in self._all() if can_access(m, email)]
        return sorted(rows, key=lambda m: m.get("created_at", ""), reverse=True)

    def count_created_since(self, owner: str, since_iso: str) -> int:
        return sum(1 for m in self._all() if m.get("owner") == owner and m.get("created_at", "") >= since_iso)

    # --- users ---
    def _user_path(self, email):
        d = config.DATA_DIR / "users"
        d.mkdir(parents=True, exist_ok=True)
        return d / (uuid.uuid5(uuid.NAMESPACE_URL, email).hex + ".json")

    def get_user(self, email: str) -> Optional[dict]:
        p = self._user_path(email)
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None

    def save_user(self, email: str, **fields) -> dict:
        u = self.get_user(email) or {"email": email, "created_at": now_iso()}
        u.update(fields, updated_at=now_iso())
        with self.lock:
            self._user_path(email).write_text(json.dumps(u, ensure_ascii=False), encoding="utf-8")
        return u


# ============================================================
# Firestore
# ============================================================

class FirestoreStore:
    def __init__(self):
        from google.cloud import firestore
        self.firestore = firestore
        db = firestore.Client(project=config.GCP_PROJECT)
        self.col = db.collection("meetings")
        self.users = db.collection("users")

    def get_user(self, email: str) -> Optional[dict]:
        snap = self.users.document(email).get()
        return snap.to_dict() if snap.exists else None

    def save_user(self, email: str, **fields) -> dict:
        ref = self.users.document(email)
        if not ref.get().exists:
            ref.set({"email": email, "created_at": now_iso()})
        ref.update({**fields, "updated_at": now_iso()})
        return ref.get().to_dict()

    def create(self, data: dict) -> dict:
        ref = self.col.document()
        data = {**data, "id": ref.id, "created_at": now_iso(), "updated_at": now_iso()}
        ref.set(data)
        return data

    def get(self, mid: str) -> Optional[dict]:
        snap = self.col.document(mid).get()
        return snap.to_dict() if snap.exists else None

    def update(self, mid: str, **fields) -> dict:
        self.col.document(mid).update({**fields, "updated_at": now_iso()})
        return self.get(mid)

    def add_log(self, mid: str, line: str):
        self.col.document(mid).update({"log": self.firestore.ArrayUnion([line]), "updated_at": now_iso()})

    def delete(self, mid: str):
        self.col.document(mid).delete()

    def list_for(self, email: str) -> List[dict]:
        email = email.lower()
        rows: Dict[str, dict] = {}
        for q in (self.col.where("owner", "==", email), self.col.where("attendees", "array_contains", email)):
            for snap in q.stream():
                rows[snap.id] = snap.to_dict()
        return sorted(rows.values(), key=lambda m: m.get("created_at", ""), reverse=True)

    def count_created_since(self, owner: str, since_iso: str) -> int:
        # filtered in Python so no composite Firestore index is needed
        return sum(1 for s in self.col.where("owner", "==", owner).stream()
                   if (s.to_dict().get("created_at") or "") >= since_iso)


_store = None


def get_store():
    global _store
    if _store is None:
        _store = FirestoreStore() if config.USE_GCP else LocalStore()
    return _store


def created_today(owner: str) -> int:
    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    return get_store().count_created_since(owner, since)
