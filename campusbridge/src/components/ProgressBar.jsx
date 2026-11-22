import { useEffect, useState } from 'react';

// Animated progress bar: grows from empty to its value when it first renders.
export default function ProgressBar({ percent = 0, label }) {
  const p = Math.max(0, Math.min(100, percent));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(p));
    return () => cancelAnimationFrame(id);
  }, [p]);
  return (
    <div className="progress" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={label || 'Progress'}>
      <div className="progress__fill" style={{ '--v': shown / 100 }} />
    </div>
  );
}
