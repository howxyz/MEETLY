"use client";
// The library: every session as a tape on the rack. Open one and it expands into the full minutes (Flip).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { api, href, WORKING, EMAIL_OK, MOCK } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { fmtDate, plain, reducedMotion } from "@/lib/ui";
import Shell from "@/components/Shell";
import Icon from "@/components/Icon";
import Avatar from "@/components/Avatar";
import Disc from "@/components/Disc";
import { useToast } from "@/components/Toast";
gsap.registerPlugin(Flip);

const minutes = (sec, t) => (sec ? `${Math.max(1, Math.round(sec / 60))} ${t("min")}` : "");

function Status({ s, t }) {
  const cls = s === "done" ? "done" : s === "error" ? "error" : "working";
  return <span className={`pill ${cls}`}>{cls !== "done" && <span className="dot" />}{cls === "done" && <Icon name="check" className="icon" style={{ width: 13, height: 13 }} />}{t("st_" + s)}</span>;
}

export default function Archive() {
  const { t, lang } = useI18n();
  const [list, setList] = useState(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const [detail, setDetail] = useState(null);
  const [me, setMe] = useState(null);
  const [toast, toastNode] = useToast();
  const flip = useRef(null);
  const lastId = useRef(null);
  const wrap = useRef(null);

  const load = useCallback(async () => { try { setList(await api("/api/meetings")); } catch {} }, []);
  const loadDetail = useCallback(async id => { try { setDetail(await api(`/api/meetings/${id}`)); } catch { setDetail(null); setSel(null); } }, []);

  useEffect(() => {
    load();
    const id = new URLSearchParams(location.search).get("id") || location.hash.slice(1);
    if (id) { setSel(id); loadDetail(id); }
    const f = sessionStorage.getItem("flash"); if (f) { sessionStorage.removeItem("flash"); toast(f); }
  }, [load, loadDetail, toast]);

  // keep processing sessions fresh
  useEffect(() => {
    const busy = (list || []).some(m => WORKING.includes(m.status)) || (detail && WORKING.includes(detail.status));
    const id = setTimeout(async () => { if (document.hidden) return; await load(); if (sel) await loadDetail(sel); }, busy ? 4000 : 30000);
    return () => clearTimeout(id);
  }, [list, detail, sel, load, loadDetail]);

  // fetch first, then expand — so the page that opens is already the full minutes
  const open = async (id, el) => {
    const state = el && !reducedMotion() ? Flip.getState(el) : null;
    let d; try { d = await api(`/api/meetings/${id}`); } catch (e) { toast(e.message); return; }
    flip.current = state; setDetail(d); setSel(id);
    history.replaceState(null, "", href(`/meetings?id=${id}`));
    window.scrollTo({ top: 0 });
  };
  const back = () => {
    const el = wrap.current?.querySelector(".manuscript");
    if (el && !reducedMotion()) flip.current = Flip.getState(el);
    lastId.current = sel;
    setSel(null); setDetail(null);
    history.replaceState(null, "", href("/meetings"));
  };
  useLayoutEffect(() => {
    if (!flip.current) return;
    const target = sel ? wrap.current.querySelector(".manuscript") : wrap.current.querySelector(`.scroll-card[data-flip-id="${lastId.current}"]`);
    if (target) Flip.from(flip.current, { targets: target, duration: 0.7, ease: "expo.inOut", absolute: true, fade: true });
    flip.current = null;
  }, [sel]);

  const shown = (list || []).filter(m => !q.trim() || (m.title || "").toLowerCase().includes(q.trim().toLowerCase()) || (m.attendees || []).some(a => a.includes(q.trim().toLowerCase())));
  const working = (list || []).filter(m => WORKING.includes(m.status)).length;

  return (
    <Shell active="meetings" working={working} onMe={setMe}>
      <div ref={wrap}>
        {!sel && (
          <>
            <header className="page-head">
              <div><span className="kicker">{t("brand")}</span><h1 className="display" style={{ marginTop: ".5rem" }}>{t("archive_title")}</h1><p>{t("archive_sub")}</p></div>
              <div className="head-tools">
                <label className="search"><Icon name="search" /><span className="sr-only">{t("search")}</span><input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t("search")} /></label>
                <a className="btn ink" href={href("/new")}><Icon name="plus" />{t("nav_new")}</a>
              </div>
            </header>
            {list && !list.length && (
              <div className="empty sheet ruled"><Icon name="tape" className="icon big" /><h3 className="display">{t("no_meetings")}</h3><p className="muted">{t("no_meetings_p")}</p>
                <a className="btn ink" href={href("/new")}><Icon name="plus" />{t("nav_new")}</a></div>
            )}
            <div className="scroll-grid">
              {!list && [0, 1, 2].map(i => <div key={i} className="scroll-card skel" />)}
              {shown.map((m, i) => (
                <button key={m.id} type="button" className="scroll-card" data-flip-id={m.id} style={{ "--i": i }} onClick={e => open(m.id, e.currentTarget)}>
                  <span className={`reels ${WORKING.includes(m.status) ? "turning" : ""}`} aria-hidden="true"><i /><b /><i /></span>
                  <span className="sc-body">
                    <span className="sc-top"><Status s={m.status} t={t} />{!m.is_owner && <span className="muted sc-shared"><Icon name="users" />{t("shared")}</span>}</span>
                    <b className="sc-title" dir="auto">{m.title}</b>
                    <span className="sc-meta"><span><Icon name="calendar" />{fmtDate(m.date || m.created_at, lang)}</span>{m.duration_sec ? <span><Icon name="clock" />{minutes(m.duration_sec, t)}</span> : null}
                      <span><Icon name="users" />{t("people", { n: (m.attendees || []).length + 1 })}</span></span>
                  </span>
                  {m.status === "done" && <Disc className="sc-disc" size={46} />}
                </button>
              ))}
            </div>
          </>
        )}
        {sel && (
          <Manuscript id={sel} m={detail} me={me} t={t} lang={lang} back={back} toast={toast}
            reload={async () => { await load(); await loadDetail(sel); }} />
        )}
      </div>
      {toastNode}
    </Shell>
  );
}

/* ───────────────────────── one session's minutes */
function Manuscript({ id, m, me, t, lang, back, toast, reload }) {
  const [tr, setTr] = useState(null);
  const [showTr, setShowTr] = useState(false);
  const [rs, setRs] = useState(false);
  const root = useRef(null);

  useEffect(() => {
    if (!m || reducedMotion()) return;
    const ctx = gsap.context(() => gsap.from(".mn-reveal", { autoAlpha: 0, y: 14, stagger: 0.05, duration: 0.5, ease: "power2.out", delay: 0.15 }), root);
    return () => ctx.revert();
  }, [m?.id, m?.status]);  // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTr = async () => {
    setShowTr(s => !s);
    if (tr === null) { try { setTr(await api(`/api/meetings/${id}/transcript`)); } catch { setTr(""); } }
  };
  const del = async () => {
    if (!confirm(t("confirm_delete"))) return;
    try { await api(`/api/meetings/${id}`, { method: "DELETE" }); back(); reload(); } catch (e) { toast(e.message); }
  };
  const retry = async () => { try { await api(`/api/meetings/${id}/retry`, { method: "POST" }); reload(); } catch (e) { toast(e.message); } };

  if (!m) return (
    <div className="manuscript sheet" data-flip-id={id}><div className="mn-loading"><span className="typing"><i /><i /><i /></span></div></div>
  );
  const working = WORKING.includes(m.status), a = m.analysis;
  const ORDER = ["queued", "downloading", "transcribing", "analyzing", "emailing", "done"];
  const STEPS = [["downloading", "tr_download"], ["transcribing", "tr_transcribe"], ["analyzing", "tr_write"], ["emailing", "tr_send"]];

  return (
    <div ref={root}>
      <button className="btn ghost sm back" type="button" onClick={back}><Icon name="arrow" className="icon flip-back" />{t("archive_title")}</button>
      <article className="manuscript sheet ruled" data-flip-id={id}>
        <header className="mn-head">
          <div className="mn-title-row"><h1 className="display" dir="auto">{m.title}</h1><Status s={m.status} t={t} /></div>
          <div className="mn-meta">
            <span><Icon name="calendar" />{fmtDate(m.date || m.created_at, lang)}</span>
            {m.duration_sec ? <span><Icon name="clock" />{minutes(m.duration_sec, t)}</span> : null}
            <span><Icon name="users" />{t("people", { n: (m.attendees || []).length + 1 })}</span>
            {m.emails_sent ? <span><Icon name="mail" />{m.emails_sent}</span> : null}
          </div>
          <div className="mn-actions">
            {m.status === "done" && <a className="btn ink sm" href={href(`/chat?m=${m.id}`)}><Icon name="play" />{t("ask_this")}</a>}
            {m.has_pdf && <a className="btn sm" href={MOCK ? "#" : `/api/meetings/${m.id}/pdf`} download><Icon name="download" />{t("pdf")}</a>}
            {m.has_transcript && <button className="btn sm" type="button" aria-pressed={showTr} onClick={toggleTr}><Icon name="file" />{t("transcript")}</button>}
            {m.is_owner && m.status === "done" && <button className="btn sm" type="button" aria-expanded={rs} onClick={() => setRs(r => !r)}><Icon name="mail" />{t("resend")}</button>}
            {m.is_owner && m.status === "error" && <button className="btn sm" type="button" onClick={retry}><Icon name="refresh" />{t("retry")}</button>}
            {m.is_owner && <button className="btn ghost sm danger" type="button" onClick={del}><Icon name="trash" />{t("del")}</button>}
          </div>
        </header>

        {rs && <Resend m={m} t={t} toast={toast} done={() => { setRs(false); reload(); }} cancel={() => setRs(false)} />}

        {working && (
          <div className="mn-progress mn-reveal">
            <div className="tracker">{STEPS.map(([s, k]) => { const at = ORDER.indexOf(m.status), i = ORDER.indexOf(s);
              return <div key={s} className={`tstep ${at > i ? "done" : at === i ? "active" : ""}`}><i /><span>{t(k)}</span></div>; })}</div>
            <p className="muted">{t("processing")}</p>
          </div>
        )}
        {m.status === "error" && <p className="notice error mn-reveal" dir="auto"><Icon name="alert" />{m.error || t("err")}</p>}

        {showTr && <div className="mn-transcript mn-reveal" dir="auto" dangerouslySetInnerHTML={{ __html: tr === null ? "…" : plain(tr) }} />}

        {m.status === "done" && a && (
          <div className="mn-body">
            <section className="mn-summary mn-reveal">
              <h2 className="mn-h">{t("b_summary")}</h2>
              {a.meeting_purpose && <p className="muted purpose" dir="auto">{a.meeting_purpose}</p>}
              <p className="illum" dir="auto" dangerouslySetInnerHTML={{ __html: plain(a.executive_summary) }} />
            </section>
            <div className="mn-two">
              <section className="mn-reveal">
                <h2 className="mn-h">{t("b_decisions")}<span className="count">{(a.key_decisions || []).length}</span></h2>
                {(a.key_decisions || []).length ? <ul className="mn-list ok">{a.key_decisions.map((d, i) => <li key={i}><Icon name="check" /><div dir="auto">{d.decision}{d.decided_by && <span className="by">— {d.decided_by}</span>}</div></li>)}</ul>
                  : <p className="muted">{t("no_decisions")}</p>}
              </section>
              <section className="mn-reveal">
                <h2 className="mn-h">{t("b_open")}<span className="count">{(a.unresolved_issues || []).length + (a.risks_and_concerns || []).length}</span></h2>
                <ul className="mn-list warn">{[...(a.unresolved_issues || []).map(u => [u.issue, u.why_unresolved]), ...(a.risks_and_concerns || []).map(r => [r])].map(([x, why], i) =>
                  <li key={i}><Icon name="alert" /><div dir="auto">{x}{why && <span className="by">{why}</span>}</div></li>)}</ul>
              </section>
            </div>
            <section className="mn-reveal">
              <h2 className="mn-h">{t("b_tasks")}<span className="count">{(a.action_items || []).length}</span></h2>
              <div className="table-wrap"><table className="mn-tasks"><thead><tr><th>{t("th_task")}</th><th>{t("th_owner")}</th><th>{t("th_due")}</th></tr></thead>
                <tbody>{(a.action_items || []).map((x, i) => <tr key={i}><td dir="auto">{x.task}</td>
                  <td>{x.assignee ? <span className="owner-cell"><Avatar name={x.assignee} size={22} /><span dir="auto">{x.assignee}</span></span> : <span className="muted">{t("unassigned")}</span>}</td>
                  <td dir="auto">{x.deadline || "—"}</td></tr>)}</tbody></table></div>
            </section>
            <div className="mn-two">
              <section className="mn-reveal">
                <h2 className="mn-h">{t("b_next")}</h2>
                <ol className="mn-steps">{(a.next_steps || []).map((s, i) => <li key={i} dir="auto">{s}</li>)}</ol>
              </section>
              <section className="mn-reveal">
                <h2 className="mn-h">{t("b_people")}</h2>
                <div className="people">{(a.participants || []).map((p, i) => <span key={i} className="chip person"><Avatar name={p.name} size={22} /><span dir="auto">{p.name}{p.role && <small> · {p.role}</small>}</span></span>)}</div>
              </section>
            </div>
            {(a.sections || []).length > 0 && (
              <section className="mn-reveal">
                <h2 className="mn-h">{t("b_topics")}</h2>
                {a.sections.map((s, i) => (
                  <details key={i} className="topic" open={i === 0}>
                    <summary><span className="num">{String(i + 1).padStart(2, "0")}</span><span dir="auto">{s.section_title}</span>
                      {s.time_range && <span className="ts">{s.time_range.replace(/\s*(?:-|–|to)\s*/, "–")}</span>}<Icon name="chevron" className="icon chev" /></summary>
                    <div className="topic-body" dir="auto">
                      <p>{s.detailed_discussion}</p>
                      {(s.key_points || []).length > 0 && <ul>{s.key_points.map((k, j) => <li key={j}>{k}</li>)}</ul>}
                      {s.outcome && <p className="outcome">→ {s.outcome}</p>}
                    </div>
                  </details>
                ))}
              </section>
            )}
            <footer className="mn-foot mn-reveal"><hr className="hair" /><Disc className="spinning" size={84} /></footer>
          </div>
        )}
      </article>
    </div>
  );
}

/* ───────────────────────── resend the minutes (+ add people) */
function Resend({ m, t, toast, done, cancel }) {
  const [onlyNew, setOnlyNew] = useState(false);
  const [add, setAdd] = useState([]);
  const [draft, setDraft] = useState("");
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);
  const people = [m.owner, ...(m.attendees || [])];

  const addFrom = () => {
    const parts = draft.split(/[\s,;]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
    if (!parts.length) return add;
    if (parts.some(x => !EMAIL_OK.test(x))) { setBad(true); toast(t("err_emails")); return null; }
    const have = new Set([...people, ...add]);
    const next = [...add, ...parts.filter(x => !have.has(x))];
    setAdd(next); setDraft(""); return next;
  };
  const send = async () => {
    const list = draft.trim() ? addFrom() : add;
    if (list === null) return;
    if (onlyNew && !list.length) return toast(t("need_email"));
    setBusy(true);
    try {
      const r = await api(`/api/meetings/${m.id}/resend`, { method: "POST", body: JSON.stringify({ add: list, only_new: onlyNew && list.length > 0 }) });
      toast(t("resent", { n: r.sent })); done();
    } catch (e) { toast(e.message); setBusy(false); }
  };
  return (
    <div className="resend">
      <span className="lbl">{t("rs_who")}</span>
      <div className="seg" role="group">
        <button type="button" aria-pressed={!onlyNew} onClick={() => setOnlyNew(false)}><Icon name="users" />{t("rs_everyone")}</button>
        <button type="button" aria-pressed={onlyNew} onClick={() => setOnlyNew(true)}><Icon name="plus" />{t("rs_new")}</button>
      </div>
      {!onlyNew && <div className="rs-now"><span className="muted">{t("rs_current")}</span><div className="chips">{people.map(p => <span key={p} className="chip">{p}</span>)}</div></div>}
      <label className="lbl" htmlFor="rsIn">{t(onlyNew ? "rs_add_req" : "rs_add")}</label>
      <div className="rs-row">
        <input id="rsIn" type="email" dir="ltr" value={draft} aria-invalid={bad} placeholder={t("email_ph")}
          onChange={e => { setDraft(e.target.value); setBad(false); }} onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addFrom(); } }} />
        <button className="btn sm" type="button" onClick={addFrom}><Icon name="plus" />{t("rs_add_btn")}</button>
      </div>
      {add.length > 0 && <div className="chips">{add.map((a, i) => <span key={a} className="chip new">{a}<button type="button" aria-label="remove" onClick={() => setAdd(add.filter((_, j) => j !== i))}><Icon name="x" /></button></span>)}</div>}
      <p className="help">{t("rs_help")}</p>
      <div className="rs-actions">
        <button className="btn ghost sm" type="button" onClick={cancel}>{t("rs_cancel")}</button>
        <button className="btn signal sm" type="button" disabled={busy || (onlyNew && !add.length && !draft.trim())} onClick={send}>
          <Icon name="send" />{busy ? t("sending") : onlyNew ? t("rs_send_new", { n: add.length || (draft.trim() ? 1 : 0) }) : t("rs_send_all", { n: people.length + add.length })}
        </button>
      </div>
    </div>
  );
}
