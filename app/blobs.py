"""Where uploaded videos live until they are processed.

Google Cloud: the browser uploads the video STRAIGHT to Cloud Storage with a signed URL
(Cloud Run can't receive big uploads), then the worker downloads it.
Local / Colab: the browser uploads to the FastAPI server, which saves it on disk.
"""
import shutil
import uuid
from datetime import timedelta
from pathlib import Path

from . import config

ALLOWED_EXT = {".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi", ".mp3", ".m4a", ".wav", ".ogg", ".aac"}


def new_object_name(owner: str, filename: str) -> str:
    ext = Path(filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise ValueError(f"Unsupported file type: {ext or 'unknown'}")
    safe_owner = "".join(c if c.isalnum() else "_" for c in owner)
    return f"uploads/{safe_owner}/{uuid.uuid4().hex}{ext}"


def local_path(object_name: str) -> Path:
    if ".." in object_name or object_name.startswith("/"):
        raise ValueError("bad path")
    p = (config.DATA_DIR / object_name).resolve()
    if not str(p).startswith(str(config.DATA_DIR.resolve())):
        raise ValueError("bad path")
    return p


# ---------------- Cloud Storage ----------------

def _bucket():
    from google.cloud import storage
    return storage.Client(project=config.GCP_PROJECT).bucket(config.GCS_BUCKET)


def signed_upload_url(object_name: str, content_type: str) -> str:
    import google.auth
    from google.auth.transport import requests as greq
    creds, _ = google.auth.default()
    creds.refresh(greq.Request())
    blob = _bucket().blob(object_name)
    kwargs = dict(version="v4", expiration=timedelta(hours=3), method="PUT", content_type=content_type)
    if hasattr(creds, "service_account_email") and getattr(creds, "token", None):
        # On Cloud Run there's no private key file: sign through the IAM API instead.
        kwargs.update(service_account_email=creds.service_account_email, access_token=creds.token)
    return blob.generate_signed_url(**kwargs)


# ---------------- Both ----------------

def exists(object_name: str) -> bool:
    if config.USE_GCP:
        return _bucket().blob(object_name).exists()
    return local_path(object_name).exists()


def download_to(object_name: str, dest: Path) -> Path:
    if config.USE_GCP:
        _bucket().blob(object_name).download_to_filename(str(dest))
    else:
        shutil.copyfile(local_path(object_name), dest)
    return dest


def delete(object_name: str):
    try:
        if config.USE_GCP:
            _bucket().blob(object_name).delete()
        else:
            local_path(object_name).unlink(missing_ok=True)
    except Exception:
        pass
