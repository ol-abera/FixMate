import { Router } from 'express';
import { pool } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errors.js';
import { missingProfile, recommend } from '../utils/matching.js';
import { OPPORTUNITY_COLUMNS, toOpportunity } from './catalog.js';

// Personalised opportunity suggestions for a student, with the reasons for each one.
const router = Router();

router.get('/recommendations', requireAuth, requireRole('student'), asyncHandler(async (req, res) => {
  const limit = Math.min(12, Math.max(1, parseInt(req.query.limit, 10) || 6));
  const today = `(NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date`;
  // Only listings that are still open and that the student has not already applied to.
  const result = await pool.query(
    `SELECT ${OPPORTUNITY_COLUMNS} FROM opportunities
     WHERE (deadline IS NULL OR deadline >= ${today})
       AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.opportunity_id = opportunities.id AND a.user_id = $1)`,
    [req.user.id]);
  const student = { university: req.user.university, yearOfStudy: req.user.year_of_study, field: req.user.field, skills: req.user.skills || [] };
  const data = recommend(student, result.rows.map(toOpportunity), { limit });
  res.json({ data, missingProfile: missingProfile(student) });
}));

export default router;
