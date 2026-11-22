import { Router } from 'express';
import { pool } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errors.js';
import { validateOpportunity } from '../utils/validate.js';
import crypto from 'node:crypto';

// Internship coordinators and organisations: publish opportunities, edit their own, and review who applied.
// Both roles share these routes. An organisation's listings always carry its profile name as the organisation.
const router = Router();
// Per-route guard (not router.use) because this router is mounted on /api: unknown URLs must still be 404.
const guard = [requireAuth, requireRole('coordinator', 'organization')];

const addisToday = async () => (await pool.query(`SELECT to_char((NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date, 'YYYY-MM-DD') AS d`)).rows[0].d;

// Organisation accounts publish under their profile name; coordinators type the organisation themselves.
async function organisationName(user) {
  if (user.role !== 'organization') return null;
  const r = await pool.query('SELECT name FROM organizations WHERE user_id = $1', [user.id]);
  return r.rows[0]?.name || '';
}

const COLUMNS = `title, company, location, type, duration, stipend, deadline, category, description, requirements, tags,
  source_url, scope, eligible_universities, eligible_fields, eligible_years, skills, work_mode`;

router.post('/opportunities', ...guard, asyncHandler(async (req, res) => {
  const orgName = await organisationName(req.user);
  if (orgName === '') return res.status(400).json({ message: 'Complete your organisation profile before publishing.' });
  const { errors, value } = validateOpportunity({ ...req.body, ...(orgName ? { company: orgName } : {}) }, await addisToday());
  if (Object.keys(errors).length) return res.status(400).json({ message: Object.values(errors)[0], errors });
  const id = `p${crypto.randomBytes(6).toString('hex')}`;
  await pool.query(
    `INSERT INTO opportunities (id, ${COLUMNS}, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
    [id, value.title, value.company, value.location, value.type, value.duration, value.stipend, value.deadline, value.category, value.description,
     value.requirements, value.tags, value.sourceUrl, value.scope, value.eligibleUniversities, value.eligibleFields, value.eligibleYears, value.skills, value.workMode, req.user.id]);
  res.status(201).json({ success: true, data: { id } });
}));

// Edit a listing you published. Someone else's listing is refused, and applications keep pointing at it.
router.patch('/opportunities/:id', ...guard, asyncHandler(async (req, res) => {
  const id = String(req.params.id).slice(0, 100);
  const found = (await pool.query(`SELECT id, created_by, to_char(deadline,'YYYY-MM-DD') AS deadline FROM opportunities WHERE id = $1`, [id])).rows[0];
  if (!found) return res.status(404).json({ message: 'Opportunity not found.' });
  if (String(found.created_by) !== String(req.user.id)) return res.status(403).json({ message: 'You can only edit opportunities you posted.' });
  const orgName = await organisationName(req.user);
  if (orgName === '') return res.status(400).json({ message: 'Complete your organisation profile before publishing.' });
  const { errors, value } = validateOpportunity({ ...req.body, ...(orgName ? { company: orgName } : {}) }, await addisToday());
  // Keeping an old deadline unchanged is fine (for example to fix a typo in a closed listing); only a NEW date must be in the future.
  if (errors.deadline && value.deadline === found.deadline) delete errors.deadline;
  if (Object.keys(errors).length) return res.status(400).json({ message: Object.values(errors)[0], errors });
  await pool.query(
    `UPDATE opportunities SET title=$2, company=$3, location=$4, type=$5, duration=$6, stipend=$7, deadline=$8, category=$9, description=$10,
       requirements=$11, tags=$12, source_url=$13, scope=$14, eligible_universities=$15, eligible_fields=$16, eligible_years=$17, skills=$18,
       work_mode=$19, updated_at=NOW()
     WHERE id = $1`,
    [id, value.title, value.company, value.location, value.type, value.duration, value.stipend, value.deadline, value.category, value.description,
     value.requirements, value.tags, value.sourceUrl, value.scope, value.eligibleUniversities, value.eligibleFields, value.eligibleYears, value.skills, value.workMode]);
  // Applications keep a copy of the title and organisation; keep that copy in step with the listing.
  await pool.query('UPDATE applications SET position_title = $2, company = $3 WHERE opportunity_id = $1', [id, value.title, value.company]);
  res.json({ success: true, data: { id } });
}));

router.get('/coordinator/opportunities', ...guard, asyncHandler(async (req, res) => {
  const r = await pool.query(
    `SELECT o.id, o.title, o.company, o.type, to_char(o.deadline,'YYYY-MM-DD') AS deadline,
       COALESCE(o.deadline < (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date, false) AS is_closed,
       (SELECT COUNT(*) FROM applications a WHERE a.opportunity_id = o.id)::int AS applicants,
       (SELECT COUNT(*) FROM applications a WHERE a.opportunity_id = o.id AND a.status = 'Submitted')::int AS awaiting_review
     FROM opportunities o WHERE o.created_by = $1 ORDER BY is_closed, o.deadline NULLS LAST, o.title`, [req.user.id]);
  res.json({ data: r.rows.map((o) => ({ id: o.id, title: o.title, company: o.company, type: o.type, deadline: o.deadline, isClosed: o.is_closed, applicants: o.applicants, awaitingReview: o.awaiting_review })) });
}));

router.get('/opportunities/:id/applications', ...guard, asyncHandler(async (req, res) => {
  const id = String(req.params.id).slice(0, 100);
  const opp = (await pool.query('SELECT id, title, company, created_by FROM opportunities WHERE id = $1', [id])).rows[0];
  if (!opp) return res.status(404).json({ message: 'Opportunity not found.' });
  if (String(opp.created_by) !== String(req.user.id)) return res.status(403).json({ message: 'You can only review applications for opportunities you posted.' });
  const r = await pool.query(
    `SELECT a.id, a.full_name, a.email, a.phone, a.university, a.year_of_study, a.cover_letter, a.portfolio_url, a.status, a.submitted_at,
            u.field, u.skills
     FROM applications a JOIN users u ON u.id = a.user_id
     WHERE a.opportunity_id = $1 ORDER BY (a.status = 'Submitted') DESC, a.submitted_at`, [id]);
  res.json({
    opportunity: { id: opp.id, title: opp.title, company: opp.company },
    data: r.rows.map((a) => ({ id: String(a.id), fullName: a.full_name, email: a.email, phone: a.phone, university: a.university, yearOfStudy: a.year_of_study, field: a.field || '', skills: a.skills || [], coverLetter: a.cover_letter, portfolioUrl: a.portfolio_url, status: a.status, submittedAt: a.submitted_at }))
  });
}));

export default router;
