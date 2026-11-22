import Medal, { markFor } from '../ui/Medal';

export default function BadgeGrid({ badges, compact = false }) {
  return (
    <ul className={`badges ${compact ? 'badges--compact' : ''}`}>
      {badges.map((b) => (
        <li key={b.id} className={`badges__item ${b.earned ? 'is-earned' : ''}`} aria-label={`${b.name}: ${b.earned ? 'earned' : 'locked'}`}>
          <Medal mark={markFor(b.name)} locked={!b.earned} />
          <div>
            <strong>{b.name}</strong>
            <span>{b.description}</span>
            <em>{b.earned ? 'Earned' : 'Locked'}</em>
          </div>
        </li>
      ))}
    </ul>
  );
}
