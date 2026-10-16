"""Builds the Markdown / HTML summary report from the analysis."""
import markdown

STATUS_LABELS = {
    "DECIDED": "✅ Decided",
    "PENDING": "🟡 Pending",
    "INFORMATIONAL": "ℹ️ Informational / Explanation",
    "FOLLOW_UP": "🔄 Requires Follow-up",
}

TYPE_LABELS = {
    "DECISION": "Decision Meeting",
    "DEMO": "Demonstration (Demo)",
    "PRESENTATION": "Presentation",
    "STATUS_UPDATE": "Status Update",
    "DISCOVERY": "Discovery Meeting",
    "TRAINING": "Training",
    "OTHER": "Other",
}


def build_markdown(d: dict) -> str:
    """d = analysis.model_dump(mode="json")"""
    md = f"# 📋 {d.get('title', 'Meeting Summary')}\n\n"

    # --- General Information ---
    md += "> ### 🔑 Meeting Information\n>\n"
    md += f"> **Type:** `{TYPE_LABELS.get(d.get('meeting_type'), d.get('meeting_type', 'Not specified'))}`\n>\n"
    md += f"> **Purpose:** **{d.get('meeting_purpose', 'Not specified')}**\n>\n"

    if d.get("duration_note"):
        md += f"> **Duration:** `{d['duration_note']}`\n>\n"

    participants = d.get("participants", [])
    if participants:
        md += "> **Participants:**\n>\n"
        for p in participants:
            role = f" — _{p['role']}_" if p.get("role") else ""
            contrib = f" ({p['contribution']})" if p.get("contribution") else ""
            md += f"> * **{p.get('name', 'Not specified')}**{role}{contrib}\n"
        md += ">\n"

    # --- Executive Summary ---
    if d.get("executive_summary"):
        md += f"\n## 📝 Executive Summary\n\n{d['executive_summary']}\n"

    # --- Detailed Analysis by Section ---
    md += "\n---\n\n## 🔍 Detailed Analysis by Section\n"

    for s in d.get("sections", []):
        num = s.get("section_number", "?")
        title = s.get("section_title", "Untitled")
        time_range = f" · ⏱️ `{s['time_range']}`" if s.get("time_range") else ""
        status = STATUS_LABELS.get(s.get("status"), "")

        md += f"\n### {num}. {title}{time_range}\n\n"
        if status:
            md += f"**Status:** {status}\n\n"
        if s.get("purpose"):
            md += f"**Section Purpose:** {s['purpose']}\n\n"
        if s.get("key_points"):
            md += "**Key Points:**\n\n"
            for point in s["key_points"]:
                md += f"* {point}\n"
            md += "\n"
        md += "\n---\n"

    # --- Key Decisions ---
    md += "\n## 🎯 Key Decisions\n\n"
    decisions = d.get("key_decisions", [])
    if decisions:
        for dec in decisions:
            ref = f" _(Section {dec['related_section']})_" if dec.get("related_section") else ""
            md += f"* **{dec.get('decision', '')}**{ref}\n"
            if dec.get("context"):
                md += f"  * **Context:** {dec['context']}\n"
            if dec.get("decided_by"):
                md += f"  * **Decision Maker:** `{dec['decided_by']}`\n"
            md += "\n"
    else:
        md += "* No final decisions were identified.\n"

    # --- Action Items ---
    md += "\n---\n\n## 📌 Action Items\n\n"
    items = d.get("action_items", [])
    if items:
        md += "| Task | Assignee | Deadline | Section |\n"
        md += "|---|---|---|---|\n"
        for it in items:
            md += (
                f"| {it.get('task', 'Not specified')} | `{it.get('assignee') or 'Not specified'}` "
                f"| `{it.get('deadline') or 'Not specified'}` | {it.get('related_section') or '-'} |\n"
            )
        details = [it for it in items if it.get("details")]
        if details:
            md += "\n**Additional Details:**\n\n"
            for it in details:
                md += f"* **{it.get('task', '')}:** {it['details']}\n"
    else:
        md += "* No specific action items were identified.\n"

    # --- Unresolved Issues ---
    md += "\n---\n\n## ⚠️ Unresolved Issues\n\n"
    unresolved = d.get("unresolved_issues", [])
    if unresolved:
        for u in unresolved:
            ref = f" _(Section {u['related_section']})_" if u.get("related_section") else ""
            md += f"* **{u.get('issue', '')}**{ref}\n"
            if u.get("why_unresolved"):
                md += f"  * **Reason Unresolved:** {u['why_unresolved']}\n"
            if u.get("blocking"):
                md += f"  * **Blocking:** {u['blocking']}\n"
            md += "\n"
    else:
        md += "* No specific unresolved issues were identified.\n"

    # --- Risks ---
    risks = d.get("risks_and_concerns", [])
    if risks:
        md += "\n---\n\n## 🚩 Risks & Concerns\n\n"
        for r in risks:
            md += f"* {r}\n"

    # --- Next Steps ---
    steps = d.get("next_steps", [])
    if steps:
        md += "\n---\n\n## ➡️ Next Steps\n\n"
        for i, step in enumerate(steps, start=1):
            md += f"{i}. {step}\n"

    return md


def markdown_to_html(markdown_report: str) -> str:
    html_content = markdown.markdown(markdown_report, extensions=["tables"])
    return f"""<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: Arial, Calibri, sans-serif; line-height: 1.6; color: #222; padding: 20px; }}
    h1, h2, h3 {{ color: #1a73e8; border-bottom: 1px solid #e0e0e0; padding-bottom: 5px; }}
    table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
    th {{ background-color: #f1f3f4; color: #202124; font-weight: bold; padding: 10px;
          border: 1px solid #dadce0; text-align: left; }}
    td {{ padding: 8px 10px; border: 1px solid #dadce0; text-align: left; }}
    tr:nth-child(even) {{ background-color: #f8f9fa; }}
  </style>
</head>
<body>
{html_content}
</body>
</html>"""
