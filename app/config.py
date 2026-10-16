"""All settings come from environment variables (or a .env file when running locally/Colab)."""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def _get(name: str, default: str = "") -> str:
    value = os.getenv(name)
    if value:
        return value
    try:  # Colab Secrets, if running on Colab
        from google.colab import userdata
        return userdata.get(name) or default
    except Exception:
        return default


# --- AI ---
GEMINI_API_KEY = lambda: _get("GEMINI_API_KEY")
OPENAI_API_KEY = lambda: _get("OPENAI_API_KEY")
TRANSCRIBE_MODEL = _get("TRANSCRIBE_MODEL", "gemini-2.5-flash")
ANALYSIS_MODEL = _get("ANALYSIS_MODEL", "gpt-6-luna")
CHAT_MODEL = _get("CHAT_MODEL", "gpt-6-luna")

# --- Website ---
APP_URL = _get("APP_URL", "http://localhost:8000").rstrip("/")   # public address of the site
SESSION_SECRET = _get("SESSION_SECRET", "dev-only-change-me")
DEV_LOGIN = _get("DEV_LOGIN", "0") == "1"   # local/Colab testing: log in by typing an email (never in production)

# --- Google sign-in (OAuth "Web application" client) ---
GOOGLE_CLIENT_ID = _get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = _get("GOOGLE_CLIENT_SECRET")

# --- Email (a dedicated Gmail account + App Password) ---
SMTP_HOST = _get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(_get("SMTP_PORT", "587"))
SMTP_USER = _get("SMTP_USER").strip()
SMTP_PASSWORD = _get("SMTP_PASSWORD").replace(" ", "")   # App Passwords are shown with spaces; Gmail wants them without
MAIL_FROM_NAME = _get("MAIL_FROM_NAME", "Meetly")

# --- Google Cloud (leave empty to run locally with files on disk) ---
GCP_PROJECT = _get("GCP_PROJECT")
GCS_BUCKET = _get("GCS_BUCKET")                  # where uploaded videos are stored temporarily
CLOUD_RUN_JOB = _get("CLOUD_RUN_JOB")            # name of the Cloud Run Job that processes meetings
CLOUD_RUN_REGION = _get("CLOUD_RUN_REGION", "europe-west1")

# --- Local storage (used when GCP is not configured) ---
DATA_DIR = Path(_get("DATA_DIR", "data"))

# --- Limits (protect your API budget) ---
MAX_VIDEO_MINUTES = int(_get("MAX_VIDEO_MINUTES", "150"))
MAX_MEETINGS_PER_DAY = int(_get("MAX_MEETINGS_PER_DAY", "5"))
MAX_ATTENDEES = int(_get("MAX_ATTENDEES", "30"))

USE_GCP = bool(GCP_PROJECT and GCS_BUCKET)
