import { Router } from 'express';
import { pool } from '../db/index.js';
import { optionalAuth, requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errors.js';
import { escapeLike } from '../utils/validate.js';
import { matchOpportunity } from '../utils/matching.js';

const router = Router();

const COURSE_COLUMNS = 'id, title, instructor, category, level, duration, description, syllabus, tags';
// "Closed" is decided by the database using the Ethiopian calendar day, so a deadline stays open for the whole day.
const OPPORTUNITY_COLUMNS = `id, title, company, location, type, duration, stipend,
  to_char(deadline, 'YYYY-MM-DD') AS deadline,
  COALESCE(deadline < (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date, false) AS is_closed,
  category, description, requirements, tags, work_mode,
  source_url, scope, eligible_universities, eligible_fields, eligible_years, skills,
  (SELECT g.name FROM organizations g WHERE g.user_id = opportunities.created_by) AS org_name,
  (SELECT g.is_verified FROM organizations g WHERE g.user_id = opportunities.created_by) AS org_verified,
  (SELECT g.website FROM organizations g WHERE g.user_id = opportunities.created_by) AS org_website`;

const toCourse = (r) => r;
export const toOpportunity = ({ is_closed, source_url, eligible_universities, eligible_fields, eligible_years, org_name, org_verified, org_website, work_mode, saved, application_status, ...rest }) => ({
  ...rest,
  isClosed: is_closed,
  sourceUrl: source_url,
  eligibleUniversities: eligible_universities,
  eligibleFields: eligible_fields,
  eligibleYears: eligible_years,
  workMode: work_mode || '',
  saved: Boolean(saved),
  applicationStatus: application_status || null,
  // The posting organisation's public details, when the listing was published by an organisation account.
  organization: org_name ? { name: org_name, isVerified: Boolean(org_verified), website: org_website || '' } : null
});
export { OPPORTUNITY_COLUMNS };

// Builds "WHERE ..." plus parameter list from ?search=&category=&level=. Everything is parameterised.
function buildWhere(query, { searchColumns, filters, extra = [] }) {
  const clauses = [...extra];
  const params = [];
  const search = String(query.search || '').trim().slice(0, 100);
  if (search) {
    params.push(`%${escapeLike(search)}%`);
    clauses.push(`(${searchColumns.map((c) => `${c} ILIKE $${params.length}`).join(' OR ')})`);
  }
  for (const [queryKey, column] of Object.entries(filters)) {
    const v = String(query[queryKey] || '').trim();
    if (v && v.toLowerCase() !== 'all') {
      params.push(v);
      clauses.push(`LOWER(${column}) = LOWER($${params.length})`);
    }
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

// Saved flag and this student's application status. Visitors get neither.
function viewerColumns(user, params) {
  if (user?.role !== 'student') return 'FALSE AS saved, NULL::text AS application_status';
  params.push(user.id);
  const n = params.length;
  return `EXISTS (SELECT 1 FROM saved_opportunities sv WHERE sv.opportunity_id = opportunities.id AND sv.user_id = $${n}) AS saved,
    (SELECT ap.status FROM applications ap WHERE ap.opportunity_id = opportunities.id AND ap.user_id = $${n} LIMIT 1) AS application_status`;
}

router.get('/courses', asyncHandler(async (req, res) => {
  const { where, params } = buildWhere(req.query, {
    searchColumns: ['title', 'instructor', 'description', 'category', "array_to_string(tags, ' ')"],
    filters: { category: 'category', level: 'level' }
  });
  const result = await pool.query(`SELECT ${COURSE_COLUMNS} FROM courses ${where} ORDER BY title LIMIT 200`, params);
  res.json({ data: result.rows.map(toCourse), total: result.rowCount });
}));

router.get('/courses/:id', asyncHandler(async (req, res) => {
  const result = await pool.query(`SELECT ${COURSE_COLUMNS} FROM courses WHERE id = $1`, [req.params.id.slice(0, 100)]);
  if (!result.rows[0]) return res.status(404).json({ message: 'Course not found.' });
  res.json({ data: toCourse(result.rows[0]) });
}));

router.get('/opportunities', optionalAuth, asyncHandler(async (req, res) => {
  // ?deadline=open hides closed listings; ?deadline=soon shows listings closing within 30 days (Ethiopian calendar day).
  const today = `(NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date`;
  const extra = [];
  if (req.query.deadline === 'open') extra.push(`(deadline IS NULL OR deadline >= ${today})`);
  if (req.query.deadline === 'soon') extra.push(`(deadline >= ${today} AND deadline <= ${today} + 30)`);
  const { where, params } = buildWhere(req.query, {
    searchColumns: ['title', 'company', 'description', 'category', 'location', "array_to_string(tags, ' ')", "array_to_string(skills, ' ')", "array_to_string(requirements, ' ')", "array_to_string(eligible_fields, ' ')"],
    filters: { category: 'category', type: 'type', scope: 'scope', location: 'location', workMode: 'work_mode' },
    extra
  });
  const countParams = [...params];
  const extras = viewerColumns(req.user, params);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 12));
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const offset = (page - 1) * pageSize;
  const requested = String(req.query.sort || '').toLowerCase();
  const sort = ['newest', 'deadline', 'relevance'].includes(requested) ? requested : 'deadline';

  if (sort === 'relevance' && req.user?.role === 'student') {
    const all = await pool.query(`SELECT ${OPPORTUNITY_COLUMNS}, ${extras} FROM opportunities ${where} LIMIT 500`, params);
    const student = { university: req.user.university, yearOfStudy: req.user.year_of_study, field: req.user.field, skills: req.user.skills || [] };
    const ranked = all.rows.map(toOpportunity).map((o) => {
      const match = matchOpportunity(student, o);
      return { ...o, _score: match.eligible ? match.score : -1, match: match.eligible && match.score > 0 ? { score: match.score, reasons: match.reasons, matchedSkills: match.matchedSkills } : o.match };
    }).sort((a, b) => b._score - a._score || String(a.deadline || '9999').localeCompare(String(b.deadline || '9999')));
    const data = ranked.slice(offset, offset + pageSize).map(({ _score, ...o }) => o);
    return res.json({ data, total: ranked.length, page, pageSize });
  }

  const order = sort === 'newest' ? 'created_at DESC, id' : 'is_closed, deadline NULLS LAST, title';
  const count = await pool.query(`SELECT COUNT(*)::int AS n FROM opportunities ${where}`, countParams);
  params.push(pageSize, offset);
  const limit = params.length - 1;
  const result = await pool.query(
    `SELECT ${OPPORTUNITY_COLUMNS}, ${extras} FROM opportunities ${where} ORDER BY ${order} LIMIT $${limit} OFFSET $${limit + 1}`,
    params
  );
  res.json({ data: result.rows.map(toOpportunity), total: count.rows[0].n, page, pageSize });
}));

router.get('/saved-opportunities', requireAuth, requireRole('student'), asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT ${OPPORTUNITY_COLUMNS}, TRUE AS saved,
       (SELECT ap.status FROM applications ap WHERE ap.opportunity_id = opportunities.id AND ap.user_id = $1 LIMIT 1) AS application_status
     FROM saved_opportunities sv JOIN opportunities ON opportunities.id = sv.opportunity_id
     WHERE sv.user_id = $1 ORDER BY sv.created_at DESC LIMIT 100`,
    [req.user.id]
  );
  res.json({ data: result.rows.map(toOpportunity), total: result.rowCount });
}));

router.post('/opportunities/:id/save', requireAuth, requireRole('student'), asyncHandler(async (req, res) => {
  const id = String(req.params.id).slice(0, 100);
  const found = await pool.query('SELECT 1 FROM opportunities WHERE id = $1', [id]);
  if (!found.rowCount) return res.status(404).json({ message: 'Opportunity not found.' });
  await pool.query(
    'INSERT INTO saved_opportunities (user_id, opportunity_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
    [req.user.id, id]
  );
  res.status(201).json({ success: true, saved: true });
}));

router.delete('/opportunities/:id/save', requireAuth, requireRole('student'), asyncHandler(async (req, res) => {
  const id = String(req.params.id).slice(0, 100);
  await pool.query('DELETE FROM saved_opportunities WHERE user_id = $1 AND opportunity_id = $2', [req.user.id, id]);
  res.json({ success: true, saved: false });
}));

router.get('/opportunities/:id', optionalAuth, asyncHandler(async (req, res) => {
  const params = [req.params.id.slice(0, 100)];
  const extras = viewerColumns(req.user, params);
  const result = await pool.query(`SELECT ${OPPORTUNITY_COLUMNS}, ${extras} FROM opportunities WHERE id = $1`, params);
  if (!result.rows[0]) return res.status(404).json({ message: 'Opportunity not found.' });
  res.json({ data: toOpportunity(result.rows[0]) });
}));

// Filter options come from the real rows, so the filter chips can never drift out of sync with the data.
router.get('/meta/filters', asyncHandler(async (_req, res) => {
  const distinct = async (table, column) =>
    (await pool.query(`SELECT DISTINCT ${column} AS v FROM ${table} WHERE ${column} <> '' ORDER BY v`)).rows.map((r) => r.v);
  const [courseCategories, courseLevels, opportunityCategories, opportunityTypes, opportunityLocations] = await Promise.all([
    distinct('courses', 'category'),
    distinct('courses', 'level'),
    distinct('opportunities', 'category'),
    distinct('opportunities', 'type'),
    distinct('opportunities', 'location')
  ]);
  res.json({
    courseCategories, courseLevels, opportunityCategories, opportunityTypes, opportunityLocations,
    opportunityScopes: ['Ethiopia', 'International'],
    workModes: ['Remote', 'Hybrid', 'On-site']
  });
}));

// Only real counts from the database; the homepage shows nothing it cannot back up.
router.get('/stats', asyncHandler(async (_req, res) => {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM courses)::int AS courses,
      (SELECT COUNT(*) FROM opportunities)::int AS opportunities,
      (SELECT COUNT(*) FROM opportunities
         WHERE deadline IS NULL OR deadline >= (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date)::int AS open_opportunities`);
  const r = result.rows[0];
  res.json({ data: { courses: r.courses, opportunities: r.opportunities, openOpportunities: r.open_opportunities } });
}));

export default router;
