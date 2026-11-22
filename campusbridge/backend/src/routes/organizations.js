import { Router } from 'express';
import { pool } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errors.js';
import { validateOrganization } from '../utils/validate.js';

// An organisation account manages its own public profile. The id always comes from the verified token.
const router = Router();
const guard = [requireAuth, requireRole('organization')];

const toJson = (r) => ({
  id: String(r.id), name: r.name, orgType: r.org_type, website: r.website, location: r.location,
  description: r.description, contactEmail: r.contact_email, isVerified: r.is_verified
});

router.get('/organization/profile', ...guard, asyncHandler(async (req, res) => {
  const r = await pool.query('SELECT * FROM organizations WHERE user_id = $1', [req.user.id]);
  res.json({ data: r.rows[0] ? toJson(r.rows[0]) : null });
}));

router.put('/organization/profile', ...guard, asyncHandler(async (req, res) => {
  const { errors, value } = validateOrganization(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ message: Object.values(errors)[0], errors });
  const before = (await pool.query('SELECT name FROM organizations WHERE user_id = $1', [req.user.id])).rows[0];
  // is_verified is NOT writable here: only an administrator (database) can mark an organisation as verified.
  const r = await pool.query(
    `INSERT INTO organizations (user_id, name, org_type, website, location, description, contact_email)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name, org_type = EXCLUDED.org_type, website = EXCLUDED.website,
       location = EXCLUDED.location, description = EXCLUDED.description, contact_email = EXCLUDED.contact_email, updated_at = NOW()
     RETURNING *`,
    [req.user.id, value.name, value.orgType, value.website, value.location, value.description, value.contactEmail]);
  // Renaming the organisation renames it on the listings it published.
  if (before && before.name !== value.name) {
    await pool.query('UPDATE opportunities SET company = $2 WHERE created_by = $1', [req.user.id, value.name]);
    await pool.query('UPDATE applications SET company = $2 WHERE opportunity_id IN (SELECT id FROM opportunities WHERE created_by = $1)', [req.user.id, value.name]);
  }
  res.json({ success: true, data: toJson(r.rows[0]) });
}));

export default router;
