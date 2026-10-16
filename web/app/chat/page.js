"use client";
// Ask Meetly: fast and simple. Answers stream in; every minute Meetly cites gets a cue
// with the speaker's exact words from the transcript.
import { useCallback, useEffect, useRef, useState } from "react";
import { api, chatStream, href } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { fmtDate, md } from "@/lib/ui";
import Shell from "@/components/Shell";
import Icon from "@/components/Icon";
import { LogoMark } from "@/components/Logo";

const TS = /\[\s*(\d{1,2}:\d{2}:\d{2})/g;
const secs = ts => ts.split(":").reduce((a, b) => a * 60 + +b, 0);
// "[00:12:40] Omar:" then the words, on the same line or on the lines after it
function parseTranscript(text) {
  const out = [];
  for (const block of (text || "").split(/\n(?=\s*\[\d{1,2}:\d{2}:\d{2})/)) {
    const m = block.match(/^\s*\[(\d{1,2}:\d{2}:\d{2})[^\]]*\]\s*([^:\n]{1,40}):\s*([\s\S]*)$/);
    const said = m && m[3].replace(/\s+/g, " ").trim();
    if (said) out.push({ ts: m[1], s: secs(m[1]), who: m[2].trim(), said });
  }
  return out;
}
// the transcript line a cited minute points to (the last one at or before it)
function noteFor(ts, lines) {
  const s = secs(ts); let best = null;
  for (const l of lines) { if (l.s <= s + 2) best = l; else break; }
  return best;
}

export default function Ask() {
  const { t, lang } = useI18n();
  const [meetings, setMeetings] = useState([]);
  const [cur, setCur] = useState("all");
  const [hist, setHist] = useState({});
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [side, setSide] = useState(false);
  const [lines, setLines] = useState({});
  const input = useRef(null);
  const scroll = useRef(null);
  const started = useRef(false);

  const save = h => { try { sessionStorage.setItem("chatHist", JSON.stringify(h)); } catch {} };
  const msgs = hist[cur] || [];
  const m = meetings.find(x => x.id === cur);

  const loadTranscript = useCallback(async id => {
    if (id === "all" || lines[id]) return;
    try { const txt = await api(`/api/meetings/${id}/transcript`); setLines(L => ({ ...L, [id]: parseTranscript(txt) })); } catch {}
  }, [lines]);

  const send = useCallback(async (text, id = cur) => {
    text = (text || "").trim();
    if (!text || busy) return;
    const prior = (hist[id] || []).filter(x => !x.err);
    const reply = { role: "assistant", content: "", streaming: true };
    let h = { ...hist, [id]: [...prior, { role: "user", content: text }, reply] };
    setHist(h); setBusy(true); setQ("");
    try {
      await chatStream(id, [...prior, { role: "user", content: text }].slice(-40).map(({ role, content }) => ({ role, content })), chunk => {
        reply.content += chunk;
        setHist(H => ({ ...H, [id]: [...(H[id] || []).slice(0, -1), { ...reply }] }));
      });
      if (!reply.content.trim()) throw new Error(t("err"));
    } catch (e) { reply.content = e.message || t("err"); reply.err = true; }
    reply.streaming = false;
    setHist(H => { const n = { ...H, [id]: [...(H[id] || []).slice(0, -1), { ...reply }] }; save(n); return n; });
    setBusy(false); input.current?.focus();
  }, [busy, cur, hist, t]);

  useEffect(() => {
    try { setHist(JSON.parse(sessionStorage.getItem("chatHist") || "{}") || {}); } catch {}
    api("/api/meetings").then(all => {
      const done = all.filter(x => x.status === "done"); setMeetings(done);
      const p = new URLSearchParams(location.search), want = p.get("m"), ask = (p.get("q") || "").trim();
      if (want && done.some(x => x.id === want)) {
        setCur(want); loadTranscript(want);
        history.replaceState(null, "", href(`/chat?m=${want}`));
        if (ask && !started.current) { started.current = true; setTimeout(() => send(ask.slice(0, 500), want), 50); }   // a question from the email
      }
    }).catch(() => {});
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { const s = scroll.current; if (s) s.scrollTop = s.scrollHeight; }, [hist, cur]);

  const choose = id => { if (busy) return; setCur(id); setSide(false); loadTranscript(id); history.replaceState(null, "", href(id === "all" ? "/chat" : `/chat?m=${id}`)); input.current?.focus(); };
  const sugg = t(m ? "sugg" : "sugg_all");

  return (
    <Shell active="chat">
      <div className={`ask ${side ? "side-open" : ""}`}>
        <aside className="ask-list">
          <h2 className="display">{t("choose")}</h2>
          <button type="button" className="ask-item all" aria-current={cur === "all"} onClick={() => choose("all")}>
            <Icon name="tape" /><span><b>{t("all_meetings")}</b><small>{t("all_sub")} · {meetings.length}</small></span>
          </button>
          {meetings.map(x => (
            <button key={x.id} type="button" className="ask-item" aria-current={cur === x.id} onClick={() => choose(x.id)}>
              <span className="reel-mini" aria-hidden="true" />
              <span><b dir="auto">{x.title}</b><small>{fmtDate(x.date || x.created_at, lang)}{(hist[x.id] || []).length ? " · ✎" : ""}</small></span>
            </button>
          ))}
        </aside>

        <section className="ask-main">
          <header className="ask-top">
            <button className="btn sm ask-pick" type="button" onClick={() => setSide(s => !s)}><Icon name="list" />{t("choose")}</button>
            <div className="ask-title"><h1 dir="auto">{m ? m.title : t("all_meetings")}</h1><p className="muted">{m ? fmtDate(m.date || m.created_at, lang) : t("all_sub")}</p></div>
            {m && <a className="btn ghost sm hide-sm" href={href(`/meetings?id=${m.id}`)}><Icon name="file" />{t("nav_archive_app")}</a>}
            <button className="btn ghost sm" type="button" onClick={() => { if (busy) return; const h = { ...hist, [cur]: [] }; setHist(h); save(h); }}><Icon name="plus" />{t("new_chat")}</button>
          </header>

          <div className="ask-scroll" ref={scroll}>
            <div className="ask-page">
              {!msgs.length ? (
                <div className="ask-welcome">
                  <LogoMark className="ask-logo" />
                  <h2 className="display" dir="auto">{m ? t("chat_welcome", { title: m.title }) : t("chat_welcome_all")}</h2>
                  <p className="muted">{t("chat_welcome_p")}</p>
                  <div className="ask-sugg">{(Array.isArray(sugg) ? sugg : []).map(s => <button key={s} type="button" onClick={() => send(s)}><Icon name="play" />{s}</button>)}</div>
                </div>
              ) : msgs.map((x, i) => x.role === "user"
                ? <div key={i} className="msg-q" dir="auto">{x.content}</div>
                : <Answer key={i} x={x} lines={lines[cur] || []} t={t} />)}
            </div>
          </div>

          <form className="ask-compose" onSubmit={e => { e.preventDefault(); send(q); }}>
            <label className="sr-only" htmlFor="ask">{t("chat_ph")}</label>
            <textarea id="ask" ref={input} rows={1} dir="auto" value={q} placeholder={t("chat_ph")} onChange={e => { setQ(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px"; }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(q); } }} disabled={!meetings.length} />
            <button className="btn signal icon-only" type="submit" aria-label="send" disabled={busy || !q.trim()}><Icon name="send" /></button>
          </form>
          <p className="ask-note">{t("chat_note")}</p>
        </section>
      </div>
    </Shell>
  );
}

function Answer({ x, lines, t }) {
  const cited = x.streaming || x.err ? [] : [...new Set([...x.content.matchAll(TS)].map(r => r[1]))];
  const notes = cited.map(ts => [ts, noteFor(ts, lines)]).filter(([, n]) => n);
  return (
    <div className={`msg-a ${x.err ? "err" : ""}`}>
      <span className="ai"><LogoMark /></span>
      <div className="a-body">
        {x.content ? <div className="prose" dir="auto" dangerouslySetInnerHTML={{ __html: md(x.content) }} /> : <span className="typing"><i /><i /><i /></span>}
        {x.streaming && x.content && <span className="nib" aria-hidden="true" />}
      </div>
      {notes.length > 0 && (
        <aside className="a-margin">
          <span className="m-k">{t("margin_note")}</span>
          {notes.slice(0, 3).map(([ts, n]) => (
            <p key={ts}><q dir="auto">{n.said.length > 150 ? n.said.slice(0, 150) + "…" : n.said}</q><span className="m-who">— {n.who} <span className="ts">{n.ts}</span></span></p>
          ))}
        </aside>
      )}
    </div>
  );
}
