"""Sends the minutes from the site's own Gmail account (SMTP + App Password), branded as Meetly."""
import html
import smtplib
import ssl
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from urllib.parse import quote
from email.utils import formataddr
from typing import List

import markdown

from . import config

INK, GOLD, PAPER, MUTED, LINE = "#0a0a0a", "#ff3b2f", "#f5f5f0", "#6b6b66", "#e6e5e0"   # GOLD = the signal red


def is_configured() -> bool:
    return bool(config.SMTP_USER and config.SMTP_PASSWORD)


def sender_name(owner: str) -> str:
    """The display name of the person who created the meeting (saved when they signed in)."""
    try:
        from .store import get_store
        u = get_store().get_user(owner) or {}
        return (u.get("name") or "").strip() or owner.split("@")[0]
    except Exception:
        return owner.split("@")[0]


def logo_html(size: int = 30, middle: str = "#ffffff") -> str:
    """The waveform-M logo as plain table cells (Gmail and Outlook don't show SVG)."""
    u = size / 64
    bars = [(44, GOLD), (22, GOLD), (32, middle), (22, GOLD), (44, GOLD)]
    cells = "".join(
        (f'<td style="width:{round(4*u)}px;font-size:0;line-height:0;"></td>' if i else "")
        + f'<td style="width:{round(7*u)}px;vertical-align:top;font-size:0;line-height:0;">'
          f'<div style="width:{round(7*u)}px;height:{round(h*u)}px;background:{c};border-radius:{round(3.5*u)}px;"></div></td>'
        for i, (h, c) in enumerate(bars))
    return (f'<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;height:{round(44*u)}px;">'
            f'<tr>{cells}</tr></table>')


def _button(href: str, label: str, primary: bool) -> str:
    style = (f"background:{INK};color:#ffffff;border:1px solid {INK};" if primary
             else f"background:#ffffff;color:{INK};border:1px solid {LINE};")
    return (f'<a href="{html.escape(href)}" style="{style}display:inline-block;text-decoration:none;padding:12px 22px;'
            f'border-radius:999px;font-weight:bold;font-size:14px;margin:4px 6px 4px 0;">{label}</a>')


def suggested_questions(analysis: dict) -> List[str]:
    """3-4 questions made from THIS meeting, shown in the email as buttons that ask the chatbot directly."""
    a = analysis or {}
    qs = []
    if a.get("key_decisions"):
        qs.append("What was decided, and why?")
    seen = set()
    for x in a.get("action_items") or []:
        who = (x.get("assignee") or "").strip()
        if who and who.lower() not in seen and len(seen) < 2:
            seen.add(who.lower())
            qs.append(f"What does {who} need to do, and by when?")
    for sec in (a.get("sections") or [])[:1]:
        if sec.get("section_title"):
            qs.append(f"What was said about “{sec['section_title']}”?")
    if a.get("unresolved_issues"):
        qs.append("What is still unresolved?")
    for fallback in ("Summarize this meeting in 3 points", "Who is responsible for what?"):
        if len(qs) < 3:
            qs.append(fallback)
    return qs[:4]


def chat_link(meeting_id: str, addr: str = "", question: str = "") -> str:
    """Opens the chatbot on this meeting. hint = the email it was sent to (so Google picks the right account);
    q = a question the chatbot asks straight away."""
    url = f"{config.APP_URL}/chat?m={meeting_id}"
    if addr:
        url += f"&hint={quote(addr)}"
    if question:
        url += f"&q={quote(question)}"
    return url


def _questions_html(meeting_id: str, addr: str, questions: List[str]) -> str:
    if not questions:
        return ""
    rows = "".join(
        f'<tr><td style="padding:0 0 8px;"><a href="{html.escape(chat_link(meeting_id, addr, q))}" '
        f'style="display:block;text-decoration:none;background:{PAPER};border:1px solid {LINE};border-radius:12px;'
        f'padding:11px 14px;color:{INK};font-size:14px;">'
        f'<span style="color:{GOLD};font-weight:bold;">&#8594;</span>&nbsp; {html.escape(q)}</a></td></tr>'
        for q in questions)
    return (f'<div style="margin:0 0 26px;padding:18px 18px 10px;border-radius:14px;background:#fbfaf6;border:1px solid {LINE};">'
            f'<p style="margin:0 0 12px;font-size:13px;color:{MUTED};text-transform:uppercase;letter-spacing:.06em;font-weight:bold;">'
            f'Ask the meeting</p><table role="presentation" style="border-collapse:collapse;width:100%;">{rows}</table></div>')


def _short_html(a: dict) -> str:
    """With the PDF attached, the email only gives the gist; the full minutes live in the PDF."""
    e = html.escape
    out = []
    if a.get("executive_summary"):
        out.append(f'<h2 style="font-size:17px;margin:0 0 8px;">Summary</h2><p style="margin:0 0 18px;">{e(a["executive_summary"])}</p>')
    dec = [d.get("decision") for d in a.get("key_decisions") or [] if d.get("decision")]
    if dec:
        out.append('<h2 style="font-size:17px;margin:0 0 8px;">Decisions</h2><ul style="margin:0 0 18px;padding-left:20px;">'
                   + "".join(f"<li>{e(x)}</li>" for x in dec[:6]) + "</ul>")
    acts = a.get("action_items") or []
    if acts:
        out.append('<h2 style="font-size:17px;margin:0 0 8px;">Action items</h2><ul style="margin:0 0 18px;padding-left:20px;">'
                   + "".join(f'<li>{e(x.get("task") or "")} — <b>{e(x.get("assignee") or "Unassigned")}</b>'
                             + (f' · {e(x["deadline"])}' if x.get("deadline") else "") + "</li>" for x in acts[:8]) + "</ul>")
    out.append(f'<p style="margin:0;color:{MUTED};">The full minutes, topic by topic, are in the attached PDF.</p>')
    return "".join(out)


def _body(title: str, summary_md: str, meeting_id: str, addr: str, owner: str, name: str,
          questions: List[str], has_pdf: bool, analysis: dict = None) -> str:
    if has_pdf:   # the full minutes are the attached PDF; the email gives the gist
        summary_html = _short_html(analysis or {})
    else:   # no PDF: the email carries the full minutes
        lines = summary_md.lstrip().splitlines()
        if lines and lines[0].startswith("# "):   # the title is already shown above
            lines = lines[1:]
        summary_html = markdown.markdown("\n".join(lines), extensions=["tables"])
    buttons = _button(chat_link(meeting_id, addr), "Ask Meetly about this meeting", True)
    pdf_note = (f'<table role="presentation" style="border-collapse:collapse;margin:-6px 0 24px;"><tr>'
                f'<td style="width:34px;height:40px;border-radius:6px;background:#e0281c;color:#fff;font-size:10px;font-weight:bold;text-align:center;">PDF</td>'
                f'<td style="padding-left:12px;font-size:14px;color:{INK};"><b>The minutes are attached</b><br>'
                f'<span style="color:{MUTED};font-size:13px;">{html.escape(title)} - Minutes.pdf</span></td></tr></table>'
                if has_pdf else "")
    initial = html.escape((name or owner or "?")[0].upper())
    return f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:{PAPER};font-family:Arial,Helvetica,sans-serif;color:{INK};">
  <div style="max-width:680px;margin:0 auto;padding:28px 16px;">
    <div style="background:{INK};border-radius:18px 18px 0 0;padding:22px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>
        <td style="vertical-align:middle;padding-right:10px;">{logo_html(30)}</td>
        <td style="vertical-align:middle;font-family:'Plus Jakarta Sans',Arial,Helvetica,sans-serif;font-weight:800;font-size:26px;letter-spacing:-1px;color:#ffffff;">Meetly</td>
      </tr></table>
    </div>
    <div style="background:#ffffff;border-radius:0 0 18px 18px;padding:30px 32px;border:1px solid {LINE};border-top:0;">
      <table role="presentation" style="border-collapse:collapse;margin:0 0 18px;"><tr>
        <td style="width:38px;height:38px;border-radius:50%;background:#ffe1dd;color:#9a1d14;text-align:center;font-weight:bold;font-size:16px;">{initial}</td>
        <td style="padding-left:12px;font-size:13px;color:{MUTED};line-height:1.4;">
          From <b style="color:{INK};">{html.escape(name)}</b><br>{html.escape(owner)}</td>
      </tr></table>
      <h1 style="font-family:'Plus Jakarta Sans',Arial,Helvetica,sans-serif;font-weight:800;letter-spacing:-.5px;margin:0 0 6px;font-size:26px;line-height:1.25;">{html.escape(title)}</h1>
      <div style="width:56px;height:2px;background:{GOLD};margin:0 0 22px;"></div>
      <div style="margin:0 0 26px;">{buttons}</div>
      {pdf_note}
      {_questions_html(meeting_id, addr, questions)}
      <div style="font-size:14px;line-height:1.65;color:{INK};">{summary_html}</div>
      <p style="margin:30px 0 0;padding-top:18px;border-top:1px solid {LINE};color:{MUTED};font-size:12px;line-height:1.5;">
        To ask about the meeting, sign in to Meetly with <b>{html.escape(addr)}</b> (the address this email was sent to).
        Replies go to {html.escape(name)}.</p>
    </div>
  </div>
</body></html>"""


def send_summary(to: List[str], title: str, summary_md: str, meeting_id: str, owner: str, log=print,
                 analysis: dict = None, pdf: bytes = b"") -> int:
    """Emails everyone; never stops the meeting from finishing. Problems are written to the meeting's log."""
    if not is_configured() or not to:
        return 0
    name = sender_name(owner)
    questions = suggested_questions(analysis)
    safe_title = "".join(c if c.isalnum() or c in " -_" else "_" for c in title).strip() or "Meeting"
    sent = 0
    try:
        ctx = ssl.create_default_context()
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=60) as smtp:
            smtp.starttls(context=ctx)
            smtp.login(config.SMTP_USER, config.SMTP_PASSWORD)
            for addr in to:
                plain = (f"From {name} ({owner})\n\nMeeting minutes: {title}\n\n"
                         + f"Ask Meetly: {chat_link(meeting_id, addr)}\n\n"
                         + "".join(f"- {q}: {chat_link(meeting_id, addr, q)}\n" for q in questions)
                         + ("\nThe minutes are attached as a PDF." if pdf else f"\n{summary_md}"))
                alt = MIMEMultipart("alternative")
                alt.attach(MIMEText(plain, "plain", "utf-8"))
                alt.attach(MIMEText(_body(title, summary_md, meeting_id, addr, owner, name, questions, bool(pdf), analysis),
                                    "html", "utf-8"))
                msg = MIMEMultipart("mixed")
                msg.attach(alt)
                if pdf:
                    part = MIMEApplication(pdf, _subtype="pdf")
                    part.add_header("Content-Disposition", "attachment", filename=f"{safe_title} - Minutes.pdf")
                    msg.attach(part)
                msg["Subject"] = f"{title} — meeting minutes from {name}"
                msg["From"] = formataddr((config.MAIL_FROM_NAME, config.SMTP_USER))   # shows as "Meetly"
                msg["To"] = addr
                msg["Reply-To"] = formataddr((name, owner))
                try:
                    smtp.sendmail(config.SMTP_USER, [addr], msg.as_string())
                    sent += 1
                except smtplib.SMTPException as e:
                    log(f"⚠️ Couldn't email {addr}: {e}")
    except smtplib.SMTPAuthenticationError:
        log("❌ Gmail refused the sign-in. Check SMTP_USER (the full Gmail address) and SMTP_PASSWORD (the 16-letter App Password).")
    except Exception as e:
        log(f"❌ Email failed: {type(e).__name__}: {e}")
    return sent
