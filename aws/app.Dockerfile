# AWS image: uses the website already built in web/out (no Node build on the small server)
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libpango-1.0-0 libpangoft2-1.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY web/out ./web/out
ENV PYTHONUNBUFFERED=1 PORT=8080 DATA_DIR=/data
CMD exec uvicorn app.main:app --host 0.0.0.0 --port 8080 --proxy-headers --forwarded-allow-ips="*"
