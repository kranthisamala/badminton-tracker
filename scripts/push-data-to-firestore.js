// One-off: pushes the current badminton_data.json into the Firestore
// document the app reads/writes (trackerData/main), and records a
// "Historical data import" audit log entry attributed to the owner (by
// default the member whose username is "kranthi" — override with the
// OWNER_USERNAME env var) so all pre-existing data has a named author in
// the Activity Log.
//
// Uses the Admin SDK (bypasses Firestore rules) — same service account key
// as scripts/provision-member-accounts.js. Run that script FIRST so the
// owner account (and its uid, looked up here by username) exists.
//
// WARNING: this OVERWRITES trackerData/main. Intended to run once at
// initial setup, or deliberately to reset Firestore from this file — not
// as a routine command once the app has live data in Firestore.
//
//   node scripts/push-data-to-firestore.js
//   OWNER_USERNAME=someoneelse node scripts/push-data-to-firestore.js

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'badminton_data.json');
const SERVICE_ACCOUNT_PATH = process.env.SERVICE_ACCOUNT_KEY_PATH || path.join(ROOT, 'serviceAccountKey.json');
const OWNER_USERNAME = process.env.OWNER_USERNAME || 'kranthi';

async function main() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    throw new Error(
      `Service account key not found at ${SERVICE_ACCOUNT_PATH}. Download one from ` +
      'Firebase Console -> Project Settings -> Service Accounts -> Generate new private key.'
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH))
  });

  const db = admin.firestore();
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  const usernameDoc = await db.collection('usernames').doc(OWNER_USERNAME).get();
  if (!usernameDoc.exists || !usernameDoc.data().uid) {
    throw new Error(
      `No provisioned account found for username "${OWNER_USERNAME}". ` +
      'Run scripts/provision-member-accounts.js first.'
    );
  }
  const ownerUid = usernameDoc.data().uid;

  await db.collection('trackerData').doc('main').set(data);
  console.log('Pushed badminton_data.json to Firestore doc trackerData/main.');
  console.log(`  members: ${data.members.length}, sessions: ${data.sessions.length}, dues: ${(data.duesPayments || []).length}`);

  await db.collection('auditLog').add({
    uid: ownerUid,
    username: OWNER_USERNAME,
    action: 'Historical data import',
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log(`Recorded "Historical data import" audit log entry (attributed to @${OWNER_USERNAME}).`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('FAILED:', err.message);
    process.exit(1);
  });
