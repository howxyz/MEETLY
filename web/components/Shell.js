"use client";
// The app frame: a black console sidebar and the page.
import { useEffect, useState } from "react";
import { api, href, goLogin } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import Avatar from "./Avatar";
import Brand from "./Logo";
import Icon from "./Icon";

export default function Shell({ active, working = 0, children, onMe }) {
  const { t, lang, setLang, theme, setTheme } = useI18n();
  const [me, setMe] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    api("/api/me").then(m => { if (!m.user) return goLogin(); setMe(m); onMe?.(m); }).catch(() => {});
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const nav = [
    ["new", "/new", "plus", t("nav_new")],
    ["meetings", "/meetings", "tape", t("nav_archive_app")],
    ["chat", "/chat", "play", t("nav_chat")],
  ];
  return (
    <div className={`shell ${open ? "nav-open" : ""}`}>
      <aside className="side night">
        <Brand href={href("/meetings")} />
        <span className="side-rec" aria-hidden="true"><i />ON AIR</span>
        <nav aria-label="Main">
          {nav.map(([key, path, ic, label]) => (
            <a key={key} href={href(path)} aria-current={active === key ? "page" : undefined}>
              <Icon name={ic} /><span>{label}</span>
              {key === "meetings" && working > 0 && <span className="badge">{working}</span>}
            </a>
          ))}
        </nav>
        <div className="foot">
          <div className="tools">
            <button className="btn ghost sm" type="button" onClick={() => setLang(lang === "ar" ? "en" : "ar")}><Icon name="globe" /><span>{t("lang_switch")}</span></button>
            <button className="btn ghost sm icon-only" type="button" aria-label={t("theme")} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
          </div>
          {me?.user && (
            <div className="me">
              <Avatar name={me.user.name || me.user.email} size={34} />
              <div className="who"><b>{me.user.name}</b><span>{me.user.email}</span></div>
              <a className="btn ghost sm icon-only" href={href("/auth/logout")} aria-label={t("sign_out")} title={t("sign_out")}><Icon name="logout" /></a>
            </div>
          )}
        </div>
      </aside>
      <div style={{ minWidth: 0 }}>
        <div className="mobile-bar">
          <button className="btn ghost icon-only" type="button" aria-label={t("menu")} onClick={() => setOpen(o => !o)}><Icon name="menu" /></button>
          <Brand href={href("/meetings")} />
          {me?.user && <a className="btn ghost icon-only out" href={href("/auth/logout")} aria-label={t("sign_out")} title={t("sign_out")}><Icon name="logout" /></a>}
        </div>
        <main className="main" onClick={() => open && setOpen(false)}>{children}</main>
      </div>
    </div>
  );
}
