"""Try the website on Colab (or your laptop) before putting it on Google Cloud.

In Colab, from this folder:
    !pip install -q -r requirements.txt
    %run colab_run.py

It asks for your keys, opens a public link and starts the site. Data is saved in ./data.

- With NGROK_AUTHTOKEN + NGROK_DOMAIN + GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (Colab Secrets):
  a FIXED link with real "Sign in with Google", so anyone can try it.
- Without them: a temporary link in TEST MODE (sign in by typing any email).
"""
import os
import re
import subprocess
import sys
import time
import urllib.request
from getpass import getpass
from pathlib import Path


def from_secrets(name):
    """Colab Secrets (the 🔑 icon): saved once in your Google account, used on every run."""
    try:
        from google.colab import userdata
        return userdata.get(name) or ""
    except Exception:
        return ""


def ask(name, prompt, secret=True, optional=False):
    if os.getenv(name):
        return
    saved = from_secrets(name)
    if saved:
        os.environ[name] = saved
        return
    value = (getpass if secret else input)(prompt).strip()
    if value or not optional:
        os.environ[name] = value


# The PDF of the minutes needs the Pango library (usually already on Colab; installed once if not)
try:
    import weasyprint  # noqa: F401
except Exception:
    print("Installing the PDF library (one time)...")
    subprocess.run("apt-get -qq update && apt-get -qq install -y libpango-1.0-0 libpangoft2-1.0-0", shell=True)

ask("GEMINI_API_KEY", "Gemini key: ")
ask("OPENAI_API_KEY", "OpenAI key: ")
ask("SMTP_USER", "Site Gmail address (Enter to skip emails): ", secret=False, optional=True)
if os.getenv("SMTP_USER"):
    ask("SMTP_PASSWORD", "Gmail App Password: ")

for k in ("NGROK_AUTHTOKEN", "NGROK_DOMAIN", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"):
    if not os.getenv(k):
        os.environ[k] = from_secrets(k)
NGROK = bool(os.getenv("NGROK_AUTHTOKEN") and os.getenv("NGROK_DOMAIN"))
GOOGLE = bool(os.getenv("GOOGLE_CLIENT_ID") and os.getenv("GOOGLE_CLIENT_SECRET"))
os.environ.setdefault("DEV_LOGIN", "0" if GOOGLE else "1")
os.environ.setdefault("SESSION_SECRET", os.urandom(24).hex())
os.environ.setdefault("DATA_DIR", str(Path("data").resolve()))
PORT = 8000

# Stop anything left over from a previous run of this cell
subprocess.run(["pkill", "-f", "uvicorn app.main:app"], capture_output=True)
subprocess.run(["pkill", "-f", "cloudflared tunnel"], capture_output=True)
subprocess.run(["pkill", "-f", "ngrok http"], capture_output=True)
time.sleep(1)

# 1) Public link
if NGROK:
    # Fixed address (free ngrok "static domain"), so Google sign-in can be set up once.
    ng = Path("/content/ngrok")   # Drive can't run programs, so keep it on the Colab disk
    if not ng.exists():
        urllib.request.urlretrieve("https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz", "/content/ngrok.tgz")
        subprocess.run(["tar", "-xzf", "/content/ngrok.tgz", "-C", "/content"], check=True)
    domain = os.environ["NGROK_DOMAIN"].replace("https://", "").strip("/")
    tunnel = subprocess.Popen([str(ng), "http", str(PORT), f"--url=https://{domain}", "--log=stdout",
                               "--authtoken", os.environ["NGROK_AUTHTOKEN"]],
                              stdout=open("/content/ngrok.log", "w"), stderr=subprocess.STDOUT)
    url = f"https://{domain}"
    time.sleep(4)
    if tunnel.poll() is not None:
        print(Path("/content/ngrok.log").read_text()[-1500:])
        raise RuntimeError("ngrok failed to start (see above). Check NGROK_AUTHTOKEN and NGROK_DOMAIN.")
else:
    # Temporary link with Cloudflare (changes every run)
    cf = Path("/content/cloudflared")   # Drive can't run programs, so keep it on the Colab disk
    if not cf.exists():
        urllib.request.urlretrieve(
            "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64", cf)
        cf.chmod(0o755)
    # Its messages go to a file (reading them through a pipe and then stopping would freeze the tunnel).
    cf_log = Path("/content/cloudflared.log")
    cf_log.write_text("")
    tunnel = subprocess.Popen([str(cf), "tunnel", "--url", f"http://localhost:{PORT}", "--no-autoupdate"],
                              stdout=open(cf_log, "w"), stderr=subprocess.STDOUT)
    url, connected = None, False
    deadline = time.time() + 90
    while time.time() < deadline and not (url and connected):
        time.sleep(1)
        text = cf_log.read_text(errors="ignore")
        m = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", text)
        url = m.group(0) if m else None
        connected = "Registered tunnel connection" in text
    if not url:
        raise RuntimeError("Could not open the public link. Run the cell again.")
os.environ["APP_URL"] = url

# 2) The website, as its own process (Colab's notebook already runs an event loop,
#    so uvicorn can't run inside the notebook itself)
#    Its messages go to a file: a child process's output never reaches the Colab cell otherwise.
server_log = Path("/content/server.log") if Path("/content").is_dir() else Path("server.log")
server = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", str(PORT),
     "--log-level", "warning"],
    env=dict(os.environ), stdout=open(server_log, "w"), stderr=subprocess.STDOUT,
)
for _ in range(60):   # wait until the site answers before showing the link
    try:
        urllib.request.urlopen(f"http://localhost:{PORT}/healthz", timeout=2)
        break
    except Exception:
        if server.poll() is not None:
            tunnel.terminate()
            print(server_log.read_text(errors="ignore")[-4000:])
            raise RuntimeError("The website failed to start. The reason is printed just above this line.")
        time.sleep(1)
else:
    print(server_log.read_text(errors="ignore")[-4000:])
    raise RuntimeError("The website didn't answer within a minute. The server's messages are printed above.")

print("\n" + "=" * 60)
print(f"🌐 Open the website:  {url}")
if GOOGLE:
    print("   Sign in with Google. Anyone with the link can create an account.")
    print(f"   (Google Cloud → OAuth client → Authorized redirect URI must be: {url}/auth/callback)")
else:
    print("   Test mode: sign in by typing any email.")
if not NGROK:
    print("   This link changes every run. If it doesn't open, wait 30 seconds and try again.")
print("   Stop this cell to close the site.")
print("=" * 60 + "\n")
try:
    server.wait()
    print(server_log.read_text(errors="ignore")[-4000:])   # if it stops by itself, show why
except KeyboardInterrupt:
    print("Stopping the site...")
finally:
    server.terminate()
    tunnel.terminate()
