// Creates three PERMANENT test logins — one per role — so UI work can be
// verified without repeatedly creating and deleting throwaway accounts.
//
//   _testowner   owner
//   _testeditor  editor
//   _testplayer  player
//
// They are marked `isTestAccount: true` and carry NO memberId, so they never
// appear as a row in the member roster (Summary / Dues / Attendance, all of
// which are built from trackerData.members). The only place they surface is
// the owner-only "Accounts without a member" section of the Members tab —
// firestore.rules restricts listing the roles collection to the owner, so no
// other signed-in user can read them back either.
//
// NOTE: _testowner has real owner rights over real data. Use a strong password
// and don't share it. The password is never written to this repo — pass it in,
// or let the script generate one and print it once.
//
//   TEST_ACCOUNT_PASSWORD=... node scripts/provision-test-accounts.js
//   node scripts/provision-test-accounts.js            (generates + prints one)
//   node scripts/provision-test-accounts.js --delete   (removes all three)

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const ROOT = path.join(__dirname, '..');
const SERVICE_ACCOUNT_PATH = process.env.SERVICE_ACCOUNT_KEY_PATH || path.join(ROOT, 'serviceAccountKey.json');
const SYNTHETIC_EMAIL_DOMAIN = 'members.badminton-tracker.local';
const DELETE = process.argv.includes('--delete');

const ACCOUNTS = [
  { username: '_testowner', role: 'owner' },
  { username: '_testeditor', role: 'editor' },
  { username: '_testplayer', role: 'player' }
];

function generatePassword() {
  return crypto.randomBytes(15).toString('base64url');
}

async function removeAccount(db, username) {
  const email = `${username}@${SYNTHETIC_EMAIL_DOMAIN}`;
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().deleteUser(user.uid);
    await db.doc(`roles/${user.uid}`).delete();
    console.log(`  removed ${username} (${user.uid})`);
  } catch (e) {
    console.log(`  ${username}: no auth user (${e.code || e.message})`);
  }
  await db.doc(`usernames/${username}`).delete();
}

async function main() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    throw new Error(`Service account key not found at ${SERVICE_ACCOUNT_PATH}.`);
  }
  admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)) });
  const db = admin.firestore();

  if (DELETE) {
    console.log('Removing test accounts:');
    for (const { username } of ACCOUNTS) await removeAccount(db, username);
    console.log('Done.');
    return;
  }

  const password = process.env.TEST_ACCOUNT_PASSWORD || generatePassword();
  const generated = !process.env.TEST_ACCOUNT_PASSWORD;

  for (const { username, role } of ACCOUNTS) {
    const email = `${username}@${SYNTHETIC_EMAIL_DOMAIN}`;
    let uid;
    try {
      const existing = await admin.auth().getUserByEmail(email);
      uid = existing.uid;
      await admin.auth().updateUser(uid, { password });
    } catch (e) {
      uid = (await admin.auth().createUser({ email, password })).uid;
    }

    await db.doc(`roles/${uid}`).set({
      username,
      role,
      mustChangePassword: false,
      isTestAccount: true
    });
    await db.doc(`usernames/${username}`).set({ uid });
    console.log(`  ${username.padEnd(12)} ${role.padEnd(7)} ${uid}`);
  }

  console.log('\nThree test accounts ready.');
  if (generated) {
    console.log(`Shared password (shown once, not stored anywhere): ${password}`);
  } else {
    console.log('Shared password: taken from TEST_ACCOUNT_PASSWORD.');
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error('FAILED:', err.message); process.exit(1); });
