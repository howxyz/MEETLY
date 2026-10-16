"use client";
// Meetly Studio — the landing page tells one story: hit record, and every meeting goes on the record.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { Flip } from "gsap/Flip";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";
import { useI18n } from "@/lib/i18n";
import { api, href, MOCK } from "@/lib/api";
import Brand, { LogoMark } from "@/components/Logo";
import Disc from "@/components/Disc";
import Icon from "@/components/Icon";
import Avatar from "@/components/Avatar";

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, ScrambleTextPlugin, Flip, useGSAP);

const AR_CHARS = "ابتثجحخدذرزسشصضطظعغفقكلمنهوي";
const NUMS = ["TRK 01", "TRK 02", "TRK 03", "TRK 04"];   // the tracklist, in both languages
const LENGTH = 4472;                                    // the sample session: 01:14:32
const secs = ts => ts.split(":").reduce((a, b) => a * 60 + +b, 0);
const tc = n => [n / 3600, (n % 3600) / 60, n % 60].map(x => String(Math.floor(x)).padStart(2, "0")).join(":");

// the voice on the hero: three swells under one envelope
const WAVE = (() => {
  let d = "";
  for (let x = 0; x <= 600; x += 3) {
    const env = Math.sin((Math.PI * x) / 600);
    const y = 110 + Math.sin((x / 600) * Math.PI * 2 * 5) * 62 * env * (0.6 + 0.4 * Math.sin(x / 37));
    d += (x ? " L" : "M") + x + " " + y.toFixed(1);
  }
  return d;
})();
const BARS = Array.from({ length: 26 }, (_, i) => 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.37)));

const TAPES = [
  { en: "Weekly product sync", ar: "اجتماع المنتج الأسبوعي", date: "14·10" },
  { en: "Blue Oasis — client", ar: "عميل Blue Oasis", date: "12·10" },
  { en: "Content calendar", ar: "تقويم المحتوى", date: "08·10" },
  { en: "Q3 retrospective", ar: "مراجعة الربع الثالث", date: "01·10" },
  { en: "Hiring panel", ar: "لجنة التوظيف", date: "27·09" },
  { en: "Agency onboarding", ar: "استقبال الوكالة", date: "24·09" },
  { en: "Budget review", ar: "مراجعة الميزانية", date: "19·09" },
  { en: "Launch planning", ar: "التخطيط للإطلاق", date: "11·09" },
];

export default function Landing() {
  const { t, lang, setLang, theme, setTheme } = useI18n();
  const root = useRef(null);
  const [fonts, setFonts] = useState(false);
  const ar = lang === "ar";

  // the landing page always shows first, on every device; signed-in visitors just get a button to their library
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { if (!MOCK) api("/api/me").then(m => setSignedIn(!!m.user)).catch(() => {}); }, []);
  const enter = signedIn ? href("/meetings") : href("/login?mode=signup");
  useEffect(() => { document.fonts.ready.then(() => setFonts(true)); }, []);

  // the hero's REC counter runs from the moment the page opens
  const counter = useRef(null);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let n = 0; const id = setInterval(() => { n += 1; if (counter.current) counter.current.textContent = tc(n); }, 1000);
    return () => clearInterval(id);
  }, []);

  // smooth, page-turning scroll — kept in step with ScrollTrigger
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ lerp: 0.085, anchors: { offset: -64 } });
    lenis.on("scroll", ScrollTrigger.update);
    const raf = time => lenis.raf(time * 1000);
    gsap.ticker.add(raf); gsap.ticker.lagSmoothing(0);
    return () => { gsap.ticker.remove(raf); lenis.destroy(); };
  }, []);

  useGSAP(() => {
    if (!fonts) return;
    const mm = gsap.matchMedia();
    const q = s => root.current.querySelectorAll(s);

    // the nav gains a backdrop once the hero has passed
    const nav = q(".l-nav")[0];
    const onScroll = () => nav.classList.toggle("solid", window.scrollY > 80);
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });

    mm.add({ motion: "(prefers-reduced-motion: no-preference)", desk: "(min-width: 820px) and (min-height: 440px)", tall: "(min-height: 640px)" }, ctx => {
      const { motion, desk, tall } = ctx.conditions;
      if (!motion) return;   // reduced motion: everything is already in its final state

      // ---------- 1. every meeting, on the record
      // Arabic is split by word only (splitting letters would break their joins) and isn't masked (deep descenders)
      const split = SplitText.create(".hero-title", ar ? { type: "words" } : { type: "words,chars", mask: "chars" });
      const hero = gsap.timeline({ defaults: { ease: "power3.out" } });
      hero.set(".hero-wave, .hero-mark", { autoAlpha: 1 })
        .from(".hero-wave path", { drawSVG: "0%", duration: 1.5, ease: "power2.inOut" })
        .to(".hero-wave", { scaleY: 0.55, duration: 0.32, yoyo: true, repeat: 3, ease: "sine.inOut", transformOrigin: "50% 50%" }, "-=.2")
        .to(".hero-wave path", { drawSVG: "100% 100%", duration: 0.9, ease: "power2.in" }, "-=.1")
        .from(".hero-mark line", { drawSVG: "0%", duration: 0.7, stagger: 0.09, ease: "power2.inOut" }, "<.35")
        .fromTo(".hero-onair", { autoAlpha: 0.25 }, { keyframes: { autoAlpha: [0.25, 1, 0.3, 1, 0.55, 1] }, duration: 0.7, ease: "none",
          onStart: () => q(".hero-onair")[0].classList.add("on") }, "-=.25")
        .from(".hero-kicker", { autoAlpha: 0, y: 10, duration: 0.6 }, "-=.2")
        .from(ar ? split.words : split.chars, ar ? { autoAlpha: 0, y: 24, filter: "blur(6px)", duration: 0.9, stagger: 0.12 } : { yPercent: 110, duration: 0.75, stagger: 0.022 }, "<.1")
        .from(".hero-lead, .hero-cta, .hero-note", { autoAlpha: 0, y: 16, duration: 0.7, stagger: 0.1 }, "-=.45")
        .from(".hero-hint", { autoAlpha: 0, duration: 0.6 }, "-=.2");
      gsap.from(".hero-rings circle", { drawSVG: "0%", duration: 2, stagger: 0.12, ease: "power2.inOut", delay: 0.2 });

      // ---------- 2. from sound to minutes (pinned on wide screens)
      const lines = q(".ms-line .txt");
      const finals = [...lines].map(l => l.textContent);
      lines.forEach(l => (l.textContent = ""));
      const scramble = (el, i) => ({ duration: 1, scrambleText: { text: finals[i], chars: ar ? AR_CHARS : "lowerCase", revealDelay: 0.25, speed: 0.6 } });
      if (desk && tall) {
        const tl = gsap.timeline({ scrollTrigger: { trigger: ".s-story", start: "top top", end: "+=260%", pin: true, scrub: 1 } });
        // each bar of the voice travels into the microphone
        const nibX = () => { const b = q(".story-mic")[0].getBoundingClientRect(); return b.left + b.width / 2; };
        tl.to(".story-bars i", { x: (i, el) => nibX() - (el.getBoundingClientRect().left + el.offsetWidth / 2),
             scaleY: 0.1, autoAlpha: 0, stagger: { each: 0.035, from: ar ? "start" : "end" }, ease: "power1.in", duration: 2 })
          .to(".story-mic .mic-body", { scale: 1.05, yoyo: true, repeat: 5, duration: 0.33, ease: "sine.inOut", transformOrigin: "50% 40%" }, 0.3)
          .to(".story-mic .mic-glow", { autoAlpha: 1, duration: 0.4 }, 0.3)
          .from(".story-cable path", { drawSVG: "0%", duration: 1.2, ease: "none" }, 0.6)
          .to(".story-mic .mic-glow", { autoAlpha: 0.35, duration: 0.6 }, 2.2)
          .from(".ms-head", { autoAlpha: 0, y: 12, duration: 0.5 }, 1)
          .to(lines[0], scramble(lines[0], 0), 1.3).to(lines[1], scramble(lines[1], 1), 1.9).to(lines[2], scramble(lines[2], 2), 2.5)
          .from(".ms-section", { autoAlpha: 0, y: 14, stagger: 0.25, duration: 0.6 }, 3)
          .from(".ms-section .rule", { scaleX: 0, stagger: 0.25, duration: 0.6, transformOrigin: ar ? "100% 50%" : "0% 50%" }, 3.1);
      } else {
        const tl = gsap.timeline({ scrollTrigger: { trigger: ".ms", start: "top 75%" } });
        lines.forEach((l, i) => tl.to(l, scramble(l, i), i * 0.4));
        tl.from(".ms-section", { autoAlpha: 0, y: 14, stagger: 0.15, duration: 0.5 }, "-=.3");
        gsap.from(".story-bars i", { scaleY: 0.1, stagger: 0.02, duration: 0.6, scrollTrigger: { trigger: ".story-bars", start: "top 85%" } });
      }

      // ---------- 3. the tracklist (horizontal on wide screens)
      const disc = q(".stage-disc")[0];
      const stamp = () => gsap.timeline({ paused: true, onReverseComplete: () => disc.classList.remove("spinning") })
        .fromTo(disc, { scale: 2.4, autoAlpha: 0, rotation: -120 }, { scale: 1, autoAlpha: 1, rotation: 0, duration: 0.5, ease: "expo.in" })
        .to(disc, { scaleX: 1.06, scaleY: 0.94, duration: 0.08, yoyo: true, repeat: 1, onComplete: () => disc.classList.add("spinning") })
        .from(".stage-sheet", { y: 6, duration: 0.12, yoyo: true, repeat: 1, ease: "power1.out" }, "<")
        .from(".letter", { autoAlpha: 0, scale: 0.4, duration: 0.7, stagger: 0.12, ease: "power3.out",
          x: (i, el) => (ar ? -1 : 1) * -(+el.dataset.x), y: (i, el) => -(+el.dataset.y) }, "+=.15")
        .from(".sent-row > *", { autoAlpha: 0, y: 8, stagger: 0.08, duration: 0.4 }, "-=.3");
      if (desk) {
        // pinned: the scene is one screen tall and the cards slide sideways; without the pin they sit in rows instead
        const sec = q(".s-stages")[0];
        sec.classList.add("pinned");
        ctx.add(() => () => sec.classList.remove("pinned"));
        const track = q(".stages-track")[0];
        const dist = () => track.scrollWidth - window.innerWidth;
        const horiz = gsap.to(track, { x: () => (ar ? dist() : -dist()), ease: "none",
          scrollTrigger: { trigger: ".s-stages", start: "top top", end: () => "+=" + dist(), pin: true, scrub: 1, invalidateOnRefresh: true } });
        q(".stage:not(.stage-1)").forEach(p => gsap.from(p.querySelectorAll(".stage-num, .stage h3, .stage p, .stage-art"), {
          autoAlpha: 0, y: 24, stagger: 0.08, duration: 0.6, ease: "power2.out",
          scrollTrigger: { trigger: p, containerAnimation: horiz, start: ar ? "right 85%" : "left 85%" } }));
        const st = stamp();
        ScrollTrigger.create({ trigger: ".stage-4", containerAnimation: horiz, start: ar ? "right 70%" : "left 55%",
          onEnter: () => st.play(), onLeaveBack: () => st.reverse() });
      } else {
        const st = stamp();
        ScrollTrigger.create({ trigger: ".stage-4 .stage-art", start: "top 70%", onEnter: () => st.play() });
        q(".stage").forEach(p => gsap.from(p, { autoAlpha: 0, y: 30, duration: 0.6, scrollTrigger: { trigger: p, start: "top 85%" } }));
      }

      // ---------- 4. playback: the first question asks itself
      ScrollTrigger.create({ trigger: ".s-scribe", start: "top 55%", once: true, onEnter: () => window.dispatchEvent(new Event("scribe:auto")) });
      gsap.from(".scribe-ms", { y: 40, autoAlpha: 0, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: ".s-scribe", start: "top 70%" } });

      // ---------- 5. the library: tapes drop into the rack
      gsap.from(".tape-item", { y: -40, autoAlpha: 0, rotation: (i) => (i % 2 ? 6 : -6), stagger: 0.07, duration: 0.8, ease: "back.out(1.6)",
        scrollTrigger: { trigger: ".shelves", start: "top 75%" } });

      // ---------- 6. the ON AIR sign switches on as you arrive
      gsap.timeline({ scrollTrigger: { trigger: ".s-close", start: "top 70%", end: "center 55%", scrub: 1 } })
        .fromTo(".onair-big .lit", { autoAlpha: 0 }, { keyframes: { autoAlpha: [0, 0.9, 0.1, 1, 0.35, 1] }, ease: "none", duration: 1 })
        .from(".close-inner > *", { autoAlpha: 0, y: 20, stagger: 0.1 }, 0.4);

      // headings come in as you reach them
      q(".rv").forEach(el => gsap.from(el, { autoAlpha: 0, y: 24, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 85%" } }));
    });

    // the record tilts towards the cursor while it spins
    const rec = q(".close-disc")[0];
    if (rec && matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches) {
      const rx = gsap.quickTo(rec, "rotationY", { duration: 0.6, ease: "power3" }), ry = gsap.quickTo(rec, "rotationX", { duration: 0.6, ease: "power3" });
      const rz = gsap.quickTo(rec, "rotation", { duration: 0.8, ease: "power3" });
      const sec = q(".s-close")[0];
      const move = e => { const b = rec.getBoundingClientRect(); const dx = gsap.utils.clamp(-1, 1, (e.clientX - b.left - b.width / 2) / 300), dy = gsap.utils.clamp(-1, 1, (e.clientY - b.top - b.height / 2) / 300);
        rx(dx * 25); ry(-dy * 25); rz(dx * 12); };
      sec.addEventListener("pointermove", move);
      return () => { sec.removeEventListener("pointermove", move); window.removeEventListener("scroll", onScroll); };
    }
    return () => window.removeEventListener("scroll", onScroll);
  }, { scope: root, dependencies: [fonts, lang], revertOnUpdate: true });

  return (
    <div ref={root} className="landing">
      <header className="l-nav night">
        <div className="l-wrap l-nav-in">
          <Brand href={href("/")} />
          <span className="sp" />
          <a className="lnk" href="#story">{t("nav_story")}</a>
          <a className="lnk" href="#scribe">{t("nav_scribe")}</a>
          <a className="lnk" href="#archive">{t("nav_archive")}</a>
          <button className="btn ghost sm" type="button" onClick={() => setLang(ar ? "en" : "ar")}><Icon name="globe" /><span className="hide-sm">{t("lang_switch")}</span></button>
          <button className="btn ghost sm icon-only" type="button" aria-label={t("theme")} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}><Icon name={theme === "dark" ? "sun" : "moon"} /></button>
          <a className="btn sm" href={signedIn ? href("/meetings") : href("/login")}>{t(signedIn ? "open_app" : "signin")}</a>
        </div>
      </header>

      {/* 1 ───────── every meeting, on the record */}
      <section className="s-hero night">
        <svg className="hero-rings" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          {[150, 240, 330, 420, 510].map(r => <circle key={r} cx="500" cy="420" r={r} />)}
        </svg>
        <div className="hero-onair" aria-hidden="true"><i />ON AIR</div>
        <div className="hero-tc" aria-hidden="true"><i />REC <span ref={counter}>00:00:00</span></div>
        <div className="l-wrap hero-in">
          <div className="hero-art" aria-hidden="true">
            <svg className="hero-wave" viewBox="0 0 600 220" preserveAspectRatio="none"><path d={WAVE} /></svg>
            <LogoMark className="hero-mark" stroke width={6.5} />
          </div>
          <span className="kicker hero-kicker">{t("hero_kicker")}</span>
          <h1 className="hero-title display" key={lang}>{t("hero_title")}</h1>
          <p className="hero-lead">{t("hero_lead")}</p>
          <div className="hero-cta">
            <a className="btn signal lg" href={enter}>{t(signedIn ? "open_app" : "cta_start")}<Icon name="arrow" className="icon flip-rtl" /></a>
            <a className="btn lg ghost-night" href="#story">{t("cta_story")}</a>
          </div>
          <p className="hero-note">{t("hero_note")}</p>
        </div>
        <a className="hero-hint" href="#story" aria-label={t("scroll_hint")}><span>{t("scroll_hint")}</span><i /></a>
      </section>

      {/* 2 ───────── from sound to minutes */}
      <section className="s-story" id="story">
        <div className="l-wrap story-in">
          <div className="story-copy">
            <span className="kicker rv">{t("s2_kicker")}</span>
            <h2 className="display rv">{t("s2_title")}</h2>
            <p className="rv">{t("s2_lead")}</p>
          </div>
          <div className="story-stage">
            <div className="story-bars" aria-hidden="true">{BARS.map((h, i) => <i key={i} style={{ height: `${h * 100}%` }} />)}</div>
            <div className="story-mic" aria-hidden="true">
              <span className="mic-glow" />
              <svg viewBox="0 0 120 120">
                <g className="mic-body">
                  <rect className="mic-head" x="41" y="8" width="38" height="62" rx="19" />
                  <path className="mic-grille" d="M49 24h22M46 34h28M46 44h28M49 54h22" />
                </g>
                <path className="mic-arm" d="M30 52v4a30 30 0 0 0 60 0v-4M60 86v16M44 104h32" />
              </svg>
              <svg className="story-cable" viewBox="0 0 200 60" preserveAspectRatio="none"><path d="M4 8 C40 8 40 50 90 46 S150 14 196 30" /></svg>
            </div>
            <article className="ms sheet ruled">
              <header className="ms-head"><span className="display">{t("ms_title")}</span><span className="ts">01:14:32</span></header>
              <p className="ms-line"><span className="ts">00:12:40</span><span className="txt">{t("ms_l1")}</span></p>
              <p className="ms-line"><span className="ts">00:38:05</span><span className="txt">{t("ms_l2")}</span></p>
              <p className="ms-line"><span className="ts">00:58:52</span><span className="txt">{t("ms_l3")}</span></p>
              <div className="ms-grid">
                <div className="ms-section"><h4>{t("ms_dec")}</h4><i className="rule" /><p><Icon name="check" />{t("ms_d1")}</p></div>
                <div className="ms-section"><h4>{t("ms_tasks")}</h4><i className="rule" /><p>{t("ms_t1")}</p><p>{t("ms_t2")}</p></div>
                <div className="ms-section"><h4>{t("ms_owners")}</h4><i className="rule" /><p><Avatar name="Design team" size={20} />{t("ms_o1")}</p><p><Avatar name="Omar" size={20} />{t("ms_o2")}</p></div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* 3 ───────── the tracklist */}
      <section className="s-stages night">
        <div className="stages-head l-wrap">
          <span className="kicker">{t("s3_kicker")}</span>
          <h2 className="display">{t("s3_title")}</h2>
        </div>
        <div className="stages-track">
          <article className="stage stage-1">
            <span className="stage-num">{NUMS[0]}</span><h3 className="display">{t("st1_t")}</h3><p>{t("st1_p")}</p>
            <div className="stage-art art-rec" aria-hidden="true"><span className="rec-dot" />{BARS.slice(0, 22).map((h, i) => <i key={i} style={{ height: `${h * 100}%`, animationDelay: `${-i * 0.09}s` }} />)}</div>
          </article>
          <article className="stage stage-2">
            <span className="stage-num">{NUMS[1]}</span><h3 className="display">{t("st2_t")}</h3><p>{t("st2_p")}</p>
            <div className="stage-art art-tr" aria-hidden="true">
              <p><span className="ts">00:12:40</span><b>Omar</b> {t("ms_l1")}</p>
              <p><span className="ts">00:21:14</span><b>Lina</b> {t("a1_quote")}</p>
              <p><span className="ts">00:38:05</span><b>Sara</b> {t("ms_l2")}</p>
            </div>
          </article>
          <article className="stage stage-3">
            <span className="stage-num">{NUMS[2]}</span><h3 className="display">{t("st3_t")}</h3><p>{t("st3_p")}</p>
            <div className="stage-art art-min" aria-hidden="true">
              <b className="display">{t("ms_dec")}</b><p><Icon name="check" />{t("ms_d1")}</p>
              <b className="display">{t("ms_tasks")}</b><p><Avatar name="Sara" size={20} />{t("ms_t1")}</p><p><Avatar name="Omar" size={20} />{t("ms_t2")}</p>
            </div>
          </article>
          <article className="stage stage-4">
            <span className="stage-num">{NUMS[3]}</span><h3 className="display">{t("st4_t")}</h3><p>{t("st4_p")}</p>
            <div className="stage-art art-send" aria-hidden="true">
              <div className="stage-sheet"><b>PDF</b><i /><i /><i /><i /><i /><Disc className="stage-disc" size={96} /></div>
              <div className="letters">
                {[["-170", "-60"], ["-160", "40"], ["-150", "130"], ["-140", "220"]].map(([x, y], i) => (
                  <span className="letter" key={i} data-x={x} data-y={y}><Icon name="mail" /><em>PDF</em></span>
                ))}
              </div>
              <div className="sent-row"><span>{t("pdf_email")}</span><span>{t("sent_to")}</span></div>
            </div>
          </article>
        </div>
      </section>

      {/* 4 ───────── playback */}
      <ScribeDemo t={t} ar={ar} />

      {/* 5 ───────── the library */}
      <Archive t={t} ar={ar} />

      {/* 6 ───────── on air */}
      <section className="s-close night">
        <div className="close-stage">
          <div className="onair-big" aria-hidden="true"><span className="dim">ON AIR</span><span className="lit">ON AIR</span></div>
          <div className="close-inner">
            <Disc className="close-disc spinning" size={128} />
            <h2 className="display">{t("s6_title")}</h2>
            <p>{t("s6_lead")}</p>
            <a className="btn signal lg close-cta" href={enter}>{t(signedIn ? "open_app" : "s6_cta")}<Icon name="arrow" className="icon flip-rtl" /></a>
          </div>
        </div>
        <footer className="l-foot l-wrap"><Brand href={href("/")} /><span className="sp" /><a href={href("/privacy")}>{t("footer_privacy")}</a></footer>
      </section>
    </div>
  );
}

/* ───────────────────────── 4. Ask Meetly — a console that answers, and scrubs to the moment */
function ScribeDemo({ t, ar }) {
  const [turns, setTurns] = useState([]);
  const [busy, setBusy] = useState(false);
  const box = useRef(null);
  const qs = [["q1", "a1"], ["q2", "a2"], ["q3", "a3"]];

  const ask = idx => {
    if (busy) return;
    const [qk, ak] = qs[idx];
    setBusy(true);
    setTurns(ts => [...ts.slice(-2), { q: t(qk), ak, id: Date.now() }]);
  };
  useEffect(() => { const auto = () => setTurns(ts => (ts.length ? ts : [{ q: t("q1"), ak: "a1", id: 1 }])); window.addEventListener("scribe:auto", auto); return () => window.removeEventListener("scribe:auto", auto); }, [t]);
  useEffect(() => { setTurns([]); }, [ar]);

  // the playhead jumps to the moment, the words come in one after another, then the cue arrives
  useLayoutEffect(() => {
    const last = box.current?.querySelector(".turn:last-child");
    if (!last) return;
    setBusy(true);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { document.querySelector(".scrub")?.style.setProperty("--p", `${(secs(t(turns[turns.length - 1].ak + "_ts")) / LENGTH) * 100}%`); setBusy(false); return; }
    const words = last.querySelectorAll(".ans .w");
    const tl = gsap.timeline({ onComplete: () => setBusy(false) });
    const ts = t(turns[turns.length - 1].ak + "_ts");
    tl.to(".scrub", { "--p": `${(secs(ts) / LENGTH) * 100}%`, duration: 0.9, ease: "power3.inOut" }, 0)
      .from(last.querySelector(".q"), { autoAlpha: 0, y: 10, duration: 0.35 }, 0)
      .from(last.querySelector(".typing-row"), { autoAlpha: 0, duration: 0.2 })
      .to(last.querySelector(".typing-row"), { autoAlpha: 0, height: 0, duration: 0.2, delay: 0.5 })
      .from(words, { autoAlpha: 0, filter: "blur(5px)", y: 2, stagger: 0.045, duration: 0.5, ease: "power2.out" })
      .from(last.querySelector(".margin"), { autoAlpha: 0, x: ar ? -24 : 24, duration: 0.6, ease: "power3.out" }, "-=.3")
      .from(last.querySelector(".margin .rule"), { scaleY: 0, transformOrigin: "50% 0", duration: 0.6 }, "<");
    return () => tl.kill();
  }, [turns.length]);  // eslint-disable-line react-hooks/exhaustive-deps
  const now = turns.length ? t(turns[turns.length - 1].ak + "_ts") : "00:00:00";

  return (
    <section className="s-scribe" id="scribe">
      <div className="l-wrap scribe-in">
        <div className="scribe-copy">
          <span className="kicker rv">{t("s4_kicker")}</span>
          <h2 className="display rv">{t("s4_title")}</h2>
          <p className="rv">{t("s4_lead")}</p>
          <p className="try rv">{t("s4_try")}</p>
          <div className="qs rv">
            {qs.map(([qk], i) => <button key={qk} type="button" className="q-chip" onClick={() => ask(i)} disabled={busy}><Icon name="play" />{t(qk)}</button>)}
          </div>
        </div>
        <div className="scribe-ms" aria-live="polite">
          <div className="console-top" aria-hidden="true">
            <span className="c-rec"><i />ASK MEETLY</span>
            <span className="meters">{BARS.slice(0, 14).map((h, i) => <i key={i} style={{ animationDelay: `${-i * 0.13}s` }} />)}</span>
            <span className="c-tc">{now} / {tc(LENGTH)}</span>
          </div>
          <div className="scrub" aria-hidden="true">
            {BARS.concat(BARS).slice(0, 48).map((h, i) => <i key={i} style={{ height: `${20 + h * 80}%` }} />)}
            <b className="playhead" />
          </div>
          <div className="scribe-page" ref={box}>
            <div className="scribe-title"><LogoMark /><span className="display">{t("s4_kicker")}</span></div>
            {turns.map(tu => (
              <div className="turn" key={tu.id}>
                <p className="q">{tu.q}</p>
                <div className="typing-row"><span className="typing"><i /><i /><i /></span></div>
                <div className="a-row">
                  <p className="ans">{t(tu.ak).split(" ").map((w, i) => <span className="w" key={i}>{w} </span>)}</p>
                  <aside className="margin">
                    <i className="rule" />
                    <span className="m-k">{t("margin_note")}</span>
                    <q>{t(tu.ak + "_quote")}</q>
                    <span className="m-who">— {t(tu.ak + "_who")} <span className="ts">{t(tu.ak + "_ts")}</span></span>
                  </aside>
                </div>
              </div>
            ))}
            {!turns.length && <p className="muted scribe-empty">{t("s4_try")} ↓</p>}
          </div>
          <div className="scribe-input">
            <input type="text" placeholder={t("scribe_ph")} aria-label={t("scribe_ph")} onKeyDown={e => { if (e.key === "Enter" && e.currentTarget.value.trim()) { ask(Math.floor(Math.random() * 3)); e.currentTarget.value = ""; } }} />
            <button className="btn signal icon-only" type="button" aria-label="send" onClick={e => { const i = e.currentTarget.previousSibling; if (i.value.trim()) { ask(0); i.value = ""; } }}><Icon name="send" /></button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── 5. the library — tapes that open into the minutes (Flip) */
function Archive({ t, ar }) {
  const [open, setOpen] = useState(null);
  const flipState = useRef(null);
  const sec = useRef(null);

  const last = useRef(null);
  const openScroll = (i, el) => { flipState.current = Flip.getState(el); last.current = i; setOpen(i); };
  const close = () => { const el = sec.current.querySelector(".unrolled"); if (el) flipState.current = Flip.getState(el); setOpen(null); };

  // the tape opens into a full page, and slides back into the rack when closed
  useLayoutEffect(() => {
    if (!flipState.current) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = open !== null ? sec.current.querySelector(".unrolled") : sec.current.querySelector(`.tape-body[data-flip-id="tape-${last.current}"]`);
    Flip.from(flipState.current, { targets, duration: reduce ? 0 : 0.8, ease: "expo.inOut", absolute: true,
      onComplete: () => open !== null && !reduce && gsap.fromTo(".unrolled .content > *", { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, stagger: 0.05, duration: 0.4 }) });
    flipState.current = null;
  }, [open]);

  useEffect(() => { if (open === null) return; const k = e => e.key === "Escape" && close(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [open]);  // eslint-disable-line

  const s = open !== null ? TAPES[open] : null;
  return (
    <section className="s-archive night" id="archive" ref={sec}>
      <div className="l-wrap">
        <span className="kicker rv">{t("s5_kicker")}</span>
        <h2 className="display rv">{t("s5_title")}</h2>
        <p className="rv arch-lead">{t("s5_lead")}</p>
        <div className="shelves">
          {[0, 1].map(row => (
            <div className="shelf" key={row}>
              {TAPES.slice(row * 4, row * 4 + 4).map((sc, j) => {
                const i = row * 4 + j;
                return (
                  <button key={i} type="button" className="tape-item" onClick={e => openScroll(i, e.currentTarget.querySelector(".tape-body"))} aria-label={`${t("open_scroll")}: ${ar ? sc.ar : sc.en}`}>
                    <span className="tape-body" data-flip-id={`tape-${i}`} style={{ visibility: open === i ? "hidden" : undefined }}>
                      <span className="tape-label"><b>{String(i + 1).padStart(2, "0")}</b><em>{ar ? sc.ar : sc.en}</em></span>
                      <span className="tape-window"><i className="reel" /><i className="ribbon" /><i className="reel" /></span>
                      <span className="tape-foot"><i /><i /><i /><i /></span>
                    </span>
                    <span className="tag"><b>{ar ? sc.ar : sc.en}</b><span>{sc.date}</span></span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {s && (
        <div className="unroll-wrap" role="dialog" aria-modal="true" aria-label={ar ? s.ar : s.en} onClick={e => e.target === e.currentTarget && close()}>
          <article className="unrolled sheet ruled" data-flip-id={`tape-${open}`}>
            <div className="content">
              <div className="u-head"><span className="kicker">{t("ms_title")}</span><button className="btn ghost sm icon-only" type="button" aria-label={t("close")} onClick={close}><Icon name="x" /></button></div>
              <h3 className="display">{ar ? s.ar : s.en}</h3>
              <hr className="hair" />
              <h4>{t("ms_dec")}</h4><p><Icon name="check" />{t("ms_d1")}</p>
              <h4>{t("ms_tasks")}</h4><p><Avatar name="Sara" size={22} />{t("ms_t1")}</p><p><Avatar name="Omar" size={22} />{t("ms_t2")}</p>
              <h4>{t("b_open")}</h4><p>{t("ms_l3")}</p>
              <Disc className="u-disc spinning" size={72} />
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
