# 1) Build the website (Next.js → plain files in /web/out)
FROM node:22-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web ./
RUN npm run build

# 2) The server
FROM python:3.12-slim

# ffmpeg/ffprobe measure video length; Pango draws the PDF of the minutes (WeasyPrint)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libpango-1.0-0 libpangoft2-1.0-0 && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY --from=web /web/out ./web/out

ENV PYTHONUNBUFFERED=1
# The website. (The Cloud Run Job overrides this with: python -m app.worker <meeting_id>)
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --proxy-headers --forwarded-allow-ips="*"
