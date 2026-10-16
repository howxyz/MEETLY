"use client";
// Arabic / English text for every page, plus the language + theme state.
import { createContext, useCallback, useContext, useEffect, useState } from "react";

export const DICT = {
  en: {
    brand: "Meetly", lang_switch: "العربية", theme: "Theme",
    // ---- landing
    nav_story: "How it works", nav_scribe: "Ask Meetly", nav_archive: "Library", signin: "Sign in", open_app: "Your library",
    hero_kicker: "Meetly · On air",
    hero_title: "Every meeting, on the record.",
    hero_lead: "Hit record on any meeting. Meetly captures every word, writes the minutes, sends them to everyone invited, and plays back any moment you ask about.",
    cta_start: "Start with Google", cta_story: "See how it works", hero_note: "Free to try. Recordings are deleted once the minutes are ready.",
    scroll_hint: "Scroll",
    s2_kicker: "Sound in, minutes out", s2_title: "The voice goes in. The minutes come out.",
    s2_lead: "Every voice is transcribed with who spoke and the exact minute. Then Meetly writes the minutes: decisions, tasks and who owns them.",
    ms_title: "Session minutes", ms_dec: "Decisions", ms_tasks: "Tasks", ms_owners: "Owners",
    ms_l1: "The launch moves to the first week of May.", ms_l2: "Design delivers the final screens by Thursday.", ms_l3: "The booking form waits for the budget review.",
    ms_d1: "Launch: first week of May", ms_t1: "Final screens", ms_o1: "Design team", ms_t2: "Budget review", ms_o2: "Omar",
    s3_kicker: "The tracklist", s3_title: "Four tracks. One master.",
    st1_t: "Record", st1_p: "Upload the recording from your laptop or a Google Drive link, and name who attended.",
    st2_t: "Transcribe", st2_p: "Every word written down, with the speaker and the minute it was said.",
    st3_t: "Minutes", st3_p: "Summary, decisions, tasks with owners, and what is still open.",
    st4_t: "Master & send", st4_p: "The minutes are mastered into a PDF and emailed to every attendee.",
    sent_to: "Sent to 4 attendees", pdf_email: "PDF + email",
    s4_kicker: "Ask Meetly", s4_title: "Ask the recording anything.",
    s4_lead: "Answers come only from the recording, with a cue to the exact words and the minute they were said.",
    s4_try: "Try a question", scribe_ph: "Ask the recording…",
    q1: "What did we decide about the budget?", q2: "Which tasks are assigned to me?", q3: "What is still unresolved?",
    a1: "The budget was approved with a 10% cut to marketing, to be reviewed again in June.",
    a1_quote: "“Let's approve it, but cut marketing by ten percent and revisit in June.”", a1_who: "Lina", a1_ts: "00:21:14",
    a2: "Two tasks: send the final screens by Thursday, and prepare the launch checklist.",
    a2_quote: "“Nujoom, can you own the launch checklist?” “Yes, I'll have it ready.”", a2_who: "Omar", a2_ts: "00:44:02",
    a3: "The booking form. It was raised, but it waits for the budget review.",
    a3_quote: "“Let's not decide the booking form until we see the numbers.”", a3_who: "Sara", a3_ts: "00:58:52",
    margin_note: "Cue",
    s5_kicker: "The library", s5_title: "Every session, on the rack.",
    s5_lead: "Every meeting is kept as a tape. Pull one out and it opens into the full minutes.",
    open_scroll: "Play", close: "Close",
    s6_title: "We're on air.", s6_lead: "Free to try. Sign in with Google and record your first session.", s6_cta: "Start recording",
    footer_privacy: "Privacy policy",
    // ---- auth
    signin_title: "Welcome back to the studio", signin_sub: "Sign in to see your sessions and play back any moment.",
    signup_title: "Open your studio", signup_sub: "Use your Google account. It takes a few seconds.",
    tab_signin: "Sign in", tab_signup: "Create account", google_signin: "Continue with Google", google_signup: "Sign up with Google",
    auth_quote: "Stop taking notes. Hit record.", auth_fine: "We only use your name and email. Invited to a meeting? Sign in with the email the minutes were sent to.",
    dev_title: "Test mode", dev_email: "Any email", dev_go: "Enter", login_error: "Sign-in didn't complete. Please try again.",
    // ---- shell
    nav_new: "New recording", nav_archive_app: "Library", nav_chat: "Ask Meetly", sign_out: "Sign out", menu: "Menu",
    // ---- archive
    archive_title: "Library", archive_sub: "Every session you recorded or were invited to.", search: "Search the library",
    shared: "Shared with you", min: "min", people: "{n} people", no_meetings: "The rack is empty", no_meetings_p: "Record your first session and its tape will land here.",
    st_queued: "Waiting", st_downloading: "Fetching", st_transcribing: "Transcribing", st_analyzing: "Writing minutes", st_emailing: "Sending", st_done: "Ready", st_error: "Failed",
    ask_this: "Ask about it", pdf: "PDF", transcript: "Transcript", resend: "Resend minutes", retry: "Try again", del: "Delete",
    confirm_delete: "Delete this session and its minutes for everyone?",
    b_summary: "Summary", b_decisions: "Decisions", b_tasks: "Tasks", b_open: "Open matters", b_next: "Next steps", b_people: "Present", b_topics: "Matters discussed", b_log: "Activity",
    th_task: "Task", th_owner: "Owner", th_due: "Due", none: "None", unassigned: "Unassigned", no_decisions: "No final decisions were made.",
    processing: "Meetly is still on it. An hour-long meeting usually takes a few minutes.",
    tr_download: "Fetch", tr_transcribe: "Transcribe", tr_write: "Write", tr_send: "Send",
    rs_who: "Who should get the minutes?", rs_everyone: "Everyone", rs_new: "New emails only", rs_current: "Already in this session:",
    rs_add: "Add more people too (optional)", rs_add_req: "Type the new emails", rs_add_btn: "Add", rs_cancel: "Cancel",
    rs_send_all: "Send to everyone ({n})", rs_send_new: "Send to {n} new", rs_help: "New people get the minutes as a PDF and can sign in with that email to ask Meetly.",
    resent: "Sent to {n} people", sending: "Sending…", err_emails: "Fix the highlighted email.", need_email: "Add at least one email.",
    // ---- new
    new_title: "Start a new recording", new_sub: "Add the recording and who attended. Meetly writes the minutes and sends them.",
    n_step1: "The recording", n_step1_sub: "Video or audio, up to {min} minutes.", src_upload: "Upload file", src_drive: "Google Drive link",
    drop_main: "Drop the recording here", drop_sub: "or click to choose a file", change: "Change",
    drive_help: "Share the file as “Anyone with the link” first.",
    n_step2: "The session", n_step2_sub: "Who should receive the minutes?", f_title: "Session title", f_date: "Date", f_attendees: "Attendees' emails",
    email_ph: "name@company.com", attendees_help: "Each person gets the minutes as a PDF and can sign in with that email to ask Meetly.",
    f_email: "Email the minutes to the attendees", create: "Start processing", uploading: "Uploading… {p}%", starting: "Starting…",
    err_title: "Give the session a title.", err_source: "Add a recording or a Drive link.", created: "Meetly is on it. You can leave this page.",
    // ---- chat
    chat_title: "Ask Meetly", all_meetings: "All sessions", all_sub: "Ask across the whole library", choose: "Choose a session",
    chat_welcome: "Ask about “{title}”", chat_welcome_all: "Ask across all your sessions",
    chat_welcome_p: "Answers come from the recording itself, with the minute each fact was said.",
    chat_ph: "Ask the recording…", chat_note: "Answers come only from the recordings.", new_chat: "New chat",
    sugg: ["Summarize this meeting in 3 points", "What was decided?", "Who is responsible for what?", "What is still unresolved?"],
    sugg_all: ["What did we decide across all sessions?", "Which tasks are still open?", "What changed between the sessions?"],
    err: "Something went wrong. Please try again.",
    privacy: "Privacy policy",
  },
  ar: {
    brand: "Meetly", lang_switch: "English", theme: "المظهر",
    nav_story: "كيف يعمل", nav_scribe: "اسأل Meetly", nav_archive: "المكتبة", signin: "تسجيل الدخول", open_app: "مكتبتك",
    hero_kicker: "Meetly · على الهواء",
    hero_title: "كل اجتماع، مُسجَّلٌ بدقة.",
    hero_lead: "اضغط تسجيل على أي اجتماع. يلتقط Meetly كل كلمة، ويكتب المحضر ويرسله لكل من حضر، ويعيد لك أي لحظة تسأل عنها.",
    cta_start: "ابدأ بحساب Google", cta_story: "شاهد كيف يعمل", hero_note: "مجاني للتجربة. تُحذف التسجيلات فور جاهزية المحضر.",
    scroll_hint: "مرّر",
    s2_kicker: "يدخل الصوت، ويخرج المحضر", s2_title: "الصوت يدخل، والمحضر يخرج.",
    s2_lead: "يُفرَّغ كل صوت مع اسم المتحدث والدقيقة بالضبط، ثم يكتب Meetly المحضر: القرارات، والمهام، ومن المسؤول عنها.",
    ms_title: "محضر الجلسة", ms_dec: "القرارات", ms_tasks: "المهام", ms_owners: "المسؤولون",
    ms_l1: "يُؤجَّل الإطلاق إلى الأسبوع الأول من أيار.", ms_l2: "يسلّم فريق التصميم الشاشات النهائية قبل الخميس.", ms_l3: "نموذج الحجز ينتظر مراجعة الميزانية.",
    ms_d1: "الإطلاق: الأسبوع الأول من أيار", ms_t1: "الشاشات النهائية", ms_o1: "فريق التصميم", ms_t2: "مراجعة الميزانية", ms_o2: "عمر",
    s3_kicker: "قائمة المسارات", s3_title: "أربعة مسارات، ونسخة نهائية واحدة.",
    st1_t: "التسجيل", st1_p: "ارفع التسجيل من جهازك أو برابط Google Drive، واذكر من حضر.",
    st2_t: "التفريغ", st2_p: "كل كلمة مكتوبة، مع المتحدث والدقيقة التي قيلت فيها.",
    st3_t: "المحضر", st3_p: "ملخص، وقرارات، ومهام مع المسؤولين عنها، وما بقي معلّقاً.",
    st4_t: "الإنتاج والإرسال", st4_p: "يُجهَّز المحضر ملفَّ PDF ويُرسل لكل الحضور بالبريد.",
    sent_to: "أُرسل إلى ٤ حضور", pdf_email: "PDF + بريد",
    s4_kicker: "اسأل Meetly", s4_title: "اسأل التسجيل عن أي شيء.",
    s4_lead: "الإجابات من التسجيل وحده، مع إشارة إلى الكلمات نفسها والدقيقة التي قيلت فيها.",
    s4_try: "جرّب سؤالاً", scribe_ph: "اسأل التسجيل…",
    q1: "ماذا قررنا عن الميزانية؟", q2: "ما المهام المسندة إليّ؟", q3: "ما الذي لم يُحسم بعد؟",
    a1: "اعتُمدت الميزانية مع خفض التسويق ١٠٪، على أن تُراجع مجدداً في حزيران.",
    a1_quote: "«لنعتمدها، لكن نخفض التسويق عشرة بالمئة ونراجعها في حزيران.»", a1_who: "لينا", a1_ts: "00:21:14",
    a2: "مهمتان: تسليم الشاشات النهائية قبل الخميس، وتجهيز قائمة الإطلاق.",
    a2_quote: "«نجوم، هل تتولين قائمة الإطلاق؟» «نعم، سأجهزها.»", a2_who: "عمر", a2_ts: "00:44:02",
    a3: "نموذج الحجز. طُرح، لكنه ينتظر مراجعة الميزانية.",
    a3_quote: "«لن نحسم نموذج الحجز قبل أن نرى الأرقام.»", a3_who: "سارة", a3_ts: "00:58:52",
    margin_note: "المقطع",
    s5_kicker: "المكتبة", s5_title: "كل جلسة على الرف.",
    s5_lead: "يُحفظ كل اجتماع شريطاً. اسحب واحداً فينفتح على المحضر كاملاً.",
    open_scroll: "شغّل", close: "إغلاق",
    s6_title: "نحن على الهواء.", s6_lead: "مجاني للتجربة. ادخل بحساب Google وسجّل جلستك الأولى.", s6_cta: "ابدأ التسجيل",
    footer_privacy: "سياسة الخصوصية",
    signin_title: "أهلاً بعودتك إلى الاستوديو", signin_sub: "سجّل دخولك لترى جلساتك وتسترجع أي لحظة.",
    signup_title: "افتح الاستوديو الخاص بك", signup_sub: "استخدم حساب Google. يستغرق ثواني.",
    tab_signin: "تسجيل الدخول", tab_signup: "حساب جديد", google_signin: "المتابعة بحساب Google", google_signup: "التسجيل بحساب Google",
    auth_quote: "توقّف عن تدوين الملاحظات. اضغط تسجيل.", auth_fine: "نستخدم اسمك وبريدك فقط. دُعيت إلى اجتماع؟ سجّل بالبريد الذي وصلك عليه المحضر.",
    dev_title: "وضع التجربة", dev_email: "أي بريد", dev_go: "دخول", login_error: "لم يكتمل تسجيل الدخول. حاول مرة أخرى.",
    nav_new: "تسجيل جديد", nav_archive_app: "المكتبة", nav_chat: "اسأل Meetly", sign_out: "تسجيل الخروج", menu: "القائمة",
    archive_title: "المكتبة", archive_sub: "كل جلسة سجّلتها أو دُعيت إليها.", search: "ابحث في المكتبة",
    shared: "مشارك معك", min: "د", people: "{n} أشخاص", no_meetings: "الرف فارغ", no_meetings_p: "سجّل جلستك الأولى وسيستقر شريطها هنا.",
    st_queued: "بالانتظار", st_downloading: "جلب", st_transcribing: "تفريغ", st_analyzing: "كتابة المحضر", st_emailing: "إرسال", st_done: "جاهز", st_error: "فشل",
    ask_this: "اسأل عن الاجتماع", pdf: "PDF", transcript: "التفريغ", resend: "إعادة إرسال المحضر", retry: "حاول مجدداً", del: "حذف",
    confirm_delete: "حذف هذه الجلسة ومحضرها عند الجميع؟",
    b_summary: "الملخص", b_decisions: "القرارات", b_tasks: "المهام", b_open: "أمور معلّقة", b_next: "الخطوات التالية", b_people: "الحضور", b_topics: "ما نوقش", b_log: "السجل",
    th_task: "المهمة", th_owner: "المسؤول", th_due: "الموعد", none: "لا يوجد", unassigned: "غير محدد", no_decisions: "لم تُتخذ قرارات نهائية.",
    processing: "Meetly ما زال يعمل. اجتماع الساعة يستغرق عادةً بضع دقائق.",
    tr_download: "الجلب", tr_transcribe: "التفريغ", tr_write: "الكتابة", tr_send: "الإرسال",
    rs_who: "لمن تُرسل المحضر؟", rs_everyone: "للجميع", rs_new: "لعناوين جديدة فقط", rs_current: "موجودون في الجلسة:",
    rs_add: "أضف أشخاصاً آخرين (اختياري)", rs_add_req: "اكتب العناوين الجديدة", rs_add_btn: "أضف", rs_cancel: "إلغاء",
    rs_send_all: "أرسل للجميع ({n})", rs_send_new: "أرسل إلى {n} جدد", rs_help: "يصل المحضر للجدد ملفَّ PDF، ويمكنهم الدخول بالبريد نفسه وسؤال Meetly.",
    resent: "أُرسل إلى {n} أشخاص", sending: "جارٍ الإرسال…", err_emails: "صحّح البريد المعلَّم.", need_email: "أضف بريداً واحداً على الأقل.",
    new_title: "ابدأ تسجيلاً جديداً", new_sub: "أضف التسجيل ومن حضر، ويكتب Meetly المحضر ويرسله.",
    n_step1: "التسجيل", n_step1_sub: "فيديو أو صوت، حتى {min} دقيقة.", src_upload: "رفع ملف", src_drive: "رابط Google Drive",
    drop_main: "اسحب التسجيل إلى هنا", drop_sub: "أو اضغط لاختيار ملف", change: "تغيير",
    drive_help: "شارك الملف كـ «Anyone with the link» أولاً.",
    n_step2: "الجلسة", n_step2_sub: "من يجب أن يصله المحضر؟", f_title: "عنوان الجلسة", f_date: "التاريخ", f_attendees: "بريد الحضور",
    email_ph: "name@company.com", attendees_help: "يصل المحضر لكل شخص ملفَّ PDF، ويمكنه الدخول بالبريد نفسه وسؤال Meetly.",
    f_email: "أرسل المحضر للحضور بالبريد", create: "ابدأ المعالجة", uploading: "جارٍ الرفع… {p}%", starting: "جارٍ البدء…",
    err_title: "اكتب عنواناً للجلسة.", err_source: "أضف تسجيلاً أو رابط Drive.", created: "بدأ Meetly العمل. يمكنك مغادرة الصفحة.",
    chat_title: "اسأل Meetly", all_meetings: "كل الجلسات", all_sub: "اسأل في المكتبة كلها", choose: "اختر جلسة",
    chat_welcome: "اسأل عن «{title}»", chat_welcome_all: "اسأل في كل جلساتك",
    chat_welcome_p: "الإجابات من التسجيل نفسه، مع الدقيقة التي قيلت فيها كل معلومة.",
    chat_ph: "اسأل التسجيل…", chat_note: "الإجابات من التسجيلات فقط.", new_chat: "محادثة جديدة",
    sugg: ["لخّص الاجتماع في ثلاث نقاط", "ماذا تقرر؟", "من المسؤول عن ماذا؟", "ما الذي لم يُحسم؟"],
    sugg_all: ["ماذا قررنا في كل الجلسات؟", "ما المهام التي لم تُنجز؟", "ما الذي تغيّر بين الجلسات؟"],
    err: "حدث خطأ. حاول مرة أخرى.",
    privacy: "سياسة الخصوصية",
  },
};

const Ctx = createContext(null);
const read = k => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

export function Providers({ children }) {
  const [lang, setLangState] = useState("en");
  const [theme, setThemeState] = useState("dark");
  useEffect(() => {
    const l = read("lang"); setLangState(l === "ar" || l === "en" ? l : (navigator.language || "").startsWith("ar") ? "ar" : "en");
    const th = read("theme"); setThemeState(th === "dark" || th === "light" ? th : "dark");   // the studio is dark by default
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  useEffect(() => {
    // snap, don't smear: no transitions while every colour changes at once
    const st = document.createElement("style"); st.textContent = "*,*::before,*::after{transition:none!important}";
    document.head.append(st); document.documentElement.dataset.theme = theme; void document.body.offsetHeight;
    requestAnimationFrame(() => st.remove());
  }, [theme]);
  const setLang = useCallback(l => { setLangState(l); write("lang", l); }, []);
  const setTheme = useCallback(th => { setThemeState(th); write("theme", th); }, []);
  const t = useCallback((key, vars = {}) => {
    let s = DICT[lang][key] ?? DICT.en[key] ?? key;
    if (typeof s === "string") for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
    return s;
  }, [lang]);
  return <Ctx.Provider value={{ lang, setLang, theme, setTheme, t }}>{children}</Ctx.Provider>;
}
export const useI18n = () => useContext(Ctx);
