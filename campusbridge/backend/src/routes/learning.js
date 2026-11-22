import { Router } from 'express';
import { pool } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errors.js';
import { notify } from '../utils/notify.js';
import { parseId, validateAssignment, validateGrade, validateSubmission } from '../utils/validate.js';
import { applicationToJson } from '../utils/mappers.js';
import { OPPORTUNITY_COLUMNS, toOpportunity } from './catalog.js';
import { ensureStudentNotices } from '../utils/studentNotices.js';
import { UPLOAD_DIR, acceptSubmissionFile, removeStored, safeOriginalName } from '../utils/uploads.js';
import path from 'node:path';

const router = Router();
// Auth is applied per route (not router.use) because this router is mounted on /api: unknown URLs must still be 404.

const TODAY = `(NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date`;
const ASSIGNMENT_COLUMNS = `a.id, a.course_id, a.title, a.description, to_char(a.due_date,'YYYY-MM-DD') AS due_date,
  a.max_points, a.allow_resubmit, COALESCE(a.due_date < ${TODAY}, false) AS is_overdue`;
const SUBMISSION_COLUMNS = `s.id AS sub_id, s.content, s.link, s.submitted_at, s.grade, s.feedback, s.graded_at, s.file_name, s.stored_name, s.is_late`;

const assignmentJson = (r) => ({
  id: String(r.id), courseId: r.course_id, title: r.title, description: r.description, dueDate: r.due_date,
  maxPoints: r.max_points, isOverdue: r.is_overdue, allowResubmit: r.allow_resubmit !== false
});
const submissionJson = (r) => (r && r.sub_id ? {
  id: String(r.sub_id), content: r.content, link: r.link, submittedAt: r.submitted_at,
  grade: r.grade, feedback: r.feedback, gradedAt: r.graded_at,
  fileName: r.file_name || '', hasFile: Boolean(r.stored_name), isLate: Boolean(r.is_late)
} : null);

const isEnrolled = async (userId, courseId) =>
  (await pool.query('SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2', [userId, courseId])).rowCount > 0;
const ownsCourse = async (userId, courseId) =>
  (await pool.query('SELECT 1 FROM courses WHERE id = $1 AND instructor_id = $2', [courseId, userId])).rowCount > 0;
const cleanId = (raw) => String(raw).slice(0, 100);

// ---------------------------------------------------------------- student: enrolment
router.get('/courses/:id/enrollment', requireAuth, asyncHandler(async (req, res) => {
  const course = await pool.query('SELECT instructor_id FROM courses WHERE id = $1', [cleanId(req.params.id)]);
  if (!course.rows[0]) return res.status(404).json({ message: 'Course not found.' });
  const enrolled = req.user.role === 'student' && await isEnrolled(req.user.id, cleanId(req.params.id));
  const manages = req.user.role === 'instructor' && String(course.rows[0].instructor_id) === String(req.user.id);
  res.json({ enrolled, manages });
}));

router.post('/courses/:id/enroll', requireAuth, requireRole('student'), asyncHandler(async (req, res) => {
  const courseId = cleanId(req.params.id);
  const course = await pool.query('SELECT id, title, instructor_id FROM courses WHERE id = $1', [courseId]);
  if (!course.rows[0]) return res.status(404).json({ message: 'Course not found.' });
  const r = await pool.query('INSERT INTO enrollments (user_id, course_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id', [req.user.id, courseId]);
  if (!r.rowCount) return res.status(409).json({ message: 'You are already enrolled in this course.' });
  if (course.rows[0].instructor_id) {
    await notify(pool, course.rows[0].instructor_id, 'enrollment', `${req.user.full_name} enrolled in ${course.rows[0].title}.`, `/instructor`);
  }
  res.status(201).json({ success: true, enrolled: true });
}));

// ---------------------------------------------------------------- student: progress, badges, leaderboard
async function loadProgress(userId) {
  const courses = await pool.query(
    `SELECT c.id, c.title, c.category, c.level, c.instructor,
       (SELECT COUNT(*) FROM assignments a WHERE a.course_id = c.id)::int AS total,
       (SELECT COUNT(*) FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE a.course_id = c.id AND s.user_id = $1)::int AS submitted,
       (SELECT COUNT(*) FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE a.course_id = c.id AND s.user_id = $1 AND s.grade IS NOT NULL)::int AS graded,
       (SELECT COALESCE(SUM(s.grade),0) FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE a.course_id = c.id AND s.user_id = $1)::int AS points,
       (SELECT s.feedback FROM submissions s JOIN assignments a ON a.id = s.assignment_id
          WHERE a.course_id = c.id AND s.user_id = $1 AND s.feedback <> '' ORDER BY s.graded_at DESC NULLS LAST LIMIT 1) AS latest_feedback,
       (SELECT s.grade FROM submissions s JOIN assignments a ON a.id = s.assignment_id
          WHERE a.course_id = c.id AND s.user_id = $1 AND s.grade IS NOT NULL ORDER BY s.graded_at DESC NULLS LAST LIMIT 1) AS latest_grade
     FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.user_id = $1 ORDER BY e.enrolled_at DESC`, [userId]);
  const stats = (await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM submissions WHERE user_id = $1)::int AS submissions,
       (SELECT COUNT(*) FROM applications WHERE user_id = $1)::int AS applications,
       (SELECT COALESCE(SUM(grade),0) FROM submissions WHERE user_id = $1)::int AS points,
       (SELECT COUNT(*) FROM submissions s JOIN assignments a ON a.id = s.assignment_id
          WHERE s.user_id = $1 AND s.grade IS NOT NULL AND s.grade * 10 >= a.max_points * 9)::int AS top_grades`, [userId])).rows[0];
  const courseList = courses.rows.map((c) => ({
    id: c.id, title: c.title, category: c.category, level: c.level, instructor: c.instructor,
    totalAssignments: c.total, submitted: c.submitted, pending: Math.max(0, c.total - c.submitted),
    graded: c.graded, points: c.points, percent: c.total ? Math.round((c.submitted * 100) / c.total) : 0,
    latestFeedback: c.latest_feedback || '', latestGrade: c.latest_grade
  }));
  const badges = [
    { id: 'first-steps', name: 'First Steps', description: 'Enrol in your first course.', earned: courseList.length >= 1 },
    { id: 'first-submission', name: 'Doer', description: 'Submit your first assignment.', earned: stats.submissions >= 1 },
    { id: 'high-achiever', name: 'High Achiever', description: 'Score 90% or more on an assignment.', earned: stats.top_grades >= 1 },
    { id: 'finisher', name: 'Course Finisher', description: 'Submit every assignment in a course.', earned: courseList.some((c) => c.totalAssignments > 0 && c.submitted >= c.totalAssignments) },
    { id: 'applicant', name: 'Go-Getter', description: 'Apply for an opportunity.', earned: stats.applications >= 1 }
  ];
  return { points: stats.points, submissions: stats.submissions, applications: stats.applications, courses: courseList, badges };
}

router.get('/progress', requireAuth, requireRole('student'), asyncHandler(async (req, res) => {
  res.json({ data: await loadProgress(req.user.id) });
}));

router.get('/dashboard', requireAuth, requireRole('student'), asyncHandler(async (req, res) => {
  await ensureStudentNotices(req.user);
  const [progress, upcoming, grades, applications, saved, notes, unread, discover] = await Promise.all([
    loadProgress(req.user.id),
    pool.query(
      `SELECT a.id, a.title, a.course_id, c.title AS course_title, to_char(a.due_date,'YYYY-MM-DD') AS due_date,
              COALESCE(a.due_date < ${TODAY}, false) AS is_overdue
       FROM assignments a
       JOIN enrollments e ON e.course_id = a.course_id AND e.user_id = $1
       JOIN courses c ON c.id = a.course_id
       LEFT JOIN submissions s ON s.assignment_id = a.id AND s.user_id = $1
       WHERE s.id IS NULL
       ORDER BY a.due_date NULLS LAST, a.id LIMIT 4`, [req.user.id]),
    pool.query(
      `SELECT a.id, a.title, a.max_points, c.title AS course_title, s.grade, s.feedback, s.graded_at
       FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN courses c ON c.id = a.course_id
       WHERE s.user_id = $1 AND s.grade IS NOT NULL
       ORDER BY s.graded_at DESC NULLS LAST, s.id DESC LIMIT 4`, [req.user.id]),
    pool.query(
      `SELECT id, opportunity_id, position_title, company, status, submitted_at, updated_at
       FROM applications WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 4`, [req.user.id]),
    pool.query(
      `SELECT ${OPPORTUNITY_COLUMNS}, TRUE AS saved,
         (SELECT ap.status FROM applications ap WHERE ap.opportunity_id = opportunities.id AND ap.user_id = $1 LIMIT 1) AS application_status
       FROM saved_opportunities sv JOIN opportunities ON opportunities.id = sv.opportunity_id
       WHERE sv.user_id = $1 ORDER BY sv.created_at DESC LIMIT 4`, [req.user.id]),
    pool.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 4', [req.user.id]),
    pool.query('SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND NOT is_read', [req.user.id]),
    pool.query(
      `SELECT ${OPPORTUNITY_COLUMNS}, FALSE AS saved, NULL::text AS application_status FROM opportunities
       WHERE deadline IS NULL OR deadline >= ${TODAY}
       ORDER BY deadline NULLS LAST, title LIMIT 3`)
  ]);
  res.json({
    data: {
      progress,
      upcoming: upcoming.rows.map((a) => ({ id: String(a.id), title: a.title, courseId: a.course_id, courseTitle: a.course_title, dueDate: a.due_date, isOverdue: a.is_overdue })),
      grades: grades.rows.map((g) => ({ assignmentId: String(g.id), title: g.title, courseTitle: g.course_title, grade: g.grade, maxPoints: g.max_points, feedback: g.feedback, gradedAt: g.graded_at })),
      applications: applications.rows.map((a) => applicationToJson(a)),
      saved: saved.rows.map(toOpportunity),
      discover: discover.rows.map(toOpportunity),
      notifications: {
        data: notes.rows.map((n) => ({ id: String(n.id), type: n.type, message: n.message, link: n.link, isRead: n.is_read, createdAt: n.created_at })),
        unread: unread.rows[0].n
      }
    }
  });
}));

router.get('/enrollments', requireAuth, requireRole('student'), asyncHandler(async (req, res) => {
  res.json({ data: (await loadProgress(req.user.id)).courses });
}));

// Only a display name and points are shown: no email or other personal details.
router.get('/leaderboard', requireAuth, asyncHandler(async (_req, res) => {
  const r = await pool.query(
    `SELECT u.full_name, u.university, SUM(s.grade)::int AS points, COUNT(s.id)::int AS graded
     FROM submissions s JOIN users u ON u.id = s.user_id
     WHERE s.grade IS NOT NULL AND u.role = 'student'
     GROUP BY u.id HAVING SUM(s.grade) > 0 ORDER BY points DESC, u.full_name LIMIT 10`);
  const shortName = (n) => { const [first, ...rest] = n.trim().split(/\s+/); return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first; };
  res.json({ data: r.rows.map((x, i) => ({ rank: i + 1, name: shortName(x.full_name), university: x.university, points: x.points, graded: x.graded })) });
}));

// ---------------------------------------------------------------- assignments (students and the course's instructor)
router.get('/courses/:id/assignments', requireAuth, requireRole('student', 'instructor'), asyncHandler(async (req, res) => {
  const courseId = cleanId(req.params.id);
  if (!(await pool.query('SELECT 1 FROM courses WHERE id = $1', [courseId])).rowCount) return res.status(404).json({ message: 'Course not found.' });
  if (req.user.role === 'student') {
    if (!(await isEnrolled(req.user.id, courseId))) return res.status(403).json({ message: 'Enrol in this course to see its assignments.' });
    const r = await pool.query(
      `SELECT ${ASSIGNMENT_COLUMNS}, ${SUBMISSION_COLUMNS}
       FROM assignments a LEFT JOIN submissions s ON s.assignment_id = a.id AND s.user_id = $2
       WHERE a.course_id = $1 ORDER BY a.due_date NULLS LAST, a.id`, [courseId, req.user.id]);
    return res.json({ data: r.rows.map((x) => ({ ...assignmentJson(x), submission: submissionJson(x) })) });
  }
  if (!(await ownsCourse(req.user.id, courseId))) return res.status(403).json({ message: 'You can only manage your own courses.' });
  const r = await pool.query(
    `SELECT ${ASSIGNMENT_COLUMNS},
       (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id)::int AS submission_count,
       (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id AND s.grade IS NULL)::int AS pending_count
     FROM assignments a WHERE a.course_id = $1 ORDER BY a.due_date NULLS LAST, a.id`, [courseId]);
  res.json({ data: r.rows.map((x) => ({ ...assignmentJson(x), submissionCount: x.submission_count, pendingCount: x.pending_count })) });
}));

router.get('/assignments/:id', requireAuth, requireRole('student', 'instructor'), asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ message: 'Assignment not found.' });
  const r = await pool.query(
    `SELECT ${ASSIGNMENT_COLUMNS}, c.title AS course_title, c.instructor_id FROM assignments a JOIN courses c ON c.id = a.course_id WHERE a.id = $1`, [id]);
  const a = r.rows[0];
  if (!a) return res.status(404).json({ message: 'Assignment not found.' });
  const base = { ...assignmentJson(a), courseTitle: a.course_title };
  if (req.user.role === 'instructor') {
    if (String(a.instructor_id) !== String(req.user.id)) return res.status(403).json({ message: 'You can only manage your own courses.' });
    return res.json({ data: base });
  }
  if (!(await isEnrolled(req.user.id, a.course_id))) return res.status(403).json({ message: 'Enrol in this course to see its assignments.' });
  const s = await pool.query(
    `SELECT ${SUBMISSION_COLUMNS} FROM submissions s WHERE s.assignment_id = $1 AND s.user_id = $2`, [id, req.user.id]);
  res.json({ data: { ...base, submission: submissionJson(s.rows[0]) } });
}));

router.post('/assignments/:id/submissions', requireAuth, requireRole('student'), acceptSubmissionFile, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ message: 'Assignment not found.' });
  const { errors, value } = validateSubmission(req.body);
  if (Object.keys(errors).length) {
    if (req.file) await removeStored(req.file.filename);
    return res.status(400).json({ message: Object.values(errors)[0], errors });
  }

  const r = await pool.query(
    `SELECT ${ASSIGNMENT_COLUMNS}, c.title AS course_title, c.instructor_id FROM assignments a JOIN courses c ON c.id = a.course_id WHERE a.id = $1`, [id]);
  const a = r.rows[0];
  if (!a) {
    if (req.file) await removeStored(req.file.filename);
    return res.status(404).json({ message: 'Assignment not found.' });
  }
  if (!(await isEnrolled(req.user.id, a.course_id))) {
    if (req.file) await removeStored(req.file.filename);
    return res.status(403).json({ message: 'Enrol in this course before submitting work.' });
  }

  const existing = await pool.query(
    'SELECT id, grade, stored_name FROM submissions WHERE assignment_id = $1 AND user_id = $2',
    [id, req.user.id]
  );
  const previous = existing.rows[0];
  if (previous && (previous.grade !== null || a.allow_resubmit === false)) {
    if (req.file) await removeStored(req.file.filename);
    const message = previous.grade !== null
      ? 'This assignment has already been graded and cannot be resubmitted.'
      : 'This assignment does not allow another submission.';
    return res.status(409).json({ message });
  }

  const isLate = Boolean(a.is_overdue);
  const fileName = req.file ? safeOriginalName(req.file) : '';
  const storedName = req.file ? req.file.filename : '';
  try {
    let row;
    let created = false;
    if (previous) {
      if (storedName && previous.stored_name) await removeStored(previous.stored_name);
      row = (await pool.query(
        `UPDATE submissions SET content = $1, link = $2, submitted_at = NOW(), is_late = $3,
           file_name = CASE WHEN $4 <> '' THEN $4 ELSE file_name END,
           stored_name = CASE WHEN $5 <> '' THEN $5 ELSE stored_name END
         WHERE id = $6 RETURNING id, submitted_at, is_late`,
        [value.content, value.link, isLate, fileName, storedName, previous.id]
      )).rows[0];
    } else {
      created = true;
      row = (await pool.query(
        `INSERT INTO submissions (assignment_id, user_id, content, link, is_late, file_name, stored_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, submitted_at, is_late`,
        [id, req.user.id, value.content, value.link, isLate, fileName, storedName]
      )).rows[0];
      if (a.instructor_id) {
        await notify(pool, a.instructor_id, 'submission', `${req.user.full_name} submitted "${a.title}".`, `/instructor/assignments/${id}`, `submission:${id}:${req.user.id}`);
      }
    }
    res.status(created ? 201 : 200).json({
      success: true,
      data: { id: String(row.id), submittedAt: row.submitted_at, isLate: row.is_late, resubmitted: !created }
    });
  } catch (err) {
    if (req.file) await removeStored(req.file.filename);
    if (err.code === '23505') return res.status(409).json({ message: 'You have already submitted this assignment.' });
    throw err;
  }
}));

router.get('/submissions/:id/file', requireAuth, asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ message: 'File not found.' });
  const s = await pool.query(
    `SELECT s.file_name, s.stored_name, s.user_id, c.instructor_id
     FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN courses c ON c.id = a.course_id
     WHERE s.id = $1`, [id]);
  const row = s.rows[0];
  const owns = row && (String(row.user_id) === String(req.user.id) || (req.user.role === 'instructor' && String(row.instructor_id) === String(req.user.id)));
  if (!owns || !row.stored_name) return res.status(404).json({ message: 'File not found.' });
  const full = path.join(UPLOAD_DIR, path.basename(row.stored_name));
  res.download(full, row.file_name || 'submission', (err) => {
    if (err && !res.headersSent) res.status(404).json({ message: 'File not found.' });
  });
}));

// ---------------------------------------------------------------- instructor
router.get('/instructor/courses', requireAuth, requireRole('instructor'), asyncHandler(async (req, res) => {
  const r = await pool.query(
    `SELECT c.id, c.title, c.category, c.level,
       (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id)::int AS students,
       (SELECT COUNT(*) FROM assignments a WHERE a.course_id = c.id)::int AS assignments,
       (SELECT COUNT(*) FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE a.course_id = c.id AND s.grade IS NULL)::int AS pending
     FROM courses c WHERE c.instructor_id = $1 ORDER BY c.title`, [req.user.id]);
  res.json({ data: r.rows.map((c) => ({ id: c.id, title: c.title, category: c.category, level: c.level, students: c.students, assignments: c.assignments, pendingSubmissions: c.pending })) });
}));

router.post('/courses/:id/assignments', requireAuth, requireRole('instructor'), asyncHandler(async (req, res) => {
  const courseId = cleanId(req.params.id);
  if (!(await pool.query('SELECT 1 FROM courses WHERE id = $1', [courseId])).rowCount) return res.status(404).json({ message: 'Course not found.' });
  if (!(await ownsCourse(req.user.id, courseId))) return res.status(403).json({ message: 'You can only manage your own courses.' });
  const { errors, value } = validateAssignment(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ message: Object.values(errors)[0], errors });
  try {
    const ins = await pool.query(
      `INSERT INTO assignments (course_id, title, description, due_date, max_points) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [courseId, value.title, value.description, value.dueDate, value.maxPoints]);
    const students = await pool.query('SELECT user_id FROM enrollments WHERE course_id = $1', [courseId]);
    for (const s of students.rows) {
      await notify(pool, s.user_id, 'assignment', `New assignment: "${value.title}".`, `/assignments/${ins.rows[0].id}`, `assignment:${ins.rows[0].id}`);
    }
    res.status(201).json({ success: true, data: { id: String(ins.rows[0].id) } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'This course already has an assignment with that title.', errors: { title: 'Title already used in this course.' } });
    throw err;
  }
}));

router.get('/assignments/:id/submissions', requireAuth, requireRole('instructor'), asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ message: 'Assignment not found.' });
  const a = (await pool.query('SELECT a.id, a.title, a.max_points, c.instructor_id FROM assignments a JOIN courses c ON c.id = a.course_id WHERE a.id = $1', [id])).rows[0];
  if (!a) return res.status(404).json({ message: 'Assignment not found.' });
  if (String(a.instructor_id) !== String(req.user.id)) return res.status(403).json({ message: 'You can only manage your own courses.' });
  const r = await pool.query(
    `SELECT s.id, s.content, s.link, s.submitted_at, s.grade, s.feedback, s.graded_at, s.file_name, s.stored_name, s.is_late, u.full_name, u.email
     FROM submissions s JOIN users u ON u.id = s.user_id WHERE s.assignment_id = $1 ORDER BY s.grade IS NOT NULL, s.submitted_at`, [id]);
  res.json({
    assignment: { id: String(a.id), title: a.title, maxPoints: a.max_points },
    data: r.rows.map((s) => ({
      id: String(s.id), studentName: s.full_name, studentEmail: s.email, content: s.content, link: s.link,
      submittedAt: s.submitted_at, grade: s.grade, feedback: s.feedback, gradedAt: s.graded_at,
      fileName: s.file_name || '', hasFile: Boolean(s.stored_name), isLate: s.is_late
    }))
  });
}));

router.patch('/submissions/:id/grade', requireAuth, requireRole('instructor'), asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ message: 'Submission not found.' });
  const s = (await pool.query(
    `SELECT s.id, s.user_id, a.id AS assignment_id, a.title, a.max_points, c.instructor_id
     FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN courses c ON c.id = a.course_id WHERE s.id = $1`, [id])).rows[0];
  // Someone else's course looks the same as a missing submission, so ids cannot be probed.
  if (!s || String(s.instructor_id) !== String(req.user.id)) return res.status(404).json({ message: 'Submission not found.' });
  const { errors, value } = validateGrade(req.body, s.max_points);
  if (Object.keys(errors).length) return res.status(400).json({ message: Object.values(errors)[0], errors });
  await pool.query('UPDATE submissions SET grade = $1, feedback = $2, graded_at = NOW() WHERE id = $3', [value.grade, value.feedback, id]);
  await notify(pool, s.user_id, 'grade', `"${s.title}" was graded: ${value.grade}/${s.max_points}.`, `/assignments/${s.assignment_id}`, `grade:${id}:${value.grade}`);
  res.json({ success: true, data: { id: String(id), grade: value.grade, feedback: value.feedback } });
}));

export default router;
