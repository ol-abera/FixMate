import { Link } from 'react-router-dom';
import { Clock, ArrowUpRight } from 'lucide-react';
import { tone } from '../utils/format';

export default function CourseCard({ course }) {
  return (
    <Link to={`/courses/${course.id}`} className={`course course--${tone(course.category) === 'forest' ? 'forest' : tone(course.category)}`}>
      {/* A drawn arch instead of a photo: always loads, works offline, never a broken image. */}
      <div className="course__art" aria-hidden="true">
        <span className="course__arc course__arc--1" />
        <span className="course__arc course__arc--2" />
        <span className="course__arc course__arc--3" />
        <span className="course__dot" />
      </div>
      <div className="course__body">
        <div className="course__tags">
          <span className="badge badge-teal">{course.category}</span>
          <span className="badge badge-stone">{course.level}</span>
        </div>
        <h3>{course.title}</h3>
        <p className="course__by">{course.instructor}</p>
        <div className="course__foot">
          {course.duration ? <span><Clock size={14} aria-hidden="true" /> {course.duration}</span> : <span />}
          <span className="course__arrow"><ArrowUpRight size={16} aria-hidden="true" /></span>
        </div>
      </div>
    </Link>
  );
}
