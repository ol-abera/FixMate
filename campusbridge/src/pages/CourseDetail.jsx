import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, BarChart3, User } from 'lucide-react';
import { getCourseById } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import SampleNotice from '../components/SampleNotice';
import CourseLearning from '../components/CourseLearning';
import { tone } from '../utils/format';

export default function CourseDetail() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCourseById(id)
      .then((res) => { if (!cancelled) setCourse(res.data); })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, reloadKey]);

  if (loading) return <LoadingSpinner size="lg" text="Loading course..." />;
  if (error || !course) {
    const notFound = error?.status === 404;
    return (
      <div className="state-page">
        <ErrorState
          title={notFound ? 'Course not found' : 'Could not load this course'}
          message={notFound ? 'This course does not exist or may have been removed.' : error?.message}
          onRetry={notFound ? undefined : () => setReloadKey((k) => k + 1)}
        />
        <div className="state-page__back">
          <Link to="/courses" className="btn btn-secondary btn-sm"><ArrowLeft size={16} /> Back to Courses</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <section className={`dhero dhero--${tone(course.category) === 'amber' ? 'amber' : 'sage'}`}>
        <div className="container">
          <Link to="/courses" className="dhero__back"><ArrowLeft size={16} aria-hidden="true" /> Back to Courses</Link>
          <div className="dhero__tags">
            <span className="badge badge-teal">{course.category}</span>
            <span className="badge badge-stone">{course.level}</span>
            {course.tags?.map((t) => <span key={t} className="badge dhero__tag">{t}</span>)}
          </div>
          <h1>{course.title}</h1>
          <dl className="facts">
            <div><dt><User size={15} aria-hidden="true" /> Instructor</dt><dd>{course.instructor}</dd></div>
            <div><dt><BarChart3 size={15} aria-hidden="true" /> Level</dt><dd>{course.level}</dd></div>
            {course.duration && <div><dt><Clock size={15} aria-hidden="true" /> Duration</dt><dd>{course.duration}</dd></div>}
          </dl>
        </div>
      </section>

      <div className="container detail">
        <div className="detail__main">
          <SampleNotice what="course details" />
          <section className="prose-card">
            <h2>About this course</h2>
            <p>{course.description}</p>
          </section>

          {course.syllabus?.length > 0 && (
            <section className="prose-card">
              <h2>Course materials</h2>
              <ol className="topics">
                {course.syllabus.map((item) => <li key={item}>{item}</li>)}
              </ol>
            </section>
          )}

          <CourseLearning courseId={course.id} />
        </div>

        <aside className="detail__side">
          <div className="apply">
            <h3>Course details</h3>
            <div className="apply__rows">
              <div className="detail-row"><span>Level</span><strong>{course.level}</strong></div>
              <div className="detail-row"><span>Category</span><strong>{course.category}</strong></div>
              {course.duration && <div className="detail-row"><span>Duration</span><strong>{course.duration}</strong></div>}
            </div>
            <p className="muted-box">Enrol to get assignments, submit your work, receive grades and earn points and badges. Certificates are not offered.</p>
            <Link to={`/opportunities?category=${encodeURIComponent(course.category)}`} className="btn btn-secondary" style={{ width: '100%' }}>Related opportunities</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
