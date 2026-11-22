import { Link } from 'react-router-dom';
import ProgressRing from './ProgressRing';
import ProgressBar from '../ProgressBar';

export default function CourseProgress({ course: c }) {
  return (
    <Link to={`/courses/${c.id}`} className="cprog">
      <ProgressRing percent={c.percent} label={`${c.title}: ${c.percent}% of assignments submitted`} />
      <div className="cprog__main">
        <div className="cprog__top">
          <strong>{c.title}</strong>
          <span>{c.points} points</span>
        </div>
        {c.instructor && <p>{c.instructor}</p>}
        <ProgressBar percent={c.percent} label={`${c.title} progress`} />
        <p>{c.totalAssignments === 0 ? 'No assignments yet' : `${c.percent}% complete · ${c.submitted} completed · ${c.pending ?? Math.max(0, c.totalAssignments - c.submitted)} pending`}</p>
        {c.latestFeedback && <p>Latest feedback{c.latestGrade != null ? ` (${c.latestGrade})` : ''}: {c.latestFeedback}</p>}
      </div>
    </Link>
  );
}
