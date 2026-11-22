import { Link } from 'react-router-dom';
import Campus from '../story/Campus';

// Shared frame for log in and sign up: a forest panel with the campus on one side, the form on the other.
export default function AuthLayout({ title, lead, panelTitle, panelText, footer, children }) {
  return (
    <div className="auth page-enter">
      <aside className="auth__panel" aria-hidden="false">
        <div className="auth__panel-in">
          <h2>{panelTitle}</h2>
          <p>{panelText}</p>
        </div>
        <Campus className="auth__campus" />
      </aside>
      <div className="auth__main">
        <div className="auth__card">
          <h1>{title}</h1>
          <p className="auth__lead">{lead}</p>
          {children}
          <p className="auth__foot">{footer}</p>
        </div>
        <Link to="/" className="auth__home">Back to the story</Link>
      </div>
    </div>
  );
}
