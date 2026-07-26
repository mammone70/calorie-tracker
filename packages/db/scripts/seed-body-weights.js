#!/usr/bin/env node
/**
 * Seed historical body-weight logs (lbs).
 *
 * Usage:
 *   node scripts/seed-body-weights.js <email>
 */
const { randomUUID } = require('crypto');
const { createSql } = require('./lib/db-env');

/** Raw rows from the user spreadsheet. Empty weights are skipped. */
const RAW_ROWS = `
5/16/26	252.6
5/26/26	252
5/27/26	252.2
5/28/26	253.4
5/29/26	252.4
5/30/26	250.4
5/31/26	250.4
6/1/26	252.4
6/2/26	251.8
6/4/26	252
6/5/26	252.4
6/6/26	254.6
6/7/26	251.6
6/8/26	253.6
6/9/26	252.8
6/10/26	253.6
6/11/26	253.6
6/12/26	251.6
6/13/26	250.6
6/14/26	248.4
6/15/26	249.6
6/16/26	250
6/17/26	250
6/18/26	248.8
6/19/26	248
6/20/26	
6/21/26	
6/22/26	
6/23/26	249.2
6/24/26	248.2
6/25/26	248.4
6/26/26	248.4
6/27/26	249.4
6/28/26	248.2
6/29/26	247.6
6/30/26	247
7/1/26	247.2
7/2/25	248
7/3/26	247.2
7/4/26	
7/5/26	
7/6/26	248
7/7/26	247
7/8/26	247.4
7/9/26	247.8
7/10/26	247
7/11/26	245.8
7/12/26	245
7/13/26	243.8
7/14/26	250.2
7/15/26	248
7/16/26	247.4
7/17/26	246
7/18/26	245.2
7/19/26	245
7/20/26	245.2
7/21/26	248.8
7/22/26	247.6
7/23/26	247.8
7/24/26	247.8
7/25/26	247.6
`;

function parseSlashDate(raw) {
  const [month, day, yearShort] = raw.trim().split('/').map(Number);
  // Spreadsheet uses 2-digit years; 7/2/25 is treated as 2026 (typo in source).
  let year = yearShort < 100 ? 2000 + yearShort : yearShort;
  if (month === 7 && day === 2 && year === 2025) year = 2026;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function parseRows(raw) {
  const entries = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [datePart, weightPart] = trimmed.split(/\t+/);
    if (!datePart) continue;
    const weightText = (weightPart ?? '').trim();
    if (!weightText) continue;
    const weight = Number(weightText);
    if (!Number.isFinite(weight) || weight <= 0) continue;
    entries.push({ loggedOn: parseSlashDate(datePart), weight });
  }
  return entries;
}

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email) {
    console.error('Usage: node scripts/seed-body-weights.js <email>');
    process.exit(1);
  }

  const entries = parseRows(RAW_ROWS);
  const sql = createSql();
  try {
    const users = await sql`
      SELECT id, email FROM users WHERE email = ${email} LIMIT 1
    `;
    if (users.length === 0) throw new Error(`User not found: ${email}`);
    const userId = users[0].id;
    console.error(`Seeding ${entries.length} body-weight logs for ${users[0].email}`);

    const now = new Date().toISOString();
    let inserted = 0;
    let updated = 0;

    for (const entry of entries) {
      const existing = await sql`
        SELECT id FROM body_weight_logs
        WHERE user_id = ${userId}
          AND logged_on = ${entry.loggedOn}
          AND deleted_at IS NULL
        LIMIT 1
      `;

      if (existing.length > 0) {
        await sql`
          UPDATE body_weight_logs
          SET weight = ${String(entry.weight)},
              unit = ${'lbs'},
              updated_at = ${now},
              deleted_at = NULL
          WHERE id = ${existing[0].id}
        `;
        updated += 1;
      } else {
        await sql`
          INSERT INTO body_weight_logs (
            id, user_id, logged_on, weight, unit, notes, created_at, updated_at, deleted_at
          ) VALUES (
            ${randomUUID()}, ${userId}, ${entry.loggedOn}, ${String(entry.weight)},
            ${'lbs'}, ${null}, ${now}, ${now}, ${null}
          )
        `;
        inserted += 1;
      }
    }

    console.error(`Done. Inserted ${inserted}, updated ${updated}.`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
