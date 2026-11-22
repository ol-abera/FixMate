import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOME } from '../utils/format';
import { CONTACT_EMAIL } from '../config';
import Logo from './ui/Logo';

export default function Footer() {
  const { isAuthenticated, user } = useAuth();

  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <div className="footer__logo"><Logo size={34} tone="light" /><span>CampusBridge</span></div>
          <p>Your bridge to academic excellence and career opportunities for university students in South West Ethiopia and beyond.</p>
        </div>

        <div>
          <h4>Explore</h4>
          <Link to="/opportunities">Opportunities</Link>
          <Link to="/courses">Courses</Link>
          {isAuthenticated && user?.role === 'student' && <Link to="/applications">My applications</Link>}
          {isAuthenticated && user?.role === 'student' && <Link to="/leaderboard">Leaderboard</Link>}
        </div>

        <div>
          <h4>Account</h4>
          {isAuthenticated ? (
            <>
              <Link to={ROLE_HOME[user?.role] || '/dashboard'}>Dashboard</Link>
              <Link to="/profile">Profile</Link>
              <Link to="/notifications">Notifications</Link>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/register">Sign up</Link>
            </>
          )}
        </div>

        <div>
          <h4>Contact</h4>
          {CONTACT_EMAIL ? (
            <a href={`mailto:${CONTACT_EMAIL}`} className="footer__mail"><Mail size={14} aria-hidden="true" /> {CONTACT_EMAIL}</a>
          ) : (
            <span>Contact details coming soon.</span>
          )}
        </div>
      </div>

      <div className="container footer__base">
        <p>© {new Date().getFullYear()} CampusBridge. A university student project.</p>
        <p>Ethiopia</p>
      </div>
    </footer>
  );
}
