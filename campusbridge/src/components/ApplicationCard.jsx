import { Link } from 'react-router-dom';
import { Calendar, Building2, ChevronRight } from 'lucide-react';

export const statusClass = {
  Submitted: 'badge-teal',
  'Under Review': 'badge-warning',
  Shortlisted: 'badge-amber',
  Accepted: 'badge-success',
  Rejected: 'badge-error',
  Withdrawn: 'badge-stone',
};

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

export default function ApplicationCard({ application }) {
  return (
    <Link to={`/applications/${application.id}`} className="card card-hover app-row">
      <div className="app-row__icon"><Building2 size={20} strokeWidth={1.6} aria-hidden="true" /></div>
      <div className="app-row__main">
        <div className="app-row__title">
          <span>{application.positionTitle}</span>
          <span className={`badge ${statusClass[application.status] || 'badge-teal'}`}>{application.status}</span>
        </div>
        <p>{application.company}</p>
        <span className="app-row__date"><Calendar size={12} aria-hidden="true" /> Applied {formatDateTime(application.submittedAt)}{application.updatedAt ? ` · Updated ${formatDateTime(application.updatedAt)}` : ''}</span>
      </div>
      <ChevronRight size={18} className="app-row__chev" aria-hidden="true" />
    </Link>
  );
}
