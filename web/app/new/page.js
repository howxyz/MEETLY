"use client";
// A new recording: the file, who attended, then the record drops and Meetly gets to work.
import { useRef, useState } from "react";
import gsap from "gsap";
import { api, href, EMAIL_OK, MOCK } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { reducedMotion } from "@/lib/ui";
import Shell from "@/components/Shell";
import Icon from "@/components/Icon";
import Avatar from "@/components/Avatar";
import Disc from "@/components/Disc";

export default function NewRecording() {
  const { t } = useI18n();
  const [me, setMe] = useState(null);
  const [source, setSource] = useState("upload");
  const [file, setFile] = useState(null);
  const [drive, setDrive] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [people, setPeople] = useState([]);
  const [draft, setDraft] = useState("");
  const [badDraft, setBadDraft] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [err, setErr] = useState("");
  const fileIn = useRef(null);
  const sealRef = useRef(null);
  const max = me?.limits?.max_attendees || 30;

  const pick = f => { if (!f) return; setFile(f); if (!title) setTitle(f.name.replace(/\.[^.]+$/, "")); };
  const addPeople = (text = draft) => {
    const parts = text.split(/[\s,;]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
    if (!parts.length) return people;
    if (parts.some(x => !EMAIL_OK.test(x))) { setBadDraft(true); return null; }
    const next = [...new Set([...people, ...parts])].slice(0, max);
    setPeople(next); setDraft(""); return next;
  };

  const upload = (up, f) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(up.method, up.url);
    for (const [k, v] of Object.entries(up.headers || {})) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = e => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(t("err"))));
    xhr.onerror = () => reject(new Error(t("err")));
    xhr.send(f);
  });

  // the record drops onto the form and spins up before the page moves on
  const press = () => new Promise(res => {
    if (reducedMotion() || !sealRef.current) return res();
    gsap.timeline({ onComplete: res })
      .set(sealRef.current, { display: "block" })
      .fromTo(sealRef.current, { scale: 2.6, autoAlpha: 0, rotation: -120 }, { scale: 1, autoAlpha: 1, rotation: 0, duration: 0.45, ease: "expo.in" })
      .to(".new-form", { y: 3, duration: 0.08, yoyo: true, repeat: 1 }, "-=.05")
      .to({}, { duration: 0.5 });
  });

  const submit = async e => {
    e.preventDefault(); setErr("");
    if (source === "upload" ? !file : !drive.trim()) return setErr(t("err_source"));
    if (!title.trim()) return setErr(t("err_title"));
    const list = draft.trim() ? addPeople() : people;
    if (list === null) return setErr(t("err_emails"));
    setBusy(true); setProgress(0);
    const body = { title: title.trim(), date: date || null, attendees: list, send_email: sendEmail, source_type: source };
    try {
      if (source === "upload") {
        const up = await api("/api/uploads", { method: "POST", body: JSON.stringify({ filename: file.name, content_type: file.type || "application/octet-stream" }) });
        if (!MOCK) await upload(up, file); else for (let p = 0; p <= 100; p += 20) { setProgress(p); await new Promise(r => setTimeout(r, 120)); }
        body.object = up.object;
      } else body.drive_url = drive.trim();
      setProgress(null);
      const m = await api("/api/meetings", { method: "POST", body: JSON.stringify(body) });
      await press();
      sessionStorage.setItem("flash", t("created"));
      location.href = href(`/meetings?id=${m.id}`);
    } catch (ex) { setErr(ex.message); setBusy(false); setProgress(null); }
  };

  const size = file ? (file.size >= 1048576 ? `${(file.size / 1048576).toFixed(0)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`) : "";
  return (
    <Shell active="new" onMe={setMe}>
      <header className="page-head">
        <div><span className="kicker">{t("brand")}</span><h1 className="display" style={{ marginTop: ".5rem" }}>{t("new_title")}</h1><p>{t("new_sub")}</p></div>
      </header>
      <form className="new-form" onSubmit={submit} noValidate>
        <section className="sheet ruled step">
          <div className="step-head"><span className="num">01</span><div><h2 className="display">{t("n_step1")}</h2><p className="muted">{t("n_step1_sub", { min: me?.limits?.max_minutes || 150 })}</p></div></div>
          <div className="seg" role="group">
            <button type="button" aria-pressed={source === "upload"} onClick={() => setSource("upload")}><Icon name="upload" />{t("src_upload")}</button>
            <button type="button" aria-pressed={source === "drive"} onClick={() => setSource("drive")}><Icon name="link" />{t("src_drive")}</button>
          </div>
          {source === "upload" ? (
            file ? (
              <div className="file-row"><span className="file-ic"><Icon name="wave" /></span><span className="fname" dir="auto">{file.name} · {size}</span>
                <button className="btn ghost sm" type="button" onClick={() => fileIn.current.click()}>{t("change")}</button></div>
            ) : (
              <button type="button" className={`drop ${over ? "over" : ""}`} onClick={() => fileIn.current.click()}
                onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
                onDrop={e => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); }}>
                <span className="drop-bars" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ animationDelay: `${-i * 0.12}s` }} />)}</span>
                <strong>{t("drop_main")}</strong><span className="muted">{t("drop_sub")}</span>
              </button>
            )
          ) : (
            <div><label className="lbl" htmlFor="drive">{t("src_drive")}</label>
              <input id="drive" type="url" dir="ltr" value={drive} onChange={e => setDrive(e.target.value)} placeholder="https://drive.google.com/file/d/…" />
              <p className="help">{t("drive_help")}</p></div>
          )}
          <input ref={fileIn} type="file" accept="video/*,audio/*" hidden onChange={e => pick(e.target.files[0])} />
        </section>

        <section className="sheet ruled step">
          <div className="step-head"><span className="num">02</span><div><h2 className="display">{t("n_step2")}</h2><p className="muted">{t("n_step2_sub")}</p></div></div>
          <div className="grid-2">
            <div><label className="lbl" htmlFor="title">{t("f_title")}</label><input id="title" type="text" dir="auto" value={title} onChange={e => setTitle(e.target.value)} /></div>
            <div><label className="lbl" htmlFor="date">{t("f_date")}</label><input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          </div>
          <div>
            <label className="lbl" htmlFor="people">{t("f_attendees")}</label>
            <div className={`people-box ${badDraft ? "bad" : ""}`}>
              {people.map(p => <span key={p} className="chip"><Avatar name={p} size={20} />{p}<button type="button" aria-label="remove" onClick={() => setPeople(people.filter(x => x !== p))}><Icon name="x" /></button></span>)}
              <input id="people" type="email" dir="ltr" value={draft} placeholder={people.length ? "" : t("email_ph")}
                onChange={e => { setDraft(e.target.value); setBadDraft(false); }}
                onKeyDown={e => { if (["Enter", ",", " "].includes(e.key)) { e.preventDefault(); addPeople(); } if (e.key === "Backspace" && !draft && people.length) setPeople(people.slice(0, -1)); }}
                onBlur={() => draft.trim() && addPeople()}
                onPaste={e => { const txt = e.clipboardData.getData("text"); if (/[\s,;]/.test(txt.trim())) { e.preventDefault(); addPeople(txt); } }} />
            </div>
            <p className="help">{t("attendees_help")}</p>
          </div>
          <label className="switch-row"><input type="checkbox" className="switch" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} /><span>{t("f_email")}</span></label>
        </section>

        {err && <p className="notice error" role="alert"><Icon name="alert" />{err}</p>}
        <div className="submit-row">
          {progress !== null && <div className="progress"><div style={{ width: `${progress}%` }} /><span>{t("uploading", { p: progress })}</span></div>}
          <button className="btn signal lg" type="submit" disabled={busy}><Icon name="mic" />{busy && progress === null ? t("starting") : t("create")}</button>
        </div>
        <div ref={sealRef} className="press-disc" aria-hidden="true"><Disc className="spinning" size={140} /></div>
      </form>
    </Shell>
  );
}
