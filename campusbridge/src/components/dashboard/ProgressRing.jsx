import { useEffect, useState } from 'react';

// A circular progress indicator that sweeps from empty to its value when it appears.
export default function ProgressRing({ percent = 0, size = 68, stroke = 6, label }) {
  const p = Math.max(0, Math.min(100, percent));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(p));
    return () => cancelAnimationFrame(id);
  }, [p]);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={label || `${p}% complete`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="ring__track" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} className="ring__bar" strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span>{p}%</span>
    </div>
  );
}
