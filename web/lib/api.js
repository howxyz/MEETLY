"use client";
// Talks to the FastAPI backend. In the preview build (NEXT_PUBLIC_MOCK=1) it answers from sample data instead,
// so every page can be tried without a server.
export const MOCK = process.env.NEXT_PUBLIC_MOCK === "1";
const PREVIEW = process.env.NEXT_PUBLIC_PREVIEW === "1";

// Page links: "/meetings" on the real site, "./meetings.html" in the static preview.
export function href(path) {
  if (!PREVIEW) return path;
  if (path.startsWith("/auth/")) return "./index.html";   // no sign-in in the preview
  const [p, rest = ""] = path.split(/(?=[?#])/);
  const name = p === "/" ? "index" : p.replace(/^\//, "");
  return `./${name}.html${rest}`;
}

export function goLogin() {
  const here = location.pathname + location.search;
  location.href = href(`/login?next=${encodeURIComponent(here)}`);
}

export async function api(path, opts = {}) {
  if (MOCK) return mockApi(path, opts);
  const r = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  if (r.status === 401) { goLogin(); throw new Error("signed out"); }
  if (!r.ok) {
    let msg = "Something went wrong.";
    try { const j = await r.json(); if (typeof j.detail === "string") msg = j.detail; } catch {}
    const e = new Error(msg); e.status = r.status; throw e;
  }
  return (r.headers.get("content-type") || "").includes("json") ? r.json() : r.text();
}

// Streams Meetly's answer, calling onChunk with each new piece of text.
export async function chatStream(meetingId, messages, onChunk) {
  if (MOCK) return mockChat(meetingId, messages, onChunk);
  const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meeting_id: meetingId, messages }) });
  if (r.status === 401) { goLogin(); return; }
  if (!r.ok) {
    let msg = "Something went wrong.";
    try { const j = await r.json(); if (typeof j.detail === "string") msg = j.detail; } catch {}
    throw new Error(msg);
  }
  const reader = r.body.getReader(), dec = new TextDecoder();
  for (;;) { const { done, value } = await reader.read(); if (done) break; onChunk(dec.decode(value, { stream: true })); }
}

export const WORKING = ["queued", "downloading", "transcribing", "analyzing", "emailing"];
export const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// ---------------------------------------------------------------- sample data (preview only)
const ME = { user: { email: "nujoom@example.com", name: "Nujoom", picture: null }, google_login: true, dev_login: false,
  email_enabled: true, limits: { max_minutes: 150, per_day: 5, max_attendees: 30 } };

const A1 = {
  title: "Weekly product sync", meeting_type: "DECISION", meeting_purpose: "Agree the launch date and unblock design.",
  executive_summary: "The team moved the launch to the first week of May so design can finish the final screens. The budget was approved with a 10% cut to marketing, to be reviewed in June. The booking form waits for the budget review.",
  participants: [{ name: "Nujoom", role: "Marketing" }, { name: "Sara", role: "Design lead" }, { name: "Omar", role: "Product" }, { name: "Lina", role: "Finance" }],
  key_decisions: [{ decision: "Launch moves to the first week of May", decided_by: "Omar" }, { decision: "Budget approved with a 10% cut to marketing", decided_by: "Lina" }],
  action_items: [{ task: "Send the final screens", assignee: "Sara", deadline: "Thursday" }, { task: "Prepare the launch checklist", assignee: "Nujoom", deadline: "Next week" }, { task: "Revisit the budget", assignee: "Lina", deadline: "June" }],
  unresolved_issues: [{ issue: "Booking form on the website", why_unresolved: "Waiting for the budget numbers." }],
  risks_and_concerns: ["Design capacity is tight before May."],
  next_steps: ["Share the revised timeline with the client", "Book a follow-up session in two weeks"],
  sections: [
    { section_title: "Launch date", time_range: "00:02:10-00:14:30", detailed_discussion: "The team weighed launching in April against the state of the final screens.", key_points: ["April is too tight for design", "May keeps marketing on track"], outcome: "Launch moves to the first week of May." },
    { section_title: "Budget", time_range: "00:14:30-00:31:05", detailed_discussion: "Finance presented the quarter's budget.", key_points: ["Marketing reduced by 10%", "Review again in June"], outcome: "Approved with changes." },
    { section_title: "Booking form", time_range: "00:52:00-00:59:40", detailed_discussion: "Sara proposed a booking form on the site.", key_points: ["Useful for leads", "Depends on budget"], outcome: "Left open." },
  ],
};
const MEETINGS = [
  { id: "m1", owner: "nujoom@example.com", title: "Weekly product sync", date: "2026-10-14", attendees: ["sara@example.com", "omar@example.com", "lina@example.com"], status: "done", duration_sec: 4472, emails_sent: 4, created_at: "2026-10-14T10:00:00Z", analysis: A1, has_pdf: true },
  { id: "m2", owner: "omar@example.com", title: "اجتماع العميل — Blue Oasis", date: "2026-10-12", attendees: ["nujoom@example.com"], status: "done", duration_sec: 2710, emails_sent: 2, created_at: "2026-10-12T09:00:00Z", analysis: { ...A1, title: "اجتماع العميل", executive_summary: "Reviewed the October content calendar with the client and agreed on three campaign themes." }, has_pdf: true },
  { id: "m3", owner: "nujoom@example.com", title: "Content calendar planning", date: "2026-10-15", attendees: ["sara@example.com"], status: "transcribing", duration_sec: 1800, emails_sent: 0, created_at: "2026-10-15T08:00:00Z" },
  { id: "m4", owner: "nujoom@example.com", title: "Q3 retrospective", date: "2026-10-01", attendees: ["omar@example.com", "lina@example.com"], status: "done", duration_sec: 3300, emails_sent: 3, created_at: "2026-10-01T12:00:00Z", analysis: { ...A1, title: "Q3 retrospective", executive_summary: "Looked back at Q3: what worked, what to stop, and three changes for Q4." }, has_pdf: true },
  { id: "m5", owner: "nujoom@example.com", title: "Agency onboarding", date: "2026-09-24", attendees: [], status: "error", error: "Could not download the Drive link. Share it as 'Anyone with the link'.", duration_sec: null, emails_sent: 0, created_at: "2026-09-24T12:00:00Z" },
];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function mockApi(path, opts) {
  await sleep(120);
  const method = (opts.method || "GET").toUpperCase();
  if (path === "/api/me") return ME;
  if (path === "/api/meetings" && method === "GET") return MEETINGS.map(m => ({ ...m, is_owner: m.owner === ME.user.email, analysis: undefined }));
  if (path === "/api/meetings" && method === "POST") return { id: "m3", status: "queued" };
  if (path === "/api/uploads") return { object: "uploads/x", url: "", method: "PUT", headers: {} };
  let m = path.match(/^\/api\/meetings\/(\w+)$/);
  if (m) {
    const x = MEETINGS.find(y => y.id === m[1]);
    if (!x) throw new Error("Meeting not found");
    if (method === "DELETE") return { ok: true };
    return { ...x, is_owner: x.owner === ME.user.email, has_transcript: x.status === "done",
      log: ["10:00:01  ⬇️ Getting the uploaded video...", "10:00:04  ⏱️ Length: 01:14:32", "10:03:44  ✉️ Sent 4/4", "10:03:44  🎉 Done"] };
  }
  if ((m = path.match(/^\/api\/meetings\/(\w+)\/transcript$/)))
    return "[00:02:10] Omar: Let's talk about the launch date first.\n[00:03:02] Sara: Honestly, April is too tight for the final screens.\n[00:12:40] Omar: Then let's move the launch to the first week of May.\n[00:21:14] Lina: Let's approve it, but cut marketing by ten percent and revisit in June.\n[00:38:05] Sara: Design will send the final screens by Thursday.\n[00:58:52] Sara: Let's not decide the booking form until we see the numbers.";
  if ((m = path.match(/^\/api\/meetings\/(\w+)\/resend$/))) {
    await sleep(900); const body = JSON.parse(opts.body || "{}");
    const x = MEETINGS.find(y => y.id === m[1]);
    const add = body.add || []; x.attendees = [...new Set([...x.attendees, ...add])];
    return { ok: true, sent: body.only_new ? add.length : x.attendees.length + 1 };
  }
  if (path.endsWith("/retry")) return { ok: true };
  return { ok: true };
}

async function mockChat(meetingId, messages, onChunk) {
  const q = (messages[messages.length - 1]?.content || "").toLowerCase();
  const ar = /[؀-ۿ]/.test(q);
  let a;
  if (/budget|ميزاني/.test(q)) a = ar ? "اعتُمدت الميزانية مع خفض التسويق ١٠٪، وتُراجع في حزيران [00:21:14]." : "The budget was approved with a 10% cut to marketing, to be reviewed in June [00:21:14].";
  else if (/task|me\b|مهام|مسؤول/.test(q)) a = ar ? "**سارة**: الشاشات النهائية قبل الخميس [00:38:05].\n\n**نجوم**: قائمة الإطلاق الأسبوع القادم [00:44:02]." : "**Sara**: the final screens by Thursday [00:38:05].\n\n**Nujoom**: the launch checklist, next week [00:44:02].";
  else if (/unresolved|open|معلق|يُحسم/.test(q)) a = ar ? "نموذج الحجز ما زال معلّقاً، بانتظار أرقام الميزانية [00:58:52]." : "The booking form is still open, waiting for the budget numbers [00:58:52].";
  else a = ar ? "١. الإطلاق في الأسبوع الأول من أيار [00:12:40].\n٢. الميزانية معتمدة مع خفض التسويق [00:21:14].\n٣. نموذج الحجز معلّق [00:58:52]." : "1. Launch moves to the first week of May [00:12:40].\n2. Budget approved with a marketing cut [00:21:14].\n3. The booking form is still open [00:58:52].";
  await sleep(350);
  for (const word of a.split(/(?<=\s)/)) { onChunk(word); await sleep(28); }
}
