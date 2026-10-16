"use client";
import DOMPurify from "dompurify";
import { marked } from "marked";

const PALETTE = ["#3a3a3a", "#b4231a", "#52524c", "#7a2f2a", "#2b2b33", "#5c4033", "#8f2a1f", "#44443f"];   // studio greys and signal reds
export function initials(name) {
  const p = String(name || "?").replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((p[0] || "?")[0] + (p[1] ? p[1][0] : "")).toUpperCase();
}
export function colorFor(name) { let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; }

// [00:12:40] → a red timecode chip
export function markTimestamps(html) {
  return html.replace(/\[\s*(\d{1,2}:\d{2}:\d{2})(\s*[–-]\s*\d{1,2}:\d{2}:\d{2})?\s*\]/g,
    (_, a, b) => `<span class="ts">${a}${b ? "–" + b.replace(/[\s–-]/g, "") : ""}</span>`);
}
export function md(text) {
  const raw = marked.parse(text || "", { breaks: true });
  return markTimestamps(typeof window === "undefined" ? raw : DOMPurify.sanitize(raw));
}
export function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
export function plain(text) { return markTimestamps(esc(text)); }
export function fmtDate(iso, lang) {
  if (!iso) return "";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  return isNaN(d) ? iso : d.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
}
export const reducedMotion = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
