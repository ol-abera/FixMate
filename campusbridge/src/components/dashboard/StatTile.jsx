import useInView from '../../hooks/useInView';
import CountUp from '../ui/CountUp';

// One headline number with a label. The number counts up the first time it is seen.
export default function StatTile({ label, value, hint }) {
  const [ref, seen] = useInView({ threshold: 0.4 });
  return (
    <div className="stat" ref={ref}>
      <div className="stat__value"><CountUp value={value} active={seen} /></div>
      <div className="stat__label">{label}</div>
      {hint && <div className="stat__hint">{hint}</div>}
    </div>
  );
}
