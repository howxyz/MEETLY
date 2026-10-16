#!/usr/bin/env bash
# Meetly on one AWS EC2 server (Ubuntu 24.04).  Run:  bash aws/setup.sh
# Safe to run again: it keeps your keys and data and just rebuilds/restarts the site.
set -euo pipefail
cd "$(dirname "$0")"
AWS_DIR="$(pwd)"

echo "== 1/5  Installing Docker (first run only) =="
if ! command -v docker >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y docker.io docker-compose-v2 unzip
  sudo systemctl enable --now docker
fi

echo "== 2/5  Adding 2 GB swap (helps small servers) =="
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null && sudo swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "== 3/5  Finding this server's public address =="
TOKEN=$(curl -s -m 3 -X PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 60" || true)
IP=$(curl -s -m 3 -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4 || true)
[ -z "$IP" ] && IP=$(curl -s -m 5 https://checkip.amazonaws.com | tr -d '[:space:]')
SAVED_HOST=$(grep -E '^SITE_HOST=' "$AWS_DIR/.env" 2>/dev/null | head -1 | cut -d= -f2- || true)
SITE_HOST="${SITE_HOST:-${SAVED_HOST:-${IP//./-}.sslip.io}}"
echo "   Site address: https://$SITE_HOST"

echo "== 4/5  Your keys (saved only on this server, in aws/.env) =="
ENV_FILE="$AWS_DIR/.env"
touch "$ENV_FILE"; chmod 600 "$ENV_FILE"
getv() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- || true; }
setv() {  # setv NAME VALUE
  local tmp; tmp=$(mktemp)
  grep -vE "^$1=" "$ENV_FILE" > "$tmp" || true
  printf '%s=%s\n' "$1" "$2" >> "$tmp"
  cat "$tmp" > "$ENV_FILE"; rm -f "$tmp"
}
ask() {  # ask NAME "question" [secret]
  local cur; cur=$(getv "$1")
  if [ -n "$cur" ]; then echo "   $1: already saved"; return; fi
  local val=""
  while [ -z "$val" ]; do
    if [ "${3:-}" = secret ]; then read -r -s -p "   $2: " val; echo; else read -r -p "   $2: " val; fi
  done
  setv "$1" "$val"
}
ask GEMINI_API_KEY       "Gemini API key" secret
ask OPENAI_API_KEY       "OpenAI API key" secret
ask GOOGLE_CLIENT_ID     "Google OAuth Client ID"
ask GOOGLE_CLIENT_SECRET "Google OAuth Client secret" secret
ask SMTP_USER            "Site Gmail address (sends the minutes)"
ask SMTP_PASSWORD        "Gmail App Password (16 letters)" secret
[ -z "$(getv SESSION_SECRET)" ] && setv SESSION_SECRET "$(openssl rand -hex 32)"
[ -z "$(getv MAIL_FROM_NAME)" ] && setv MAIL_FROM_NAME "Meetly"
[ -z "$(getv MAX_VIDEO_MINUTES)" ] && setv MAX_VIDEO_MINUTES "150"
[ -z "$(getv MAX_MEETINGS_PER_DAY)" ] && setv MAX_MEETINGS_PER_DAY "5"
setv APP_URL "https://$SITE_HOST"
setv SITE_HOST "$SITE_HOST"   # also read by docker compose (aws/.env)
setv DEV_LOGIN "0"

echo "== 5/5  Building and starting the site (a few minutes the first time) =="
sudo mkdir -p /opt/meetly/data
export SITE_HOST MEETLY_DATA=/opt/meetly/data
sudo -E docker compose -f "$AWS_DIR/docker-compose.yml" up -d --build
sudo docker image prune -f >/dev/null || true

cat <<MSG

==========================================================
 Meetly is starting at:   https://$SITE_HOST
 (the HTTPS certificate takes up to a minute on first start)

 Add this in Google Cloud > Credentials > your OAuth client
 > Authorized redirect URIs:
     https://$SITE_HOST/auth/callback
==========================================================
 Logs:     sudo docker compose -f $AWS_DIR/docker-compose.yml logs -f app
 Restart:  bash $AWS_DIR/setup.sh
MSG
