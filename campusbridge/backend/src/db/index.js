import fs from 'node:fs/promises';
import pg from 'pg';
import { config } from '../config.js';
import bcrypt from 'bcryptjs';
import { courses, opportunities } from '../data/seed.js';
import { assignments, demoAccounts, DEMO_PASSWORD } from '../data/learning.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
pool.on('error', (err) => console.error('Unexpected database error:', err.message));

// Older versions of CampusBridge stored courses/opportunities as one JSON blob
// per row (a column named "data"). We never delete that data: the old table is
// only RENAMED to <name>_legacy_backup and a proper table is created instead.
async function renameLegacyTables(client) {
  for (const table of ['courses', 'opportunities']) {
    const legacy = await client.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = $1 AND column_name = 'data'`,
      [table]
    );
    if (legacy.rowCount === 0) continue;
    const backup = `${table}_legacy_backup`;
    const exists = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = $1`,
      [backup]
    );
    const target = exists.rowCount ? `${backup}_${Date.now()}` : backup;
    await client.query(`ALTER TABLE ${table} RENAME TO ${target}`); // identifiers are fixed strings, not user input
    console.log(`Migration: old "${table}" table kept as "${target}".`);
  }
}

function workModeOf(opportunity) {
  if (opportunity.workMode) return opportunity.workMode;
  const loc = String(opportunity.location || '').toLowerCase();
  if (loc.includes('hybrid')) return 'Hybrid';
  if (loc.includes('remote')) return 'Remote';
  if (loc.includes('on-site') || loc.includes('onsite') || loc.includes('on site')) return 'On-site';
  return '';
}

async function seedCatalog(client) {
  for (const c of courses) {
    await client.query(
      `INSERT INTO courses (id, title, instructor, category, level, duration, description, syllabus, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title, instructor = EXCLUDED.instructor, category = EXCLUDED.category,
         level = EXCLUDED.level, duration = EXCLUDED.duration, description = EXCLUDED.description,
         syllabus = EXCLUDED.syllabus, tags = EXCLUDED.tags`,
      [c.id, c.title, c.instructor, c.category, c.level, c.duration, c.description, c.syllabus, c.tags]
    );
  }
  for (const o of opportunities) {
    await client.query(
      `INSERT INTO opportunities (id, title, company, location, type, duration, stipend, deadline, category, description, requirements, tags,
                                  source_url, scope, eligible_universities, eligible_fields, eligible_years, skills, work_mode)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title, company = EXCLUDED.company, location = EXCLUDED.location, type = EXCLUDED.type,
         duration = EXCLUDED.duration, stipend = EXCLUDED.stipend,
         -- keep an open deadline as it is; only renew sample deadlines that have already passed
         deadline = CASE WHEN opportunities.deadline IS NULL
                           OR opportunities.deadline < (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date
                         THEN EXCLUDED.deadline ELSE opportunities.deadline END,
         category = EXCLUDED.category, description = EXCLUDED.description,
         requirements = EXCLUDED.requirements, tags = EXCLUDED.tags,
         source_url = EXCLUDED.source_url, scope = EXCLUDED.scope, eligible_universities = EXCLUDED.eligible_universities,
         eligible_fields = EXCLUDED.eligible_fields, eligible_years = EXCLUDED.eligible_years, skills = EXCLUDED.skills,
         work_mode = CASE WHEN opportunities.work_mode = '' THEN EXCLUDED.work_mode ELSE opportunities.work_mode END`,
      [o.id, o.title, o.company, o.location, o.type, o.duration, o.stipend, o.deadline ?? null, o.category, o.description, o.requirements, o.tags,
       o.sourceUrl || '', o.scope || 'Ethiopia', o.eligibleUniversities || [], o.eligibleFields || [], o.eligibleYears || [], o.skills || [], workModeOf(o)]
    );
  }
}

// Constraints are added one by one. If an old database already contains rows that
// break a rule (for example duplicate applications) we warn instead of crashing.
const CONSTRAINTS = [
  {
    name: 'applications_opportunity_fk',
    sql: `ALTER TABLE applications ADD CONSTRAINT applications_opportunity_fk
          FOREIGN KEY (opportunity_id) REFERENCES opportunities(id)`
  },
  {
    name: 'applications_user_opportunity_uniq',
    sql: `ALTER TABLE applications ADD CONSTRAINT applications_user_opportunity_uniq
          UNIQUE (user_id, opportunity_id)`
  },
  {
    name: 'users_role_check',
    sql: `ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student','instructor','coordinator','organization'))`
  },
  {
    name: 'applications_status_check',
    sql: `ALTER TABLE applications ADD CONSTRAINT applications_status_check
          CHECK (status IN ('Submitted','Under Review','Shortlisted','Accepted','Rejected','Withdrawn'))`
  },
  {
    name: 'opportunities_work_mode_check',
    sql: `ALTER TABLE opportunities ADD CONSTRAINT opportunities_work_mode_check
          CHECK (work_mode IN ('', 'Remote', 'Hybrid', 'On-site'))`
  }
];

// Databases created before the organisation role have a role rule that only lists three roles. Replace that one
// rule with the wider one. No rows are touched: every existing role value is still allowed. This runs BEFORE the
// seed (inside the same transaction) so the demo organisation account can be created on an upgraded database.
async function widenStatusConstraint(client) {
  const found = await client.query(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'applications_status_check'`);
  if (!found.rowCount || found.rows[0].def.includes('Shortlisted')) return;
  await client.query('ALTER TABLE applications DROP CONSTRAINT applications_status_check');
  await client.query(`ALTER TABLE applications ADD CONSTRAINT applications_status_check
    CHECK (status IN ('Submitted','Under Review','Shortlisted','Accepted','Rejected','Withdrawn'))`);
}

async function backfillAdditions(client) {
  await client.query(`
    UPDATE opportunities SET work_mode = CASE
      WHEN location ILIKE '%hybrid%' THEN 'Hybrid'
      WHEN location ILIKE '%remote%' THEN 'Remote'
      WHEN location ILIKE '%on-site%' OR location ILIKE '%onsite%' OR location ILIKE '%on site%' THEN 'On-site'
      ELSE work_mode
    END
    WHERE work_mode = ''`);
  await client.query(`
    INSERT INTO application_events (application_id, status, created_at)
    SELECT a.id, 'Submitted', a.submitted_at FROM applications a
    WHERE NOT EXISTS (SELECT 1 FROM application_events e WHERE e.application_id = a.id)`);
  await client.query(`
    INSERT INTO application_events (application_id, status, created_at)
    SELECT a.id, a.status, a.updated_at FROM applications a
    WHERE a.status <> 'Submitted'
      AND NOT EXISTS (SELECT 1 FROM application_events e WHERE e.application_id = a.id AND e.status = a.status)`);
}

async function widenRoleConstraint(client) {
  const found = await client.query(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'users_role_check'`);
  if (!found.rowCount || found.rows[0].def.includes('organization')) return;
  await client.query('ALTER TABLE users DROP CONSTRAINT users_role_check');
  await client.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student','instructor','coordinator','organization'))`);
}

async function ensureConstraints() {
  for (const c of CONSTRAINTS) {
    const found = await pool.query('SELECT 1 FROM pg_constraint WHERE conname = $1', [c.name]);
    if (found.rowCount) continue;
    try {
      await pool.query(c.sql);
    } catch (err) {
      console.warn(`WARNING: could not add database rule "${c.name}": ${err.message}`);
    }
  }
}

// Demo accounts (one student, one instructor, one coordinator) so the whole platform can be demonstrated.
// Only created when SEED_DEMO_ACCOUNTS=true, and never in production (the passwords are public).
async function seedLearning(client) {
  let instructorId = null;
  let coordinatorId = null;
  let studentId = null;
  if (config.seedDemoAccounts) {
    const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const ids = {};
    for (const a of demoAccounts) {
      const r = await client.query(
        `INSERT INTO users (full_name, email, password_hash, university, year_of_study, field, role)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role RETURNING id`,
        [a.fullName, a.email, hash, a.university, a.yearOfStudy, a.field, a.role]
      );
      ids[a.role] = r.rows[0].id;
    }
    ({ instructor: instructorId, coordinator: coordinatorId, student: studentId } = ids);
    // The demo organisation gets a profile and owns the sample listings marked owner: 'organization'.
    if (ids.organization) {
      await client.query(
        `INSERT INTO organizations (user_id, name, org_type, website, location, description, contact_email)
         VALUES ($1,'Addis Tech Collective (sample)','Non-profit','','Addis Ababa','A sample organisation account used to demonstrate publishing opportunities and reviewing applicants.','org@demo.campusbridge.local')
         ON CONFLICT (user_id) DO NOTHING`, [ids.organization]);
      const orgOpps = opportunities.filter((o) => o.owner === 'organization').map((o) => o.id);
      if (orgOpps.length) await client.query('UPDATE opportunities SET created_by = $1 WHERE id = ANY($2)', [ids.organization, orgOpps]);
    }
    // The sample catalogue is managed by the demo staff, so they have something to manage.
    await client.query('UPDATE courses SET instructor_id = $1 WHERE instructor_id IS NULL', [instructorId]);
    await client.query('UPDATE opportunities SET created_by = $1 WHERE created_by IS NULL', [coordinatorId]);
  }
  for (const a of assignments) {
    await client.query(
      `INSERT INTO assignments (course_id, title, description, due_date, max_points)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (course_id, title) DO UPDATE SET
         description = EXCLUDED.description, max_points = EXCLUDED.max_points,
         due_date = CASE WHEN assignments.due_date IS NULL
                           OR assignments.due_date < (NOW() AT TIME ZONE 'Africa/Addis_Ababa')::date
                         THEN EXCLUDED.due_date ELSE assignments.due_date END`,
      [a.courseId, a.title, a.description, a.dueDate, a.maxPoints]
    );
  }
  if (studentId) {
    await client.query(`UPDATE users SET skills = $1 WHERE id = $2 AND cardinality(skills) = 0`, [['JavaScript', 'Python', 'HTML', 'CSS'], studentId]);
    // Give the demo student a little history so dashboards are not empty at the start of a demo.
    await client.query(`INSERT INTO enrollments (user_id, course_id) VALUES ($1,'c1') ON CONFLICT DO NOTHING`, [studentId]);
    const first = await client.query(`SELECT id, max_points FROM assignments WHERE course_id='c1' ORDER BY id LIMIT 1`);
    if (first.rows[0]) {
      await client.query(
        `INSERT INTO submissions (assignment_id, user_id, content, grade, feedback, graded_at)
         VALUES ($1,$2,'My first responsive page: a personal profile card using Flexbox.',$3,'Clean semantic HTML. Next time, add a media query for small screens.', NOW())
         ON CONFLICT DO NOTHING`,
        [first.rows[0].id, studentId, Math.round(first.rows[0].max_points * 0.9)]
      );
    }
  }
}

export async function initializeDatabase() {
  const schemaSql = await fs.readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await renameLegacyTables(client);
    await client.query(schemaSql);
    await widenRoleConstraint(client);
    await widenStatusConstraint(client);
    await backfillAdditions(client);
    await seedCatalog(client);
    await seedLearning(client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  await ensureConstraints();
}
