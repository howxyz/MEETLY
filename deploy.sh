#!/usr/bin/env bash
# Puts the whole website on Google Cloud. Run it in Google Cloud Shell, inside this folder:
#     bash deploy.sh
# Safe to run again any time (after changing code or deploy.env): it updates what's already there.
set -euo pipefail

cd "$(dirname "$0")"
if [[ ! -f deploy.env ]]; then
  echo "❌ deploy.env not found. Copy deploy.env.example to deploy.env and fill it in first."; exit 1
fi
set -a; source deploy.env; set +a

PROJECT="$(gcloud config get-value project 2>/dev/null)"
if [[ -z "$PROJECT" || "$PROJECT" == "(unset)" ]]; then
  echo "❌ No Google Cloud project selected. Run: gcloud config set project YOUR_PROJECT_ID"; exit 1
fi
REGION="${REGION:-europe-west1}"
SERVICE=meeting-app
JOB=meeting-worker
BUCKET="${PROJECT}-meeting-uploads"
SA_NAME=meeting-app-sa
SA="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"

# A random secret for login cookies, created once and kept in deploy.env
if [[ -z "${SESSION_SECRET:-}" ]]; then
  SESSION_SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
  echo "SESSION_SECRET=${SESSION_SECRET}" >> deploy.env
fi

echo "▶ Project: $PROJECT   Region: $REGION"

echo "▶ 1/7 Turning on the Google Cloud services we need..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  firestore.googleapis.com storage.googleapis.com iam.googleapis.com iamcredentials.googleapis.com --quiet

echo "▶ 2/7 Creating the app's service account and permissions..."
if ! gcloud iam service-accounts describe "$SA" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_NAME" --display-name="Meeting app"
  sleep 15   # give Google a moment to register the new account
fi
for ROLE in roles/datastore.user roles/run.developer; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role="$ROLE" --condition=None --quiet >/dev/null
done
# lets the app sign upload links and start the worker job as itself
for ROLE in roles/iam.serviceAccountTokenCreator roles/iam.serviceAccountUser; do
  gcloud iam service-accounts add-iam-policy-binding "$SA" --member="serviceAccount:$SA" --role="$ROLE" --quiet >/dev/null
done

echo "▶ 3/7 Creating the database (Firestore)..."
gcloud firestore databases describe --database="(default)" >/dev/null 2>&1 || \
  gcloud firestore databases create --location="$REGION" --type=firestore-native --quiet

echo "▶ 4/7 Creating the storage for uploaded videos..."
gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1 || \
  gcloud storage buckets create "gs://$BUCKET" --location="$REGION" --uniform-bucket-level-access --quiet
cat > /tmp/cors.json <<'EOF'
[{"origin": ["*"], "method": ["PUT"], "responseHeader": ["Content-Type"], "maxAgeSeconds": 3600}]
EOF
cat > /tmp/lifecycle.json <<'EOF'
{"rule": [{"action": {"type": "Delete"}, "condition": {"age": 3}}]}
EOF
gcloud storage buckets update "gs://$BUCKET" --cors-file=/tmp/cors.json --lifecycle-file=/tmp/lifecycle.json --quiet
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$SA" --role=roles/storage.objectAdmin --quiet >/dev/null

write_env() {   # settings the app reads
  cat > env.yaml <<EOF
APP_URL: "${APP_URL}"
SESSION_SECRET: "${SESSION_SECRET}"
GEMINI_API_KEY: "${GEMINI_API_KEY}"
OPENAI_API_KEY: "${OPENAI_API_KEY}"
GOOGLE_CLIENT_ID: "${GOOGLE_CLIENT_ID:-}"
GOOGLE_CLIENT_SECRET: "${GOOGLE_CLIENT_SECRET:-}"
SMTP_USER: "${SMTP_USER:-}"
SMTP_PASSWORD: "${SMTP_PASSWORD:-}"
MAIL_FROM_NAME: "${MAIL_FROM_NAME:-Meetly}"
GCP_PROJECT: "${PROJECT}"
GCS_BUCKET: "${BUCKET}"
CLOUD_RUN_JOB: "${JOB}"
CLOUD_RUN_REGION: "${REGION}"
MAX_VIDEO_MINUTES: "${MAX_VIDEO_MINUTES:-150}"
MAX_MEETINGS_PER_DAY: "${MAX_MEETINGS_PER_DAY:-5}"
EOF
}

APP_URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
APP_URL="${APP_URL:-http://placeholder}"
write_env

echo "▶ 5/7 Building and deploying the website (takes a few minutes)..."
gcloud run deploy "$SERVICE" --source . --region "$REGION" --service-account "$SA" \
  --allow-unauthenticated --env-vars-file env.yaml --memory 1Gi --cpu 1 --timeout 300 \
  --min-instances 0 --max-instances 5 --quiet

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
if [[ "$URL" != "$APP_URL" ]]; then
  APP_URL="$URL"; write_env
  gcloud run services update "$SERVICE" --region "$REGION" --env-vars-file env.yaml --quiet >/dev/null
fi

echo "▶ 6/7 Creating the background worker that processes videos..."
IMAGE="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(spec.template.spec.containers[0].image)')"
gcloud run jobs deploy "$JOB" --image "$IMAGE" --region "$REGION" --service-account "$SA" \
  --env-vars-file env.yaml --command python --args="-m,app.worker" \
  --task-timeout 3600 --max-retries 0 --memory 2Gi --cpu 1 --quiet

rm -f env.yaml
echo "▶ 7/7 Done!"
echo
echo "🌐 Your website: $APP_URL"
echo
if [[ -z "${GOOGLE_CLIENT_ID:-}" ]]; then
  echo "⚠️  Google sign-in is not set up yet, so nobody can log in. Next:"
  echo "   1. Open https://console.cloud.google.com/auth/clients?project=$PROJECT"
  echo "   2. Create client → Application type: Web application"
  echo "   3. Authorized redirect URI:  $APP_URL/auth/callback"
  echo "   4. Copy the Client ID and Client secret into deploy.env, then run:  bash deploy.sh"
else
  echo "✅ Google sign-in redirect URI (must be in your OAuth client):  $APP_URL/auth/callback"
fi
[[ -z "${SMTP_USER:-}" ]] && echo "⚠️  Email is not set up (SMTP_USER/SMTP_PASSWORD), so summaries won't be emailed."
exit 0
