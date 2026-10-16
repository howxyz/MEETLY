"use client";
import { useI18n } from "@/lib/i18n";
import { href } from "@/lib/api";
import Brand from "@/components/Logo";
import Icon from "@/components/Icon";

const EN = [
  ["What we collect", ["Your name, email address and profile picture from Google when you sign in.", "The meeting recordings you upload, and the email addresses of the attendees you enter.", "The transcript and minutes we create from each recording, and the questions you ask about it."]],
  ["How we use it", ["To transcribe the recording and write the minutes, using Google Gemini and OpenAI.", "To email the minutes, as a PDF, to the attendees you listed.", "To let you and those attendees sign in and ask questions about the meeting."]],
  ["What we keep", ["Recordings are deleted as soon as the minutes are ready (or after 3 days if processing fails). Transcripts and minutes stay until the person who created the meeting deletes it. Only that person and the attendees they listed can see a meeting."]],
  ["What we don't do", ["We don't sell your data or use it for advertising. We only read your name and email from your Google account."]],
  ["Contact", ["To delete your data or ask a question, reply to any email from Meetly."]],
];
const AR = [
  ["ما نجمعه", ["اسمك وبريدك الإلكتروني وصورتك من Google عند تسجيل الدخول.", "تسجيلات الاجتماعات التي ترفعها، وعناوين بريد الحضور التي تكتبها.", "التفريغ والمحضر اللذان ننشئهما من كل تسجيل، والأسئلة التي تطرحها عنه."]],
  ["كيف نستخدمه", ["لتفريغ التسجيل وكتابة المحضر، باستخدام Google Gemini و OpenAI.", "لإرسال المحضر ملفَّ PDF بالبريد إلى الحضور الذين ذكرتهم.", "لتتمكن أنت والحضور من تسجيل الدخول وطرح الأسئلة عن الاجتماع."]],
  ["ما نحتفظ به", ["تُحذف التسجيلات فور جاهزية المحضر (أو بعد ٣ أيام إن فشلت المعالجة). يبقى التفريغ والمحضر حتى يحذفهما صاحب الاجتماع. لا يرى الاجتماع إلا صاحبه والحضور الذين ذكرهم."]],
  ["ما لا نفعله", ["لا نبيع بياناتك ولا نستخدمها للإعلانات. ولا نقرأ من حساب Google إلا اسمك وبريدك."]],
  ["تواصل", ["لحذف بياناتك أو لأي سؤال، ردّ على أي بريد وصلك من Meetly."]],
];

export default function Privacy() {
  const { t, lang, setLang } = useI18n();
  const S = lang === "ar" ? AR : EN;
  return (
    <div className="policy-wrap">
      <header className="policy-nav"><Brand href={href("/")} /><span style={{ flex: 1 }} />
        <button className="btn ghost sm" type="button" onClick={() => setLang(lang === "ar" ? "en" : "ar")}><Icon name="globe" />{t("lang_switch")}</button></header>
      <article className="policy sheet ruled">
        <span className="kicker">{t("brand")}</span>
        <h1 className="display">{t("privacy")}</h1>
        <p className="muted">{lang === "ar" ? "آخر تحديث: تشرين الأول ٢٠٢٦" : "Last updated: October 2026"}</p>
        {S.map(([h, ps]) => (
          <section key={h}><h2>{h}</h2>{ps.length > 1 ? <ul>{ps.map(p => <li key={p}>{p}</li>)}</ul> : <p>{ps[0]}</p>}</section>
        ))}
      </article>
    </div>
  );
}
