"""The web server: pages, Google sign-in, and the JSON API used by the frontend.

Run locally:  uvicorn app.main:app --reload
"""
import re
from pathlib import Path
from typing import List, Literal, Optional

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, PlainTextResponse, RedirectResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool
from urllib.parse import quote
from pydantic import BaseModel, Field
from starlette.middleware.sessions import SessionMiddleware

from . import ai, blobs, config, mailer, pdf, worker
from .store import can_access, created_today, get_store, light, now_iso

# The website's pages: the Next.js app in web/, built to plain files in web/out (see README).
WEB = Path(__file__).resolve().parent.parent / "web" / "out"
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

app = FastAPI(title="Meeting Assistant", docs_url=None, redoc_url=None)
app.add_middleware(
    SessionMiddleware, secret_key=config.SESSION_SECRET, same_site="lax",
    https_only=config.APP_URL.startswith("https"), max_age=60 * 60 * 24 * 14,
)
if (WEB / "_next").is_dir():
    app.mount("/_next", StaticFiles(directory=WEB / "_next"), name="next")   # scripts, styles, fonts (hashed names)


# ============================================================
# Auth
# ============================================================

oauth = None
if config.GOOGLE_CLIENT_ID and config.GOOGLE_CLIENT_SECRET:
    from authlib.integrations.starlette_client import OAuth
    oauth = OAuth()
    oauth.register(
        "google",
        client_id=config.GOOGLE_CLIENT_ID,
        client_secret=config.GOOGLE_CLIENT_SECRET,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )


def current_user(request: Request) -> dict:
    user = request.session.get("user")
    if not user:
        raise HTTPException(401, "Not signed in")
    return user


def safe_next(url: Optional[str]) -> str:
    """Only our own pages (e.g. /chat?m=...), never another site."""
    url = (url or "").strip()
    return url if url.startswith("/") and not url.startswith("//") and "\\" not in url else ""


@app.get("/auth/login")
async def login(request: Request, next: str = "", hint: str = ""):
    if not oauth:
        raise HTTPException(500, "Google sign-in is not configured on this server.")
    if safe_next(next):
        request.session["next"] = safe_next(next)   # e.g. the chat link from the email
    extra = {"login_hint": hint} if EMAIL_RE.match(hint or "") else {}
    return await oauth.google.authorize_redirect(
        request, f"{config.APP_URL}/auth/callback", prompt="select_account", **extra)


@app.get("/auth/callback")
async def auth_callback(request: Request):
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception:
        return RedirectResponse("/login?error=1")
    info = token.get("userinfo") or {}
    email = (info.get("email") or "").lower()
    if not email or not info.get("email_verified", True):
        return RedirectResponse("/login?error=1")

    request.session["user"] = {"email": email, "name": info.get("name") or email, "picture": info.get("picture")}
    get_store().save_user(email, name=info.get("name"), picture=info.get("picture"), last_login=now_iso())
    return RedirectResponse(safe_next(request.session.pop("next", "")) or "/meetings")


class DevLogin(BaseModel):
    email: str


@app.post("/auth/dev")
async def dev_login(body: DevLogin, request: Request):
    """Testing only (DEV_LOGIN=1): sign in by typing an email. Disabled in production."""
    if not config.DEV_LOGIN or oauth:   # once Google sign-in is set up, it is the only way in
        raise HTTPException(404)
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Invalid email")
    request.session["user"] = {"email": email, "name": email.split("@")[0], "picture": None}
    get_store().save_user(email, name=email.split("@")[0], last_login=now_iso())
    return {"ok": True}


@app.get("/auth/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse("/")


@app.get("/api/me")
async def me(request: Request):
    user = request.session.get("user")
    return {
        "user": user,
        "google_login": bool(oauth),
        "dev_login": config.DEV_LOGIN and not oauth,
        "email_enabled": mailer.is_configured(),
        "site_email": config.SMTP_USER.lower() if config.SMTP_USER else "",
        "limits": {"max_minutes": config.MAX_VIDEO_MINUTES, "per_day": config.MAX_MEETINGS_PER_DAY,
                   "max_attendees": config.MAX_ATTENDEES},
    }


# ============================================================
# Pages
# ============================================================

def _page(name: str, request: Request, need_login: bool = True):
    if need_login and not request.session.get("user"):
        # remember where they were going (e.g. the chatbot link in the email) and come back after signing in
        here = request.url.path + (f"?{request.url.query}" if request.url.query else "")
        hint = request.query_params.get("hint", "")
        return RedirectResponse(f"/login?next={quote(here, safe='')}" + (f"&hint={quote(hint)}" if hint else ""))
    if not (WEB / name).exists():
        return PlainTextResponse("The website files are missing: build them with `cd web && npm install && npm run build` "
                                 "(or copy the web/out folder from the zip).", status_code=500)
    return FileResponse(WEB / name, headers={"Cache-Control": "no-cache"})   # always check for a newer page


@app.get("/")
async def landing(request: Request):
    return _page("index.html", request, need_login=False)


@app.get("/login")
async def login_page(request: Request, next: str = ""):
    if request.session.get("user"):
        return RedirectResponse(safe_next(next) or "/meetings")
    return _page("login.html", request, need_login=False)


@app.get("/app")
async def old_app(request: Request):
    return RedirectResponse("/meetings")


@app.get("/meetings")
async def meetings_page(request: Request):
    return _page("meetings.html", request)


@app.get("/new")
async def new_page(request: Request):
    return _page("new.html", request)


@app.get("/chat")
async def chat_page(request: Request):
    return _page("chat.html", request)


@app.get("/privacy")
async def privacy_page(request: Request):
    return _page("privacy.html", request, need_login=False)


@app.get("/healthz")
async def health():
    return {"ok": True}


# ============================================================
# Uploads
# ============================================================

class UploadRequest(BaseModel):
    filename: str
    content_type: str = "application/octet-stream"


@app.post("/api/uploads")
async def create_upload(body: UploadRequest, user=Depends(current_user)):
    try:
        obj = blobs.new_object_name(user["email"], body.filename)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if config.USE_GCP:
        return {"object": obj, "url": blobs.signed_upload_url(obj, body.content_type), "method": "PUT",
                "headers": {"Content-Type": body.content_type}}
    return {"object": obj, "url": f"/api/uploads/local?object={obj}", "method": "PUT",
            "headers": {"Content-Type": body.content_type}}


@app.put("/api/uploads/local")
async def local_upload(object: str, request: Request, user=Depends(current_user)):
    """Only used when running without Google Cloud: the browser uploads the file here."""
    if config.USE_GCP:
        raise HTTPException(404)
    safe_owner = "".join(c if c.isalnum() else "_" for c in user["email"])
    if not object.startswith(f"uploads/{safe_owner}/"):
        raise HTTPException(403)
    path = blobs.local_path(object)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        async for chunk in request.stream():
            f.write(chunk)
    return {"ok": True}


# ============================================================
# Meetings
# ============================================================

class NewMeeting(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    date: Optional[str] = None
    attendees: List[str] = []
    send_email: bool = True
    source_type: Literal["upload", "drive"]
    object: Optional[str] = None
    drive_url: Optional[str] = None


@app.post("/api/meetings")
async def create_meeting(body: NewMeeting, user=Depends(current_user)):
    owner = user["email"]
    attendees = sorted({a.strip().lower() for a in body.attendees if a.strip()})
    bad = [a for a in attendees if not EMAIL_RE.match(a)]
    if bad:
        raise HTTPException(400, f"Invalid email(s): {', '.join(bad)}")
    if len(attendees) > config.MAX_ATTENDEES:
        raise HTTPException(400, f"Maximum {config.MAX_ATTENDEES} attendees.")
    if created_today(owner) >= config.MAX_MEETINGS_PER_DAY:
        raise HTTPException(429, f"Daily limit reached ({config.MAX_MEETINGS_PER_DAY} meetings per day).")

    if body.source_type == "upload":
        safe_owner = "".join(c if c.isalnum() else "_" for c in owner)
        if not body.object or not body.object.startswith(f"uploads/{safe_owner}/") or not blobs.exists(body.object):
            raise HTTPException(400, "Upload not found. Please upload the video again.")
        source = {"type": "upload", "ref": body.object}
    else:
        url = (body.drive_url or "").strip()
        if not re.match(r"^https://(drive|docs)\.google\.com/", url):
            raise HTTPException(400, "Please paste a Google Drive link.")
        source = {"type": "drive", "ref": url}

    m = get_store().create({
        "owner": owner, "title": body.title.strip(), "date": body.date, "attendees": attendees,
        "send_email": body.send_email, "source": source, "status": "queued", "log": [], "error": None,
        "transcript": "", "analysis": None, "summary_md": "", "duration_sec": None, "emails_sent": 0,
    })
    worker.dispatch(m["id"])
    return light(m)


@app.get("/api/meetings")
async def list_meetings(user=Depends(current_user)):
    return [light(m) | {"is_owner": m["owner"] == user["email"]} for m in get_store().list_for(user["email"])]


def _get_accessible(mid: str, user) -> dict:
    m = get_store().get(mid)
    if not m or not can_access(m, user["email"]):
        raise HTTPException(404, "Meeting not found")
    return m


@app.get("/api/meetings/{mid}")
async def get_meeting(mid: str, user=Depends(current_user)):
    m = _get_accessible(mid, user)
    return light(m) | {"is_owner": m["owner"] == user["email"], "summary_md": m.get("summary_md", ""),
                       "log": m.get("log", []), "has_transcript": bool(m.get("transcript")),
                       "analysis": m.get("analysis"), "has_pdf": bool(m.get("analysis")),
                       "send_email": m.get("send_email")}


@app.get("/api/meetings/{mid}/transcript", response_class=PlainTextResponse)
async def get_transcript(mid: str, user=Depends(current_user)):
    m = _get_accessible(mid, user)
    return ai.repair_times(m.get("transcript", ""), m.get("duration_sec"))


@app.get("/api/meetings/{mid}/pdf")
async def get_pdf(mid: str, user=Depends(current_user)):
    """The minutes as a Meetly PDF, made on the spot from the meeting's analysis."""
    m = _get_accessible(mid, user)
    data = b""
    if m.get("analysis"):
        data = await run_in_threadpool(pdf.build_pdf, m | {"id": mid}, m["analysis"], mailer.sender_name(m["owner"]), lambda *_: None)
    if not data:
        raise HTTPException(404, "The PDF isn't available for this meeting.")
    name = "".join(c if c.isalnum() or c in " -_" else "_" for c in m.get("title") or "Meeting").strip() or "Meeting"
    ascii_name = "".join(c for c in name if c.isascii()).strip() or "Meetly"
    return Response(data, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{ascii_name} - Minutes.pdf"; '
                                                    f"filename*=UTF-8''{quote(name + ' - Minutes.pdf')}"})


@app.post("/api/meetings/{mid}/retry")
async def retry_meeting(mid: str, user=Depends(current_user)):
    m = _get_accessible(mid, user)
    if m["owner"] != user["email"]:
        raise HTTPException(403)
    if m["status"] != "error":
        raise HTTPException(400, "Only failed meetings can be retried.")
    if m["source"]["type"] == "upload" and not blobs.exists(m["source"]["ref"]):
        raise HTTPException(400, "The uploaded video has expired. Please create the meeting again.")
    get_store().update(mid, status="queued", error=None, log=[])
    worker.dispatch(mid)
    return {"ok": True}


class ResendRequest(BaseModel):
    add: List[str] = []          # extra attendees' emails (optional)
    only_new: bool = False       # email only the people just added


@app.post("/api/meetings/{mid}/resend")
async def resend_meeting(mid: str, body: Optional[ResendRequest] = None, user=Depends(current_user)):
    """Organizer only: make the Google Doc (if missing), share it and email the minutes again."""
    m = _get_accessible(mid, user)
    if m["owner"] != user["email"]:
        raise HTTPException(403, "Only the person who created the meeting can resend it.")
    if m["status"] != "done":
        raise HTTPException(400, "The minutes aren't ready yet.")
    body = body or ResendRequest()
    add = sorted({a.strip().lower() for a in body.add if a.strip()})
    bad = [a for a in add if not EMAIL_RE.match(a)]
    if bad:
        raise HTTPException(400, f"Invalid email(s): {', '.join(bad)}")
    if len(set(m.get("attendees") or []) | set(add)) > config.MAX_ATTENDEES:
        raise HTTPException(400, f"Maximum {config.MAX_ATTENDEES} attendees.")
    sent = await run_in_threadpool(worker.resend, mid, add, body.only_new)
    m = get_store().get(mid)
    return {"ok": True, "sent": sent, "emails_sent": m.get("emails_sent", 0),
            "attendees": m.get("attendees") or []}


@app.delete("/api/meetings/{mid}")
async def delete_meeting(mid: str, user=Depends(current_user)):
    m = _get_accessible(mid, user)
    if m["owner"] != user["email"]:
        raise HTTPException(403, "Only the person who created the meeting can delete it.")
    if m["source"]["type"] == "upload":
        blobs.delete(m["source"]["ref"])
    get_store().delete(mid)
    return {"ok": True}


# ============================================================
# Chat
# ============================================================

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=20000)


class ChatRequest(BaseModel):
    meeting_id: str          # a meeting id, or "all"
    messages: List[ChatMessage] = Field(min_length=1, max_length=60)


@app.post("/api/chat")
async def chat(body: ChatRequest, user=Depends(current_user)):
    if body.meeting_id == "all":
        meetings = [m for m in get_store().list_for(user["email"]) if m.get("status") == "done"]
        if not meetings:
            raise HTTPException(400, "No finished meetings yet.")
    else:
        m = _get_accessible(body.meeting_id, user)
        if m.get("status") != "done":
            raise HTTPException(400, "This meeting is still being processed.")
        meetings = [m]

    system = ai.build_prompt(meetings)
    messages = [msg.model_dump() for msg in body.messages]

    def gen():
        try:
            yield from ai.chat_stream(system, messages)
        except Exception as e:
            yield f"\n\n⚠️ {e}"

    return StreamingResponse(gen(), media_type="text/plain; charset=utf-8",
                             headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"})
