"""AI steps: Gemini turns video into text, GPT-6 Luna analyzes it and answers questions."""
import math
import re
import subprocess
import time
from typing import Callable, Dict, Iterator, List, Optional

import httpx

from . import config
from .schema import ANALYSIS_PROMPT, TRANSCRIBE_PROMPT, MeetingAnalysis

Log = Callable[[str], None]
CHUNK = 15 * 60
_TS = re.compile(r"\[\s*(\d{1,2}):(\d{2}):(\d{2})\s*\]")


def hms(s: float) -> str:
    s = int(s)
    return f"{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}"


# ============================================================
# Never stop on temporary problems
# ============================================================

def keep_trying(fn, what: str, log: Log, max_wait: int = 120):
    """Runs fn(); if the server is busy (5xx), rate-limited (429) or the connection drops,
    waits and tries again until it works. Real mistakes (bad key, broken file) are raised."""
    from google.genai import errors as gerr
    wait = 10
    while True:
        try:
            return fn()
        except gerr.ServerError as e:
            reason = f"server busy ({e.code})"
        except gerr.ClientError as e:
            if e.code != 429:
                raise
            reason = "rate limit (429)"
        except (httpx.TransportError, ConnectionError, TimeoutError) as e:
            reason = f"connection problem ({type(e).__name__})"
        log(f"⏳ {what}: {reason}. Waiting {wait}s...")
        time.sleep(wait)
        wait = min(wait * 2, max_wait)


# ============================================================
# Transcription (Gemini)
# ============================================================

def media_duration(path) -> Optional[float]:
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
            capture_output=True, text=True, timeout=120,
        ).stdout.strip()
        return float(out) if out else None
    except Exception:
        return None


def _fix_times(text: str, offset: float, length: float) -> str:
    found = [int(h) * 3600 + int(m) * 60 + int(s) for h, m, s in _TS.findall(text)]
    shift = offset if (offset > 0 and found and max(found) < offset and max(found) <= length + 60) else 0
    return _TS.sub(lambda m: f"[{hms(int(m[1]) * 3600 + int(m[2]) * 60 + int(m[3]) + shift)}]", text)


_TS_SHORT = re.compile(r"\[\s*(\d{1,2}):(\d{2})\s*\]")   # [MM:SS], which Gemini sometimes writes instead of [HH:MM:SS]


def _normalize(text: str) -> str:
    return _TS_SHORT.sub(lambda m: f"[{hms(int(m[1]) * 60 + int(m[2]))}]", text)


def _looks_broken(text: str, length: float) -> bool:
    """Gemini lost track of time: (nearly) every line carries the SAME timestamp, e.g. all [00:00:00]."""
    stamps = _TS.findall(text)
    if length <= 90 or len(stamps) < 4:
        return False
    top = max(stamps.count(s) for s in set(stamps))
    return len(set(stamps)) == 1 or top / len(stamps) >= 0.8


def _spread_times(text: str, start: float, length: float) -> str:
    """Last resort when the timestamps are broken: place each line by how far into the text it is.
    People speak at a fairly steady pace, so this lands close to the real moment (instead of 00:00:00)."""
    total = max(len(text), 1)
    return _TS.sub(lambda m: f"[{hms(start + length * m.start() / total)}]", text)


def repair_times(transcript: str, duration) -> str:
    """Used when a saved transcript is read (chat, cues): fixes meetings transcribed before this check existed."""
    text = _normalize(transcript or "")
    if duration and _looks_broken(text, float(duration)):
        return _spread_times(text, 0, float(duration))
    return text


def transcribe(video_path, log: Log) -> str:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=config.GEMINI_API_KEY())
    duration = media_duration(video_path)

    log("⬆️ Sending the video to Gemini...")
    video = keep_trying(lambda: client.files.upload(file=str(video_path)), "upload", log)
    started = time.time()
    while video.state.name == "PROCESSING":
        time.sleep(10)
        video = keep_trying(lambda: client.files.get(name=video.name), "upload check", log)
        if time.time() - started > 3600:
            raise TimeoutError("Gemini took too long to prepare the video.")
    if video.state.name != "ACTIVE":
        raise RuntimeError(f"Gemini could not read this video ({video.state.name}).")

    config_ = types.GenerateContentConfig(
        temperature=0.0,
        max_output_tokens=65536,
        media_resolution=types.MediaResolution.MEDIA_RESOLUTION_LOW,   # ~3x fewer tokens per second
        thinking_config=types.ThinkingConfig(thinking_budget=0),        # thinking would eat the output limit
    )

    try:
        if not duration or duration <= CHUNK + 60:
            log("📝 Transcribing...")
            text = ""
            for attempt in range(3):   # short videos get the same timestamp check as long ones
                r = keep_trying(lambda: client.models.generate_content(
                    model=config.TRANSCRIBE_MODEL, contents=[video, TRANSCRIBE_PROMPT], config=config_), "transcribe", log)
                text = _normalize((r.text or "").strip())
                if not _looks_broken(text, duration or 0):
                    break
                log("🔁 The timestamps came back broken, retrying...")
            else:
                text = _spread_times(text, 0, duration)
            return _fix_times(text, 0, 0)

        n = math.ceil(duration / CHUNK)
        parts = []
        for i in range(n):
            start, end = i * CHUNK, min((i + 1) * CHUNK, duration)
            log(f"📝 Transcribing part {i + 1}/{n} ({hms(start)}–{hms(end)})")
            clip = types.Part(
                file_data=types.FileData(file_uri=video.uri, mime_type=video.mime_type),
                video_metadata=types.VideoMetadata(start_offset=f"{int(start)}s", end_offset=f"{int(end)}s"),
            )
            prompt = TRANSCRIBE_PROMPT + (
                f"\nIMPORTANT: this request covers ONLY the part from {hms(start)} to {hms(end)}. Transcribe only "
                f"this part, completely, until its very end. Timestamps are from the start of the FULL video, so "
                f"the first line should be around [{hms(start)}], and every speaker turn needs its OWN real timestamp."
            )
            text = ""
            for attempt in range(3):
                r = keep_trying(lambda: client.models.generate_content(
                    model=config.TRANSCRIBE_MODEL, contents=[clip, prompt], config=config_), f"part {i + 1}", log)
                text = _normalize((r.text or "").strip())
                if not _looks_broken(text, end - start):
                    break
                log(f"🔁 Part {i + 1} came back with broken timestamps, retrying...")
            else:
                text = _spread_times(text, start, end - start)
            parts.append(_fix_times(text, start, end - start))
        return "\n\n".join(p for p in parts if p)
    finally:
        try:
            client.files.delete(name=video.name)
        except Exception:
            pass


# ============================================================
# Analysis + chat (GPT-6 Luna)
# ============================================================

def _openai():
    from openai import OpenAI
    return OpenAI(api_key=config.OPENAI_API_KEY(), max_retries=8)


def analyze(transcript: str, log: Log) -> MeetingAnalysis:
    log("🔍 Writing the summary...")
    r = _openai().responses.parse(
        model=config.ANALYSIS_MODEL,
        instructions=ANALYSIS_PROMPT + (
            "\nSPEAKER NAMES\n- The transcript may spell the same person in different ways "
            "(e.g. 'Mohamad' / 'Mohaned'). Use ONE consistent full name per person.\n"
        ),
        input=f"Meeting transcript:\n\n{transcript}",
        text_format=MeetingAnalysis,
    )
    if r.output_parsed is None:
        raise RuntimeError("The model did not return a summary.")
    return r.output_parsed


ONE_MEETING_PROMPT = """You are a meeting assistant. Users ask you about the meeting "{title}" ({date}).

RULES
- Answer ONLY from the meeting analysis and transcript below. Never guess or use outside knowledge.
- Support every factual claim with the transcript timestamp(s), e.g. [00:14:32].
- The transcript may spell one person's name in different ways; treat them as the same person.
- If the answer is not in the recording, say clearly that it was not mentioned in this meeting.
- Reply in the same language the user writes in (Arabic or English). Be concise.

MEETING ANALYSIS (JSON):
{analysis}

FULL TRANSCRIPT:
{transcript}
"""

ALL_MEETINGS_PROMPT = """You are a meeting assistant with access to several of the user's meetings below.

RULES
- Answer ONLY from these meetings. Never guess or use outside knowledge.
- Always say WHICH meeting (title + date) each fact comes from, plus the timestamp, e.g. [00:14:32].
- If several meetings discuss a topic, compare them and point out what changed over time.
- If the answer is in none of them, say so clearly.
- Reply in the same language the user writes in (Arabic or English). Be concise.

{meetings}
"""

MAX_CONTEXT_CHARS = 2_500_000   # stays well inside Luna's ~1M-token context


def build_prompt(meetings: List[dict]) -> str:
    import json
    if len(meetings) == 1:
        m = meetings[0]
        return ONE_MEETING_PROMPT.format(
            title=m["title"], date=m.get("date") or m["created_at"][:10],
            analysis=json.dumps(m.get("analysis") or {}, ensure_ascii=False),
            transcript=repair_times(m.get("transcript", ""), m.get("duration_sec")),
        )
    blocks, used = [], 0
    for i, m in enumerate(meetings, start=1):   # newest first; stop before the context is full
        block = (f"==================== MEETING {i}: \"{m['title']}\" ({m.get('date') or m['created_at'][:10]}) "
                 f"====================\nSUMMARY:\n{m.get('summary_md', '')}\n\nTRANSCRIPT:\n{repair_times(m.get('transcript', ''), m.get('duration_sec'))}\n")
        if used + len(block) > MAX_CONTEXT_CHARS:
            break
        blocks.append(block)
        used += len(block)
    return ALL_MEETINGS_PROMPT.format(meetings="\n".join(blocks))


def chat_stream(system_prompt: str, messages: List[Dict[str, str]]) -> Iterator[str]:
    stream = _openai().responses.create(
        model=config.CHAT_MODEL, instructions=system_prompt,
        input=[{"role": m["role"], "content": m["content"]} for m in messages], stream=True,
    )
    for event in stream:
        if event.type == "response.output_text.delta":
            yield event.delta
        elif event.type in ("response.failed", "error"):
            raise RuntimeError(getattr(event, "message", None) or "The model returned an error.")
