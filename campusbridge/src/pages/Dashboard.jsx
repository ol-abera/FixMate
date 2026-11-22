import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Bell, CalendarClock, Trophy } from 'lucide-react';
import { getDashboard, getRecommendations } from '../services/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import OpportunityCard from '../components/OpportunityCard';
import ApplicationCard from '../components/ApplicationCard';
import StatTile from '../components/dashboard/StatTile';
import BadgeGrid from '../components/dashboard/BadgeGrid';
import CourseProgress from '../components/dashboard/CourseProgress';
import { ROLE_HOME, daysUntil, formatDate } from '../utils/format';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

function SectionHead({ title, to, label = 'View all' }) {
  return (
    <div className="dsec__head">
      <h2>{title}</h2>
      {to && <Link to={to}>{label} <ArrowRight size={15} aria-hidden="true" /></Link>}
    </div>
  );
}

function StudentDashboard() {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [recs, setRecs] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    getDashboard()
      .then((res) => { if (!cancelled) setState({ loading: false, error: null, data: res.data }); })
      .catch((err) => { if (!cancelled) setState({ loading: false, error: err.message || 'Could not load your dashboard.', data: null }); });
    getRecommendations(4).then((r) => { if (!cancelled) setRecs(r); }).catch(() => { if (!cancelled) setRecs({ data: [], missingProfile: [] }); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  if (state.loading) return <div className="state-page"><LoadingSpinner size="lg" text="Loading your dashboard..." /></div>;
  if (state.error) return <div className="state-page container"><ErrorState message={state.error} onRetry={() => setReloadKey((k) => k + 1)} /></div>;

  const { progress, upcoming, grades, applications, saved, discover, notifications } = state.data;
  const first = user?.fullName?.split(' ')[0] || 'there';
  const earned = progress.badges.filter((b) => b.earned).length;
  const profileLine = [user?.university, user?.yearOfStudy, user?.field].filter(Boolean).join(' · ');
  const recentNotes = notifications.data || [];
  const nextAssignment = upcoming[0];
  const showDiscover = saved.length === 0 && recs && recs.data.length === 0 && discover.length > 0;

  return (
    <div className="page-enter">
      <section className="dhead">
        <div className="container">
          <div className="dhead__top">
            <div className="dhead__who">
              <span className="dhead__avatar" aria-hidden="true">{(user?.fullName || '?').trim().charAt(0).toUpperCase()}</span>
              <div>
                <h1>{greeting()}, {first}.</h1>
                {profileLine && <p>{profileLine}</p>}
              </div>
            </div>
            <div className="dhead__actions">
              <Link to="/courses" className="btn btn-outline-cream btn-sm">View courses</Link>
              <Link to={nextAssignment ? `/assignments/${nextAssignment.id}` : '/my-learning'} className="btn btn-cream btn-sm">Submit assignments</Link>
              <Link to="/opportunities" className="btn btn-outline-cream btn-sm">Find opportunities</Link>
              <Link to="/applications" className="btn btn-outline-cream btn-sm">View applications</Link>
              <Link to="/profile" className="btn btn-outline-cream btn-sm">Update profile</Link>
              <Link to="/leaderboard" className="btn btn-cream btn-sm"><Trophy size={15} aria-hidden="true" /> Leaderboard</Link>
            </div>
          </div>
          <div className="stats">
            <StatTile label="Points" value={progress.points} />
            <StatTile label={progress.courses.length === 1 ? 'Course' : 'Courses'} value={progress.courses.length} />
            <StatTile label={progress.submissions === 1 ? 'Submission' : 'Submissions'} value={progress.submissions} />
            <StatTile label={progress.applications === 1 ? 'Application' : 'Applications'} value={progress.applications} />
            <StatTile label={`Badges of ${progress.badges.length}`} value={earned} />
          </div>
        </div>
      </section>

      <div className="container dgrid">
        <div className="dgrid__main">
          <section className="dsec">
            <SectionHead title="Continue learning" to="/my-learning" label="All my learning" />
            {progress.courses.length === 0 ? (
              <div className="dempty">
                <p>You have not enrolled in a course yet. Enrol to get assignments, track progress and earn points.</p>
                <Link to="/courses" className="btn btn-primary btn-sm">Browse courses</Link>
              </div>
            ) : (
              <div className="dlist">{progress.courses.map((c) => <CourseProgress key={c.id} course={c} />)}</div>
            )}
          </section>

          {progress.courses.length > 0 && (
            <section className="dsec">
              <SectionHead title="Up next" to="/my-learning" label="My learning" />
              {upcoming.length === 0 ? (
                <div className="dempty"><p>Nothing due. Assignments you still need to submit will appear here.</p></div>
              ) : (
                <ul className="tasks">
                  {upcoming.map((a) => {
                    const left = a.dueDate ? daysUntil(a.dueDate) : null;
                    return (
                      <li key={a.id}>
                        <Link to={`/assignments/${a.id}`} className="task">
                          <div className="task__main">
                            <strong>{a.title}</strong>
                            <span>{a.courseTitle}{a.dueDate && <><span aria-hidden="true"> · </span><CalendarClock size={12} aria-hidden="true" /> due {formatDate(a.dueDate)}</>}</span>
                          </div>
                          {a.isOverdue ? <span className="badge badge-warning">Late</span> : left !== null && left <= 7 ? <span className="badge badge-warning">{left === 0 ? 'Due today' : `${left} day${left === 1 ? '' : 's'} left`}</span> : <span className="badge badge-teal">To do</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          <section className="dsec">
            <SectionHead title="Recent grades" to="/my-learning" label="My learning" />
            {grades.length === 0 ? (
              <div className="dempty"><p>Grades and instructor feedback will appear here after your work is marked.</p></div>
            ) : (
              <ul className="tasks">
                {grades.map((g) => (
                  <li key={g.assignmentId}>
                    <Link to={`/assignments/${g.assignmentId}`} className="task">
                      <div className="task__main">
                        <strong>{g.title}</strong>
                        <span>{g.courseTitle}{g.feedback ? ` · ${g.feedback}` : ''}</span>
                      </div>
                      <span className="badge badge-success">{g.grade}/{g.maxPoints}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {recs && (
            <section className="dsec">
              <SectionHead title="Recommended for you" to="/opportunities" label="All opportunities" />
              {recs.missingProfile.length > 0 && (
                <p className="muted-box" style={{ marginBottom: 14 }}>
                  Add your {recs.missingProfile.join(', ')} on your <Link to="/profile" style={{ textDecoration: 'underline' }}>profile</Link> for better matches.
                </p>
              )}
              {recs.data.length === 0 ? (
                <div className="dempty">
                  <p>No matches yet. Matches use your university, field of study, year of study and skills.</p>
                  <Link to="/profile" className="btn btn-primary btn-sm">Complete your profile</Link>
                </div>
              ) : (
                <div className="grid">{recs.data.map((o) => <OpportunityCard key={o.id} opportunity={o} showMatch />)}</div>
              )}
            </section>
          )}

          <section className="dsec">
            <SectionHead title="Saved opportunities" to="/opportunities" label="Find more" />
            {saved.length === 0 ? (
              <div className="dempty">
                <p>Save an opportunity to keep it here while you decide.</p>
                <Link to="/opportunities" className="btn btn-primary btn-sm">Find opportunities</Link>
              </div>
            ) : (
              <div className="grid">{saved.map((o) => <OpportunityCard key={o.id} opportunity={o} />)}</div>
            )}
          </section>

          <section className="dsec">
            <SectionHead title="My applications" to="/applications" />
            {applications.length === 0 ? (
              <div className="dempty">
                <p>You have not submitted any applications yet.</p>
                <Link to="/opportunities" className="btn btn-primary btn-sm">Browse opportunities</Link>
              </div>
            ) : (
              <div className="dlist">{applications.map((a) => <ApplicationCard key={a.id} application={a} />)}</div>
            )}
          </section>

          {showDiscover && (
            <section className="dsec">
              <SectionHead title="Open opportunities" to="/opportunities" />
              <div className="grid">{discover.map((o) => <OpportunityCard key={o.id} opportunity={o} />)}</div>
            </section>
          )}
        </div>

        <aside className="dgrid__side">
          <section className="dside">
            <div className="dsec__head">
              <h2><Bell size={18} aria-hidden="true" /> Notifications{notifications.unread > 0 && <span className="badge badge-amber">{notifications.unread} new</span>}</h2>
              <Link to="/notifications">All <ArrowRight size={15} aria-hidden="true" /></Link>
            </div>
            {recentNotes.length === 0 ? <p className="dside__empty">No notifications yet.</p> : (
              <ul className="notes">
                {recentNotes.map((n) => (
                  <li key={n.id} className={n.isRead ? '' : 'is-new'}>
                    <Link to={n.link || '/notifications'}>{n.message}</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="dside">
            <div className="dsec__head"><h2>Badges</h2><Link to="/my-learning">Details <ArrowRight size={15} aria-hidden="true" /></Link></div>
            <BadgeGrid badges={progress.badges} compact />
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  if (user.role !== 'student') return <Navigate to={ROLE_HOME[user.role]} replace />;
  return <StudentDashboard />;
}
