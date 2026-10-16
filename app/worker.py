"""Processes one meeting: get video -> transcript -> summary -> email.

On Google Cloud it runs as a Cloud Run Job (so long videos never get cut off):
    python -m app.worker <meeting_id>
Locally / on Colab it runs in a background thread of the web server.
"""
import sys
import tempfile
import threading
import traceback
from datetime import datetime, timezone
from pathlib import Path

from . import ai, blobs, config, mailer, pdf
from .report import build_markdown
from .store import get_store


def process(meeting_id: str):
    store = get_store()
    m = store.get(meeting_id)
    if not m or m.get("status") == "done":
        return

    def log(line: str):
        stamp = datetime.now(timezone.utc).strftime("%H:%M:%S")
        store.add_log(meeting_id, f"{stamp}  {line}")
        print(line, flush=True)

    def status(s: str):
        store.update(meeting_id, status=s)

    try:
        with tempfile.TemporaryDirectory() as tmp:
            # 1) Get the video
            status("downloading")
            src = m["source"]
            if src["type"] == "drive":
                import gdown
                log("⬇️ Downloading from Google Drive...")
                path = gdown.download(src["ref"], str(Path(tmp) / "video.mp4"), fuzzy=True, quiet=True)
                if not path:
                    raise RuntimeError("Could not download the Drive link. Share it as 'Anyone with the link'.")
                path = Path(path)
            else:
                log("⬇️ Getting the uploaded video...")
                path = blobs.download_to(src["ref"], Path(tmp) / ("video" + Path(src["ref"]).suffix))

            duration = ai.media_duration(path)
            if duration:
                log(f"⏱️ Length: {ai.hms(duration)}")
                store.update(meeting_id, duration_sec=duration)
                if duration > config.MAX_VIDEO_MINUTES * 60:
                    raise RuntimeError(f"The video is longer than the {config.MAX_VIDEO_MINUTES}-minute limit.")

            # 2) Transcript
            status("transcribing")
            transcript = ai.transcribe(path, log)
            if not transcript:
                raise RuntimeError("No speech was found in the video.")
            store.update(meeting_id, transcript=transcript)

        # 3) Summary
        status("analyzing")
        analysis = ai.analyze(transcript, log)
        summary_md = build_markdown(analysis.model_dump(mode="json"))
        store.update(meeting_id, analysis=analysis.model_dump(mode="json"), summary_md=summary_md)

        # 4) The email to everyone, with the Meetly PDF of the minutes attached
        sent = deliver(meeting_id, log, status)

        store.update(meeting_id, status="done", emails_sent=sent, error=None)
        log("🎉 Done")
        if m["source"]["type"] == "upload":
            blobs.delete(m["source"]["ref"])   # don't keep recordings once they're processed
    except Exception as e:
        # The uploaded video is kept so "Try again" works (Cloud Storage deletes it after 3 days anyway).
        traceback.print_exc()
        store.update(meeting_id, status="error", error=f"{type(e).__name__}: {e}")
        log(f"❌ {e}")


def deliver(meeting_id: str, log, status=lambda s: None, only=None, force_email: bool = False) -> int:
    """Emails the minutes to everyone, with the Meetly PDF attached.
    Used at the end of processing and by the "Resend minutes" button. Returns how many emails went out.
    only = email just these people (e.g. attendees added later); None = everyone."""
    store = get_store()
    m = store.get(meeting_id)
    analysis = m.get("analysis") or {}
    recipients = list(dict.fromkeys([m["owner"]] + list(m.get("attendees") or [])))   # organizer gets a copy too
    if only is not None:
        recipients = [r for r in recipients if r in set(only)]

    if not recipients:
        return 0
    if not m.get("send_email") and not force_email:
        log("✉️ Email is switched off for this meeting.")
        return 0
    if not mailer.is_configured():
        log("⚠️ Email is not set up on this server (SMTP_USER / SMTP_PASSWORD), so no emails were sent.")
        return 0
    status("emailing")
    data = pdf.build_pdf(m | {"id": meeting_id}, analysis, mailer.sender_name(m["owner"]), log) if analysis else b""
    log(f"✉️ Emailing {len(recipients)} people" + (" with the minutes as a PDF" if data else " (no PDF, so the minutes go in the email)") + "...")
    sent = mailer.send_summary(recipients, m["title"], m.get("summary_md") or "", meeting_id, m["owner"],
                               log=log, analysis=analysis, pdf=data)
    log(f"✉️ Sent {sent}/{len(recipients)}")
    return sent


def resend(meeting_id: str, add=None, only_new: bool = False) -> int:
    """Runs deliver() again for a finished meeting (e.g. to send the minutes to people added later).
    add = new attendees to add first; only_new = email only them."""
    store = get_store()
    add = [a for a in (add or [])]

    def log(line: str):
        store.add_log(meeting_id, f"{datetime.now(timezone.utc).strftime('%H:%M:%S')}  {line}")

    sent = 0
    try:
        m = store.get(meeting_id)
        old = list(m.get("attendees") or [])
        new = [a for a in add if a not in old and a != m["owner"]]
        if new:
            store.update(meeting_id, attendees=sorted(set(old) | set(new)))
            log(f"➕ Added {len(new)} attendee(s): {', '.join(new)}")
        log("🔁 Sending the minutes" + (" to the new attendees..." if only_new and new else " again..."))
        sent = deliver(meeting_id, log, only=new if (only_new and new) else None, force_email=True)
        total = (m.get("emails_sent") or 0) + sent if (only_new and new) else sent
        store.update(meeting_id, status="done", emails_sent=total)
        log("🎉 Done")
    except Exception as e:
        traceback.print_exc()
        store.update(meeting_id, status="done")
        log(f"❌ {e}")
    return sent


def dispatch(meeting_id: str):
    """Starts processing in the background."""
    if config.USE_GCP and config.CLOUD_RUN_JOB:
        from google.cloud import run_v2
        name = f"projects/{config.GCP_PROJECT}/locations/{config.CLOUD_RUN_REGION}/jobs/{config.CLOUD_RUN_JOB}"
        override = run_v2.RunJobRequest.Overrides.ContainerOverride(args=["-m", "app.worker", meeting_id])
        run_v2.JobsClient().run_job(request=run_v2.RunJobRequest(
            name=name, overrides=run_v2.RunJobRequest.Overrides(container_overrides=[override])))
    else:
        threading.Thread(target=process, args=(meeting_id,), daemon=True).start()


if __name__ == "__main__":
    process(sys.argv[1])
