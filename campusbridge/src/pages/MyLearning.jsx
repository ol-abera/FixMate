import { Link } from 'react-router-dom';
import { BookOpen, Trophy } from 'lucide-react';
import { getProgress } from '../services/api';
import useLoad from '../hooks/useLoad';
import PageShell from '../components/PageShell';
import AsyncView from '../components/AsyncView';
import EmptyState from '../components/EmptyState';
import StatTile from '../components/dashboard/StatTile';
import BadgeGrid from '../components/dashboard/BadgeGrid';
import CourseProgress from '../components/dashboard/CourseProgress';

export default function MyLearning() {
  const state = useLoad(() => getProgress().then((r) => r.data));
  return (
    <PageShell
      title="My learning"
      subtitle="Your courses, progress, points and badges."
      maxWidth={960}
      action={<Link to="/leaderboard" className="btn btn-secondary btn-sm"><Trophy size={16} aria-hidden="true" /> Leaderboard</Link>}
    >
      <AsyncView state={state} loadingText="Loading your progress...">
        {(p) => (
          <>
            <div className="stats stats--light">
              <StatTile label="Points" value={p.points} />
              <StatTile label={p.courses.length === 1 ? 'Course' : 'Courses'} value={p.courses.length} />
              <StatTile label={p.submissions === 1 ? 'Submission' : 'Submissions'} value={p.submissions} />
              <StatTile label={p.applications === 1 ? 'Application' : 'Applications'} value={p.applications} />
            </div>

            <section className="dsec">
              <div className="dsec__head"><h2>My courses</h2></div>
              {p.courses.length === 0 ? (
                <EmptyState icon={BookOpen} title="You have not enrolled in a course yet" description="Enrol in a course to get assignments, track your progress and earn points."
                  action={<Link to="/courses" className="btn btn-primary btn-sm">Browse courses</Link>} />
              ) : (
                <div className="dlist">{p.courses.map((c) => <CourseProgress key={c.id} course={c} />)}</div>
              )}
            </section>

            <section className="dsec">
              <div className="dsec__head"><h2>Badges</h2></div>
              <BadgeGrid badges={p.badges} />
            </section>
          </>
        )}
      </AsyncView>
    </PageShell>
  );
}
