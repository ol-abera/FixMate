import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// The common frame for inner pages: optional back link, title, subtitle and an action button on the right.
export default function PageShell({ title, subtitle, action, back, maxWidth = 900, children }) {
  return (
    <div className="page-enter shell">
      <div className="container" style={{ maxWidth }}>
        {back && (
          <Link to={back.to} className="backlink"><ArrowLeft size={16} aria-hidden="true" /> {back.label}</Link>
        )}
        <div className="shell__head">
          <div style={{ minWidth: 0 }}>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
        {children}
      </div>
    </div>
  );
}
