import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ClipboardList, GraduationCap, CalendarClock } from 'lucide-react';
import { enrollInCourse, getCourseAssignments, getEnrollment } from '../services/api';
import { useAuth } from '../context/AuthContext';
import useLoad from '../hooks/useLoad';
import { daysUntil, formatDate } from '../utils/format';
import LoadingSpinner from './LoadingSpinner';
import Alert from './Alert';

function AssignmentGroups({ items }) {
  const done = items.filter((a) => a.submission);
  const pending = items.filter((a) => !a.submission);
  const submitted = done.length;
  const percent = items.length ? Math.round((submitted * 100) / items.length) : 0;
  return (
    <>
      <p className="learn__empty">{percent}% complete · {submitted} completed · {pending.length} pending</p>
      {pending.length > 0 && <h3 className="learn__sub">Still to do</h3>}
      <AssignmentList items={pending} />
      {done.length > 0 && <h3 className="learn__sub">Completed</h3>}
      <AssignmentList items={done} />
    </>
  );
}

function AssignmentList({ items }) {
  if (items.length === 0) return null;
  return (
    <ul className="tasks">
      {items.map((a) => {
        const left = a.dueDate ? daysUntil(a.dueDate) : null;
        return (
          <li key={a.id}>
            <Link to={`/assignments/${a.id}`} className="task">
              <div className="task__main">
                <strong>{a.title}</strong>
                <span>
                  {a.maxPoints} points
                  {a.dueDate && <><span aria-hidden="true"> · </span><CalendarClock size={12} aria-hidden="true" /> due {formatDate(a.dueDate)}{!a.submission && !a.isOverdue && left !== null && left >= 0 && left <= 7 ? ` (${left === 0 ? 'today' : `${left}d`})` : ''}</>}
                  {a.submission?.feedback ? ` · ${a.submission.feedback}` : ''}
                </span>
              </div>
              {a.submission
                ? (a.submission.grade === null ? <span className="badge badge-warning">Submitted{a.submission.isLate ? ' late' : ''}</span> : <span className="badge badge-success">{a.submission.grade}/{a.maxPoints}</span>)
                : a.isOverdue ? <span className="badge badge-warning">Late</span> : <span className="badge badge-teal">To do</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// Enrolment and assignments for one course, shown on the course page. What you see depends on your role.
export default function CourseLearning({ courseId }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const status = useLoad(() => (isAuthenticated ? getEnrollment(courseId) : Promise.resolve({ enrolled: false, manages: false })), [courseId, isAuthenticated]);
  const showList = status.data && (status.data.enrolled || status.data.manages);
  const list = useLoad(() => (showList ? getCourseAssignments(courseId).then((r) => r.data) : Promise.resolve([])), [courseId, showList]);

  async function enrol() {
    setBusy(true); setError('');
    try { await enrollInCourse(courseId); } catch (err) { if (err.status !== 409) setError(err.message); }
    setBusy(false);
    status.reload();
  }

  if (status.loading) return <section className="learn"><LoadingSpinner text="Checking enrolment..." /></section>;
  if (status.error) return <section className="learn"><Alert>{status.error.message}</Alert></section>;

  if (!isAuthenticated) {
    return (
      <section className="learn learn--invite">
        <h2>Learn on CampusBridge</h2>
        <p>Log in as a student to enrol, complete assignments and earn points.</p>
        <Link to="/login" state={{ from: location.pathname }} className="btn btn-accent">Log in to enrol</Link>
      </section>
    );
  }
  if (user.role === 'coordinator') return null;
  if (user.role === 'instructor' && !status.data.manages) return null;
  if (user.role === 'instructor') {
    return (
      <section className="learn learn--invite">
        <h2>You teach this course</h2>
        <Link to={`/instructor/courses/${courseId}`} className="btn btn-accent"><ClipboardList size={16} aria-hidden="true" /> Manage assignments</Link>
      </section>
    );
  }

  if (!status.data.enrolled) {
    return (
      <section className="learn learn--invite">
        <h2>Enrol in this course</h2>
        <p>Enrol to see the assignments, submit your work, get graded and earn points.</p>
        <Alert>{error}</Alert>
        <button type="button" className="btn btn-accent" onClick={enrol} disabled={busy}><GraduationCap size={16} aria-hidden="true" /> {busy ? 'Enrolling...' : 'Enrol now'}</button>
      </section>
    );
  }

  return (
    <section className="learn">
      <div className="learn__head">
        <h2>Assignments</h2>
        <p><span className="learn__dot" aria-hidden="true" /> You are enrolled. <Link to="/my-learning">See my progress</Link> · <Link to={`/assistant?course=${encodeURIComponent(courseId)}`}>Ask the AI assistant</Link></p>
      </div>
      {list.loading ? <LoadingSpinner text="Loading assignments..." /> : list.error ? <Alert>{list.error.message}</Alert> : list.data.length === 0 ? (
        <p className="learn__empty">No assignments have been posted yet.</p>
      ) : (
        <AssignmentGroups items={list.data} />
      )}
    </section>
  );
}
