import { useEffect, useState } from 'react';
import useReducedMotion from './useReducedMotion';

// Counts from 0 up to `target` once `active` becomes true. Shows the final number immediately for reduced motion.
export default function useCountUp(target, { active = true, duration = 1400 } = {}) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) { setValue(target); return undefined; }
    if (!active || typeof target !== 'number') return undefined;
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration, reduced]);
  return value;
}
