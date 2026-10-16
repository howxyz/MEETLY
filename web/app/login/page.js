"use client";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { useGSAP } from "@gsap/react";
import { api, href, MOCK } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import Brand, { LogoMark } from "@/components/Logo";
import Icon from "@/components/Icon";
gsap.registerPlugin(DrawSVGPlugin, useGSAP);

export default function Login() {
  const { t, lang, setLang, theme, setTheme } = useI18n();
  const [mode, setMode] = useState("signin");
  const [me, setMe] = useState(null);
  const [err, setErr] = useState(false);
  const [next, setNext] = useState("/meetings");
  const [hint, setHint] = useState("");
  const side = useRef(null);

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (p.get("mode") === "signup") setMode("signup");
    if (p.get("error")) setErr(true);
    const raw = p.get("next") || "";
    if (raw.startsWith("/") && !raw.startsWith("//")) setNext(raw);
    setHint(p.get("hint") || "");
    api("/api/me").then(m => { if (m.user && !MOCK) location.href = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/meetings"; setMe(m); }).catch(() => {});
  }, []);

  // the mark is drawn like a level meter, the ON AIR sign switches on, then the minutes appear beneath it
  useGSAP(() => {
    gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
      gsap.timeline()
        .from(".auth-mark line", { drawSVG: "0%", duration: 0.8, stagger: 0.1, ease: "power2.inOut" })
        .from(".auth-rings circle", { drawSVG: "0%", duration: 1.6, stagger: 0.1, ease: "power2.inOut" }, 0)
        .fromTo(".auth-onair", { autoAlpha: 0.25 }, { keyframes: { autoAlpha: [0.25, 1, 0.3, 1, 0.55, 1] }, duration: 0.6, ease: "none" }, "-=.4")
        .from(".auth-quote", { autoAlpha: 0, y: 16, duration: 0.7 }, "-=.3")
        .from(".auth-lines > div", { autoAlpha: 0, x: lang === "ar" ? 16 : -16, stagger: 0.15, duration: 0.5 }, "-=.3")
        .from(".auth-card > *", { autoAlpha: 0, y: 12, stagger: 0.06, duration: 0.5 }, 0.2);
    });
  }, { scope: side, dependencies: [lang], revertOnUpdate: true });

  const q = new URLSearchParams();
  if (next !== "/meetings") q.set("next", next);
  if (hint) q.set("hint", hint);
  const googleHref = MOCK ? href("/meetings") : "/auth/login" + (q.toString() ? "?" + q : "");

  const devLogin = async e => {
    e.preventDefault();
    const email = e.currentTarget.email.value;
    const r = await fetch("/auth/dev", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    if (r.ok) location.href = next; else setErr(true);
  };

  return (
    <div className="auth" ref={side}>
      <aside className="auth-side night">
        <div className="auth-top"><Brand href={href("/")} /><span className="auth-onair" aria-hidden="true"><i />ON AIR</span></div>
        <div className="auth-story">
          <LogoMark className="auth-mark" stroke width={6} />
          <p className="auth-quote display">{t("auth_quote")}</p>
          <div className="auth-lines">
            <div><span className="ts">00:12:40</span>{t("ms_l1")}</div>
            <div><span className="ts">00:38:05</span>{t("ms_l2")}</div>
            <div><span className="ts">00:58:52</span>{t("ms_l3")}</div>
          </div>
        </div>
        <svg className="auth-rings" viewBox="0 0 600 600" aria-hidden="true">{[90, 160, 230, 300].map(r => <circle key={r} cx="560" cy="560" r={r} />)}</svg>
      </aside>
      <main className="auth-main">
        <div className="auth-tools">
          <button className="btn ghost sm" type="button" onClick={() => setLang(lang === "ar" ? "en" : "ar")}><Icon name="globe" /><span>{t("lang_switch")}</span></button>
          <button className="btn ghost sm icon-only" type="button" aria-label={t("theme")} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}><Icon name={theme === "dark" ? "sun" : "moon"} /></button>
        </div>
        <div className="auth-card">
          <div className="seg" role="group">
            <button type="button" aria-pressed={mode === "signin"} onClick={() => setMode("signin")}>{t("tab_signin")}</button>
            <button type="button" aria-pressed={mode === "signup"} onClick={() => setMode("signup")}>{t("tab_signup")}</button>
          </div>
          <h1 className="display">{t(mode === "signin" ? "signin_title" : "signup_title")}</h1>
          <p className="sub">{t(mode === "signin" ? "signin_sub" : "signup_sub")}</p>
          {err && <p className="notice error">{t("login_error")}</p>}
          {(me?.google_login ?? true) && (
            <a className="btn lg google" href={googleHref}>
              <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
              <span>{t(mode === "signin" ? "google_signin" : "google_signup")}</span>
            </a>
          )}
          {me?.dev_login && (
            <form onSubmit={devLogin} className="dev">
              <div className="divider">{t("dev_title")}</div>
              <div className="row">
                <label className="sr-only" htmlFor="email">{t("dev_email")}</label>
                <input id="email" name="email" type="email" required placeholder={t("dev_email")} defaultValue={hint} dir="ltr" />
                <button className="btn ink" type="submit">{t("dev_go")}</button>
              </div>
            </form>
          )}
          <p className="fine">{t("auth_fine")}</p>
        </div>
      </main>
    </div>
  );
}
