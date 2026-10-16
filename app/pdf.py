"""The meeting minutes as a Meetly-branded PDF, made on the server (no Google Docs).

Studio look, matching the website: black, signal red, paper white, the waveform-M logo,
Space Grotesk / Inter / JetBrains Mono, and IBM Plex Sans Arabic. Arabic meetings come out right-to-left.
Needs WeasyPrint (pip) and Pango (system library; see colab_run.py and the Dockerfiles).
"""
import html
import re
from pathlib import Path

from . import config

FONTS = Path(__file__).resolve().parent / "fonts"
BLACK, PAPER, SIGNAL, SIGNAL_DARK, MUTED, LINE, SOFT = "#0a0a0a", "#f5f5f0", "#ff3b2f", "#c4241a", "#6b6b66", "#e6e5e0", "#f7f6f3"

LABELS = {
    "en": {"kicker": "Meeting minutes", "date": "Date", "length": "Length", "organizer": "Organizer", "attendees": "Attendees",
           "summary": "Summary", "decisions": "Decisions", "actions": "Action items", "task": "Task", "owner": "Owner", "due": "Due",
           "issues": "Open issues", "next": "Next steps", "people": "Participants", "topics": "Discussion, topic by topic",
           "outcome": "Outcome", "no_decisions": "No final decisions were made.", "no_actions": "No action items were assigned.",
           "unassigned": "Unassigned", "min": "min", "ask_t": "Ask Meetly about this meeting",
           "ask_p": "Every answer comes from the recording, with the minute it was said.", "page": "Page",
           "made": "Written by Meetly from the meeting recording.", "people_n": "{n} people", "why": "Why"},
    "ar": {"kicker": "محضر الاجتماع", "date": "التاريخ", "length": "المدة", "organizer": "المنظّم", "attendees": "الحضور",
           "summary": "الملخص", "decisions": "القرارات", "actions": "المهام", "task": "المهمة", "owner": "المسؤول", "due": "الموعد",
           "issues": "أمور معلّقة", "next": "الخطوات التالية", "people": "المشاركون", "topics": "النقاش، موضوعاً موضوعاً",
           "outcome": "النتيجة", "no_decisions": "لم تُتخذ قرارات نهائية.", "no_actions": "لم تُسند مهام.",
           "unassigned": "غير محدد", "min": "دقيقة", "ask_t": "اسأل Meetly عن هذا الاجتماع",
           "ask_p": "كل إجابة من التسجيل نفسه، مع الدقيقة التي قيلت فيها.", "page": "صفحة",
           "made": "كتبه Meetly من تسجيل الاجتماع.", "people_n": "{n} أشخاص", "why": "السبب"},
}

# the waveform M: five bars hanging from the top, the middle one in paper white
BARS = [(10, 54), (21, 32), (32, 42), (43, 32), (54, 54)]


def _logo_svg(size: int = 30, middle: str = PAPER) -> str:
    rects = "".join(f'<rect x="{x - 3.5}" y="10" width="7" height="{y2 - 10}" rx="3.5" fill="{middle if i == 2 else SIGNAL}"/>'
                    for i, (x, y2) in enumerate(BARS))
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 64 64">{rects}</svg>'


def _logo_data_uri(middle: str) -> str:
    from urllib.parse import quote
    return "data:image/svg+xml," + quote(_logo_svg(12, middle))


def is_arabic(a: dict) -> bool:
    """The minutes follow the meeting's language: Arabic if most letters in the summary are Arabic."""
    text = " ".join(str(a.get(k) or "") for k in ("executive_summary", "title", "meeting_purpose"))
    ar = len(re.findall(r"[؀-ۿ]", text))
    lat = len(re.findall(r"[A-Za-z]", text))
    return ar > lat


def _e(s) -> str:
    return html.escape(str(s or ""))


def _ts(s) -> str:
    """A timecode chip; always left-to-right, even inside Arabic text."""
    return f'<span class="ts" dir="ltr">{_e(s)}</span>'


def _h(label: str, count=None) -> str:
    c = f'<span class="count">{count}</span>' if count is not None else ""
    return f'<h2><span class="dot"></span>{_e(label)}{c}</h2>'


def build_html(m: dict, a: dict, owner_name: str) -> str:
    ar = is_arabic(a)
    L = LABELS["ar" if ar else "en"]
    title = a.get("title") or m.get("title") or "Meeting"
    date = m.get("date") or (m.get("created_at") or "")[:10]
    mins = round((m.get("duration_sec") or 0) / 60)
    attendees = [x for x in (m.get("attendees") or []) if x]
    owner = m.get("owner") or ""
    link = f"{config.APP_URL}/chat?m={m.get('id')}"

    meta = [(L["date"], f'<span dir="ltr">{_e(date)}</span>'),
            (L["length"], f"{mins} {L['min']}" if mins else _e(a.get("duration_note") or "—")),
            (L["organizer"], f'{_e(owner_name)}<small dir="ltr">{_e(owner)}</small>')]

    out = [f'<header class="cover">'
           f'<div class="brand">{_logo_svg(26)}<span class="word">Meetly</span><span class="kick"><i></i>{_e(L["kicker"])}</span></div>'
           f'<h1>{_e(title)}</h1>'
           + (f'<p class="purpose">{_e(a["meeting_purpose"])}</p>' if a.get("meeting_purpose") else "")
           + '</header>',
           '<table class="meta"><tr>' + "".join(f'<td><span class="k">{k}</span><span class="v">{v}</span></td>' for k, v in meta) + "</tr></table>"]

    if a.get("executive_summary"):
        out += [_h(L["summary"]), f'<p class="lead">{_e(a["executive_summary"])}</p>']

    decisions = [d for d in a.get("key_decisions") or [] if d.get("decision")]
    out.append(_h(L["decisions"], len(decisions)))
    if decisions:
        out.append('<ul class="marks dec">' + "".join(
            f'<li><b>{_e(d["decision"])}</b>'
            + (f'<small>{_e(d.get("context"))}</small>' if d.get("context") else "")
            + (f'<small class="by">— {_e(d["decided_by"])}</small>' if d.get("decided_by") else "") + "</li>"
            for d in decisions) + "</ul>")
    else:
        out.append(f'<p class="none">{L["no_decisions"]}</p>')

    actions = a.get("action_items") or []
    out.append(_h(L["actions"], len(actions)))
    if actions:
        rows = "".join(
            f'<tr><td><span class="n" dir="ltr">{i:02d}</span></td><td>{_e(x.get("task"))}'
            + (f'<small>{_e(x["details"])}</small>' if x.get("details") else "")
            + f'</td><td class="owner">{_e(x.get("assignee") or L["unassigned"])}</td>'
              f'<td>{_e(x.get("deadline") or "—")}</td></tr>'
            for i, x in enumerate(actions, 1))
        out.append(f'<table class="tasks"><thead><tr><th></th><th>{L["task"]}</th><th>{L["owner"]}</th><th>{L["due"]}</th></tr></thead>'
                   f'<tbody>{rows}</tbody></table>')
    else:
        out.append(f'<p class="none">{L["no_actions"]}</p>')

    issues = [f'<b>{_e(u.get("issue"))}</b>' + (f'<small>{_e(u["why_unresolved"])}</small>' if u.get("why_unresolved") else "")
              for u in a.get("unresolved_issues") or [] if u.get("issue")] + [_e(r) for r in a.get("risks_and_concerns") or [] if r]
    if issues:
        out += [_h(L["issues"], len(issues)), '<ul class="marks warn">' + "".join(f"<li>{x}</li>" for x in issues) + "</ul>"]

    steps = [s for s in a.get("next_steps") or [] if s]
    if steps:
        out += [_h(L["next"]), '<ol class="steps">' + "".join(
            f'<li><span class="n" dir="ltr">{i:02d}</span><span>{_e(s)}</span></li>' for i, s in enumerate(steps, 1)) + "</ol>"]

    people = [p for p in a.get("participants") or [] if p.get("name")]
    if people:
        out += [_h(L["people"], len(people)), '<div class="people">' + "".join(
            f'<span class="chip"><i>{_e(p["name"][:1].upper())}</i>{_e(p["name"])}'
            + (f'<small>{_e(p["role"])}</small>' if p.get("role") else "") + "</span>" for p in people) + "</div>"]

    sections = a.get("sections") or []
    if sections:
        out.append(_h(L["topics"], len(sections)))
        for i, s in enumerate(sections, 1):
            tr = s.get("time_range")
            tr = _ts(re.sub(r"\s*(?:-|–|to)\s*", " – ", tr)) if tr else ""
            out.append(f'<section class="topic"><div class="t-head"><span class="trk" dir="ltr">TRK {i:02d}</span>'
                       f'<h3>{_e(s.get("section_title"))}</h3>{tr}</div>')
            if s.get("detailed_discussion"):
                out.append(f'<p>{_e(s["detailed_discussion"])}</p>')
            if s.get("key_points"):
                out.append('<ul class="pts">' + "".join(f"<li>{_e(k)}</li>" for k in s["key_points"] if k) + "</ul>")
            if s.get("outcome"):
                out.append(f'<div class="outcome"><span>{L["outcome"]}</span>{_e(s["outcome"])}</div>')
            out.append("</section>")

    out.append(f'<div class="ask"><div>{_logo_svg(30)}</div><div><b>{L["ask_t"]}</b><p>{L["ask_p"]}</p>'
               f'<a href="{_e(link)}" dir="ltr">{_e(link)}</a></div></div>')
    out.append(f'<p class="made">{L["made"]}</p>')

    return _page(title, "".join(out), ar, L)


def _fonts_css() -> str:
    faces = [("M Display", "space-grotesk-latin-500-normal", 500), ("M Display", "space-grotesk-latin-700-normal", 700),
             ("M Text", "inter-latin-400-normal", 400), ("M Text", "inter-latin-600-normal", 600),
             ("M Mono", "jetbrains-mono-latin-500-normal", 500), ("M Mono", "jetbrains-mono-latin-700-normal", 700),
             ("M Arabic", "ibm-plex-sans-arabic-arabic-400-normal", 400), ("M Arabic", "ibm-plex-sans-arabic-arabic-600-normal", 600),
             ("M Arabic", "ibm-plex-sans-arabic-arabic-700-normal", 700)]
    return "".join(f'@font-face{{font-family:"{fam}";src:url("{(FONTS / f"{file}.woff").as_uri()}");font-weight:{w};}}'
                   for fam, file, w in faces)


def _page(title: str, body: str, ar: bool, L: dict) -> str:
    text = '"M Arabic", "M Text"' if ar else '"M Text", "M Arabic"'
    display = '"M Arabic", "M Display"' if ar else '"M Display", "M Arabic"'
    start, end = ("right", "left") if ar else ("left", "right")
    css = f"""
{_fonts_css()}
@page {{
  size: A4; margin: 18mm 16mm 20mm;
  @bottom-{start} {{ content: url("{_logo_data_uri(BLACK)}") "  Meetly · " string(title); font: 500 7.5pt "M Mono", "M Arabic";
                    color: {MUTED}; letter-spacing: .06em; vertical-align: middle; }}
  @bottom-{end} {{ content: {'counter(pages, decimal-leading-zero) " / " counter(page, decimal-leading-zero)' if ar else 'counter(page, decimal-leading-zero) " / " counter(pages, decimal-leading-zero)'};
                  font: 700 7.5pt "M Mono"; color: {SIGNAL_DARK}; letter-spacing: .1em; }}
}}
@page :first {{ @bottom-{start} {{ content: url("{_logo_data_uri(BLACK)}") "  Meetly"; }} }}
* {{ box-sizing: border-box; }}
html {{ font: 400 10pt/1.6 {text}; color: {BLACK}; }}
body {{ margin: 0; }}
h1 {{ string-set: title content(); }}
b {{ font-weight: 600; }}
small {{ display: block; color: {MUTED}; font-size: 8.5pt; line-height: 1.45; margin-top: 1.5pt; }}
.ts {{ display: inline-block; font: 500 7.5pt/1 "M Mono"; color: {SIGNAL_DARK}; background: #ffe9e6; padding: 3pt 5pt; border-radius: 3pt;
      white-space: nowrap; unicode-bidi: isolate; }}

.cover {{ background: {BLACK}; color: {PAPER}; border-radius: 12pt; padding: 18pt 22pt 20pt; position: relative; }}
.cover::after {{ content: ""; position: absolute; top: 0; {start}: 22pt; width: 46pt; height: 3pt; background: {SIGNAL}; border-radius: 0 0 2pt 2pt; }}
.brand {{ display: flex; align-items: center; gap: 6pt; }}
.brand svg {{ width: 20pt; height: 20pt; }}
.brand .word {{ font: 700 14pt/1 "M Display"; letter-spacing: -.03em; }}
.brand .kick {{ margin-{start}: auto; display: flex; align-items: center; gap: 5pt; font: 700 7pt/1 "M Mono", "M Arabic"; letter-spacing: .22em;
               text-transform: uppercase; color: {SIGNAL}; border: 1pt solid {SIGNAL}; border-radius: 3pt; padding: 4pt 7pt; white-space: nowrap; }}
{'.brand .kick { letter-spacing: 0; font: 700 8pt/1 "M Arabic"; }' if ar else ''}
.brand .kick i {{ width: 4.5pt; height: 4.5pt; border-radius: 50%; background: {SIGNAL}; }}
h1 {{ font: 700 24pt/1.12 {display}; letter-spacing: {'0' if ar else '-.03em'}; margin: 16pt 0 0; }}
.purpose {{ margin: 6pt 0 0; color: #b9b9b2; font-size: 10.5pt; }}

.meta {{ width: 100%; border-collapse: separate; border-spacing: 5pt 0; margin: 10pt -5pt 0; }}
.meta td {{ background: {SOFT}; border: 1pt solid {LINE}; border-radius: 8pt; padding: 7pt 9pt; vertical-align: top; width: 33.33%; }}
.meta .k {{ display: block; font: 500 6.5pt/1 "M Mono", "M Arabic"; letter-spacing: .16em; text-transform: uppercase; color: {MUTED}; margin-bottom: 4pt; }}
{'.meta .k { letter-spacing: 0; font: 600 7.5pt/1.2 "M Arabic"; }' if ar else ''}
.meta .v {{ font-weight: 600; font-size: 9.5pt; }}
.meta small {{ font-weight: 400; font-size: 7.5pt; word-break: break-all; }}

h2 {{ display: flex; align-items: center; gap: 6pt; font: 500 7.5pt/1 "M Mono", "M Arabic"; letter-spacing: .18em; text-transform: uppercase;
     color: {MUTED}; margin: 20pt 0 9pt; page-break-after: avoid; }}
{'h2 { letter-spacing: 0; font: 700 9.5pt/1.2 "M Arabic"; }' if ar else ''}
h2::after {{ content: ""; flex: 1; height: .75pt; background: {LINE}; }}
h2 .dot {{ width: 5pt; height: 5pt; border-radius: 50%; background: {SIGNAL}; }}
h2 .count {{ font: 500 7pt/1 "M Mono"; color: {BLACK}; background: {SOFT}; border: .75pt solid {LINE}; padding: 2.5pt 5pt; border-radius: 99pt; letter-spacing: 0; }}

.lead {{ font: 500 12pt/1.6 {display}; letter-spacing: {'0' if ar else '-.01em'}; margin: 0; padding-{start}: 11pt; border-{start}: 2.5pt solid {SIGNAL}; }}
.none {{ color: {MUTED}; font-style: italic; margin: 0; }}

ul.marks {{ list-style: none; margin: 0; padding: 0; }}
ul.marks li {{ position: relative; padding-{start}: 17pt; margin-bottom: 7pt; page-break-inside: avoid; }}
ul.marks li::before {{ content: ""; position: absolute; {start}: 0; top: 3.5pt; width: 9pt; height: 9pt; border-radius: 50%; }}
ul.dec li::before {{ background: {SIGNAL}; box-shadow: 0 0 0 2.5pt #ffe1dd; }}
ul.warn li::before {{ border: 1.75pt solid #d98a0b; width: 6pt; height: 6pt; top: 4pt; }}
small.by {{ font-family: "M Mono", "M Arabic"; font-size: 7.5pt; }}

table.tasks {{ width: 100%; border-collapse: collapse; font-size: 9.5pt; }}
table.tasks th {{ background: {BLACK}; color: {PAPER}; font: 500 6.5pt/1 "M Mono", "M Arabic"; letter-spacing: .16em; text-transform: uppercase;
                 padding: 7pt 8pt; text-align: {start}; }}
{'table.tasks th { letter-spacing: 0; font: 600 8pt/1.2 "M Arabic"; }' if ar else ''}
table.tasks th:first-child {{ border-radius: {'0 6pt 0 0' if ar else '6pt 0 0 0'}; width: 24pt; }}
table.tasks th:last-child {{ border-radius: {'6pt 0 0 0' if ar else '0 6pt 0 0'}; }}
table.tasks td {{ padding: 7pt 8pt; border-bottom: .75pt solid {LINE}; vertical-align: top; text-align: {start}; }}
table.tasks tr {{ page-break-inside: avoid; }}
table.tasks tbody tr:nth-child(even) td {{ background: #fbfaf8; }}
table.tasks .owner {{ font-weight: 600; white-space: nowrap; }}
.n {{ font: 700 7.5pt/1.9 "M Mono"; color: {SIGNAL_DARK}; }}

ol.steps {{ list-style: none; margin: 0; padding: 0; }}
ol.steps li {{ display: flex; gap: 9pt; margin-bottom: 6pt; page-break-inside: avoid; }}

.people {{ display: flex; flex-wrap: wrap; gap: 5pt; }}
.chip {{ display: inline-flex; align-items: center; gap: 5pt; border: .75pt solid {LINE}; background: {SOFT}; border-radius: 99pt;
        padding: 3pt 9pt 3pt 3pt; font-size: 9pt; font-weight: 600; }}
{'.chip { padding: 3pt 3pt 3pt 9pt; }' if ar else ''}
.chip i {{ display: inline-block; flex: none; width: 15pt; height: 15pt; border-radius: 50%; background: {BLACK}; color: {PAPER}; font: 700 7pt/15pt "M Mono", "M Arabic";
          text-align: center; font-style: normal; }}
.chip small {{ display: inline; margin: 0; font-weight: 400; font-size: 8pt; white-space: nowrap; }}

.topic {{ border: .75pt solid {LINE}; border-radius: 10pt; padding: 11pt 13pt 12pt; margin-bottom: 9pt; page-break-inside: avoid; }}
.t-head {{ display: flex; align-items: baseline; gap: 8pt; margin-bottom: 6pt; }}
.trk {{ font: 700 6.5pt/1 "M Mono"; letter-spacing: .16em; color: {SIGNAL_DARK}; border: .75pt solid #ffb3ac; border-radius: 3pt; padding: 3.5pt 5pt; }}
h3 {{ font: 700 11.5pt/1.3 {display}; letter-spacing: {'0' if ar else '-.015em'}; margin: 0; flex: 1; }}
.topic p {{ margin: 0 0 6pt; color: #33332f; }}
ul.pts {{ margin: 0 0 6pt; padding-{start}: 13pt; color: #33332f; }}
ul.pts li {{ margin-bottom: 2pt; }}
ul.pts li::marker {{ color: {SIGNAL}; }}
.outcome {{ background: {BLACK}; color: {PAPER}; border-radius: 7pt; padding: 7pt 10pt; font-size: 9.5pt; font-weight: 600; }}
.outcome span {{ font: 700 6.5pt/1 "M Mono", "M Arabic"; letter-spacing: .18em; text-transform: uppercase; color: {SIGNAL}; margin-{end}: 7pt; }}
{'.outcome span { letter-spacing: 0; font: 700 8pt/1 "M Arabic"; }' if ar else ''}

.ask {{ display: flex; gap: 12pt; align-items: center; margin-top: 22pt; background: {BLACK}; color: {PAPER}; border-radius: 12pt; padding: 14pt 18pt;
       page-break-inside: avoid; position: relative; }}
.ask::after {{ content: ""; position: absolute; top: 0; {start}: 18pt; width: 40pt; height: 3pt; background: {SIGNAL}; }}
.ask svg {{ width: 26pt; height: 26pt; }}
.ask b {{ font: 700 12pt/1.3 {display}; }}
.ask p {{ margin: 2pt 0 4pt; color: #b9b9b2; font-size: 9pt; }}
.ask a {{ color: {SIGNAL}; font: 500 8pt "M Mono"; text-decoration: none; word-break: break-all; }}
.made {{ text-align: center; color: {MUTED}; font-size: 8pt; margin-top: 10pt; }}
"""
    return (f'<!DOCTYPE html><html lang="{"ar" if ar else "en"}" dir="{"rtl" if ar else "ltr"}"><head><meta charset="utf-8">'
            f'<title>{_e(title)} — Meetly</title><style>{css}</style></head><body>{body}</body></html>')


def build_pdf(m: dict, analysis: dict, owner_name: str, log=print) -> bytes:
    """Returns the PDF, or b"" if it couldn't be made (the email then carries the minutes as text)."""
    try:
        from weasyprint import HTML
        return HTML(string=build_html(m, analysis or {}, owner_name), base_url=str(FONTS)).write_pdf()
    except Exception as e:
        log(f"⚠️ Couldn't make the PDF: {type(e).__name__}: {str(e)[:200]}")
        return b""
