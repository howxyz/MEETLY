// The waveform M: five audio bars that hang into the letter M.
// `stroke` draws it as five ink strokes (for DrawSVG); otherwise solid bars.
export const BARS = [[10, 10, 54], [21, 10, 32], [32, 10, 42], [43, 10, 32], [54, 10, 54]];   // x, y1, y2

export function LogoMark({ className, stroke = false, width = 7 }) {
  if (stroke)
    return (
      <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
        {BARS.map(([x, y1, y2], i) => (
          <line key={i} className={i === 2 ? "lm-mid" : "lm-bar"} x1={x} y1={y1} x2={x} y2={y2} strokeWidth={width} strokeLinecap="round" />
        ))}
      </svg>
    );
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      {BARS.map(([x, y1, y2], i) => (
        <rect key={i} className={i === 2 ? "logo-mid" : "logo-bar"} x={x - 3.5} y={y1} width="7" height={y2 - y1} rx="3.5" />
      ))}
    </svg>
  );
}

export default function Brand({ href = "/", onClick }) {
  return (
    <a className="brand" href={href} onClick={onClick}>
      <LogoMark />
      <span className="word">Meetly</span>
    </a>
  );
}
