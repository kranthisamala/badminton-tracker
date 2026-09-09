// One-off: renames the "viewer" role to "player" on every roles/{uid} doc.
// Purely a label change — role() still gates the same way in firestore.rules
// (which never mentioned "viewer" by name), and canEdit()/isOwner() are
// unaffected since neither checks for viewer/player.
//
// Writes a timestamped backup of the whole roles collection before touching
// anything.
//
//   node scripts/migrate-viewer-role-to-player.js          (dry run)
//   node scripts/migrate-viewer-role-to-player.js --apply  (writes)

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

  const snap = await db.collection('roles').get();
  const docs = snap.docs.map(d => ({ uid: d.id, ...d.data() }));

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(ROOT, `backup-roles-${stamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(docs, null, 2));
  console.log(`Backup written: ${backupPath}`);

  const toMigrate = docs.filter(d => d.role === 'viewer');
  const alreadyPlayer = docs.filter(d => d.role === 'player');
  const other = docs.filter(d => d.role !== 'viewer' && d.role !== 'player');

  console.log(`roles total: ${docs.length} | viewer -> player: ${toMigrate.length} | already player: ${alreadyPlayer.length} | other (editor/owner): ${other.length}`);
  toMigrate.forEach(d => console.log(`  ${d.username || d.uid}`));

  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to write.');
    return;
  }

  if (!toMigrate.length) {
    console.log('Nothing to migrate.');
    return;
  }

  const batch = db.batch();
  toMigrate.forEach(d => batch.update(db.collection('roles').doc(d.uid), { role: 'player' }));
  await batch.commit();
  console.log(`Updated ${toMigrate.length} role doc(s) to "player".`);
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error('FAILED:', err.message); process.exit(1); });
