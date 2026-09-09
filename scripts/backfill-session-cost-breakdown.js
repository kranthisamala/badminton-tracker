// One-off: backfills the session cost breakdown introduced with the new
// session form. Existing sessions predate court-fee/shuttle tracking, so their
// whole cost is treated as the court fee (shuttles unknown -> 0).
//
// cost is left EXACTLY as it was — courtFee + shuttleCount * shuttlePrice
// reproduces it, so no balance, share or settlement changes.
//
// Writes a timestamped backup of trackerData/main next to this script before
// touching anything, and refuses to write if any session's cost would change.
//
//   node scripts/backfill-session-cost-breakdown.js          (dry run)
//   node scripts/backfill-session-cost-breakdown.js --apply  (writes)

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const ROOT = path.join(__dirname, '..');
const SERVICE_ACCOUNT_PATH = process.env.SERVICE_ACCOUNT_KEY_PATH || path.join(ROOT, 'serviceAccountKey.json');
const APPLY = process.argv.includes('--apply');

async function main() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    throw new Error(`Service account key not found at ${SERVICE_ACCOUNT_PATH}.`);
  }

  admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)) });
  const db = admin.firestore();

  const snap = await db.collection('trackerData').doc('main').get();
  if (!snap.exists) throw new Error('trackerData/main does not exist.');
  const data = snap.data();

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(ROOT, `backup-trackerData-${stamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
  console.log(`Backup written: ${backupPath}`);

  let changed = 0;
  let skipped = 0;

  data.sessions.forEach(session => {
    if (session.courtFee !== undefined) { skipped++; return; }
    session.courtFee = session.cost;
    session.shuttleCount = 0;
    session.shuttlePrice = 0;
    changed++;
  });

  const mismatches = data.sessions.filter(s => {
    const derived = (s.courtFee || 0) + (s.shuttleCount || 0) * (s.shuttlePrice || 0);
    return Math.abs(derived - s.cost) > 0.001;
  });

  console.log(`sessions: ${data.sessions.length} | backfilled: ${changed} | already had breakdown: ${skipped}`);

  if (mismatches.length) {
    console.error('ABORT — these sessions would have a derived cost different from their stored cost:');
    mismatches.forEach(s => console.error(`  #${s.id} ${s.date}: stored ${s.cost}, derived ${(s.courtFee || 0) + (s.shuttleCount || 0) * (s.shuttlePrice || 0)}`));
    process.exit(1);
  }
  console.log('Validation OK — every session\'s derived cost equals its stored cost.');

  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to write.');
    return;
  }

  await db.collection('trackerData').doc('main').set(data);
  console.log('Wrote trackerData/main.');
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error('FAILED:', err.message); process.exit(1); });
