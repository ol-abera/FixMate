// "YYYY-MM-DD" (a calendar date with no time zone) -> "Mar 20, 2027". Noon avoids a one-day shift.
export const formatDate = (yyyyMmDd) =>
  yyyyMmDd ? new Date(`${yyyyMmDd}T12:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

export const formatDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

export const ROLE_HOME = { student: '/dashboard', instructor: '/instructor', coordinator: '/coordinator', organization: '/organization' };
export const ROLE_LABEL = { student: 'Student', instructor: 'Instructor', coordinator: 'Internship coordinator', organization: 'Organisation' };

// Whole days from today until a "YYYY-MM-DD" date (negative once it has passed). null when there is no valid date.
export function daysUntil(yyyyMmDd) {
  if (!yyyyMmDd) return null;
  const end = new Date(`${yyyyMmDd}T12:00:00`);
  if (Number.isNaN(end.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  return Math.round((end.getTime() - today.getTime()) / 86400000);
}

// A short human label and a tone for an opportunity's deadline: "Closed", "Closes today", "5 days left", "Apply by Mar 20, 2027".
export function deadlineInfo(opportunity) {
  const { deadline, isClosed } = opportunity;
  const days = daysUntil(deadline);
  if (isClosed) return { label: deadline ? `Closed ${formatDate(deadline)}` : 'Closed', tone: 'closed', days };
  // No fixed date: send the student to the official page when there is one.
  if (days === null) return { label: opportunity.sourceUrl ? 'See official page' : 'Open', tone: 'open', days };
  if (days === 0) return { label: 'Closes today', tone: 'urgent', days };
  if (days <= 14) return { label: days === 1 ? '1 day left' : `${days} days left`, tone: 'urgent', days };
  return { label: `Apply by ${formatDate(deadline)}`, tone: 'open', days };
}

// Picks one of three brand colourways from a type or category word, so the same word always looks the same.
export function tone(word = '') {
  const w = String(word).toLowerCase();
  if (/scholar|compet|contest|hackathon|grant/.test(w)) return 'amber';
  if (/research|fellow|course|learn/.test(w)) return 'sage';
  return 'forest';
}
