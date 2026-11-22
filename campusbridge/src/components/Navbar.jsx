import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, Bell, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getNotifications } from '../services/api';
import { ROLE_HOME } from '../utils/format';
import Logo from './ui/Logo';

const publicLinks = [
  { to: '/opportunities', label: 'Explore opportunities' },
  { to: '/courses', label: 'Courses' },
];
// What each kind of account sees in the menu.
const roleLinks = {
  student: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/opportunities', label: 'Opportunities' },
    { to: '/courses', label: 'Courses' },
    { to: '/my-learning', label: 'My learning' },
    { to: '/applications', label: 'Applications' },
    { to: '/assistant', label: 'AI assistant' },
  ],
  instructor: [
    { to: '/instructor', label: 'My courses' },
    { to: '/courses', label: 'Course catalogue' },
  ],
  coordinator: [
    { to: '/coordinator', label: 'My opportunities' },
    { to: '/opportunities', label: 'All opportunities' },
  ],
  organization: [
    { to: '/organization', label: 'Dashboard' },
    { to: '/organization/profile', label: 'Organisation profile' },
    { to: '/opportunities', label: 'All opportunities' },
  ],
};

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isHome = pathname === '/';

  // Close the mobile menu whenever the page changes.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Lock page scroll behind the open menu; Escape closes it.
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = isAuthenticated ? (roleLinks[user?.role] || roleLinks.student) : publicLinks;

  // Number of unread notifications, refreshed on every page change and when the Notifications page changes them.
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!isAuthenticated) { setUnread(0); return undefined; }
    let cancelled = false;
    const load = () => getNotifications().then((r) => { if (!cancelled) setUnread(r.unread); }).catch(() => {});
    load();
    window.addEventListener('campusbridge:notifications', load);
    return () => { cancelled = true; window.removeEventListener('campusbridge:notifications', load); };
  }, [isAuthenticated, pathname]);

  const initial = (user?.fullName || '?').trim().charAt(0).toUpperCase();

  function handleLogout() {
    logout();
    setOpen(false);
    navigate('/');
  }


  return (
    <header className={`nav nav--dark ${isHome ? 'nav--home' : 'nav--solid'} ${scrolled || open ? 'is-scrolled' : ''} ${open ? 'is-open' : ''}`}>
      <a href="#main" className="skip-link">Skip to content</a>
      <div className="nav__bar">
        <Link to="/" className="nav__brand" aria-label="CampusBridge home">
          <Logo size={32} tone="light" />
          <span>CampusBridge</span>
        </Link>

        <nav className="nav__links" aria-label="Main">
          {links.map(({ to, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav__link ${isActive ? 'is-active' : ''}`}>{label}</NavLink>
          ))}
        </nav>

        <div className="nav__actions">
          {isAuthenticated ? (
            <>
              <NavLink to="/notifications" className="nav__icon" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
                <Bell size={19} aria-hidden="true" />
                {unread > 0 && <span className="nav__dot" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
              </NavLink>
              <NavLink to="/profile" className="nav__avatar" aria-label={`Profile for ${user?.fullName || 'you'}`}>{initial}</NavLink>
              <button type="button" onClick={handleLogout} className="nav__icon" aria-label="Log out"><LogOut size={18} aria-hidden="true" /></button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav__link nav__login">Log in</Link>
              <Link to="/register" className="btn btn-sm nav__cta">Sign up</Link>
            </>
          )}
        </div>

        <button className="nav__toggle" type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? 'Close menu' : 'Open menu'}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <div id="mobile-menu" className={`menu ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <nav aria-label="Mobile" className="menu__links">
          {links.map(({ to, label }, i) => (
            <NavLink key={to} to={to} tabIndex={open ? 0 : -1} className="menu__link" style={{ '--i': i }}>
              {label} <ArrowRight size={20} aria-hidden="true" />
            </NavLink>
          ))}
          {isAuthenticated && (
            <>
              <NavLink to="/notifications" tabIndex={open ? 0 : -1} className="menu__link" style={{ '--i': links.length }}>
                Notifications{unread ? ` (${unread})` : ''} <ArrowRight size={20} aria-hidden="true" />
              </NavLink>
              <NavLink to="/profile" tabIndex={open ? 0 : -1} className="menu__link" style={{ '--i': links.length + 1 }}>
                Profile <ArrowRight size={20} aria-hidden="true" />
              </NavLink>
            </>
          )}
        </nav>
        <div className="menu__foot">
          {isAuthenticated ? (
            <>
              <p>Signed in as {user?.fullName}</p>
              <Link to={ROLE_HOME[user?.role] || '/dashboard'} tabIndex={open ? 0 : -1} className="btn btn-cream btn-lg">Go to my space</Link>
              <button type="button" tabIndex={open ? 0 : -1} className="btn btn-outline-cream btn-lg" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/register" tabIndex={open ? 0 : -1} className="btn btn-accent btn-lg">Create your account</Link>
              <Link to="/login" tabIndex={open ? 0 : -1} className="btn btn-outline-cream btn-lg">Log in</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
