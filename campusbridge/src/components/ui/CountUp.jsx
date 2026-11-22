import useCountUp from '../../hooks/useCountUp';

export default function CountUp({ value, active = true, className }) {
  const n = useCountUp(value, { active });
  return <span className={className}>{n}</span>;
}
