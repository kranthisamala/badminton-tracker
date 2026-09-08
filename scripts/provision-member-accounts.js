// Provisions a Firebase Auth account + roles/{uid} + usernames/{username}
// doc for every member that doesn't already have one. Idempotent — safe to
// re-run any time (e.g. after adding new members via the Members tab) to
// provision just the new ones; existing accounts, passwords, and roles are
// left untouched.
//
// Reads the member roster from Firestore's trackerData/main if it already
// exists (the live, current roster — includes members added via the app
// after go-live), falling back to the local badminton_data.json only for
// the very first run, before that document has been seeded.
//
// Default password for a newly provisioned account is the member's own
// username (members[].username is guaranteed >= 6 chars — see
// scripts/add-member-usernames.js — to satisfy Firebase's password length
// minimum). The app forces a password change on first sign-in
// (roles/{uid}.mustChangePassword).
//
// Uses the Admin SDK, which bypasses Firestore security rules entirely —
// that's required here, since nobody is signed in yet the very first time
// this runs. Needs a service account key (NEVER commit this file):
//
//   Firebase Console -> Project Settings -> Service Accounts
//     -> Generate new private key -> save as serviceAccountKey.json
//     in the repo root (already gitignored)
//
//   node scripts/provision-member-accounts.js

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'badminton_data.json');
const SERVICE_ACCOUNT_PATH = process.env.SERVICE_ACCOUNT_KEY_PATH || path.join(ROOT, 'serviceAccountKey.json');
const SYNTHETIC_EMAIL_DOMAIN = 'members.badminton-tracker.local'; // must match auth.service.ts

function syntheticEmail(username) {
  return `${username}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

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

  const trackerDoc = await db.collection('trackerData').doc('main').get();
  let members;
  if (trackerDoc.exists) {
    members = trackerDoc.data().members;
    console.log('Reading member roster from live Firestore trackerData/main.');
  } else {
    members = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).members;
    console.log('trackerData/main not seeded yet — reading member roster from local badminton_data.json.');
  }

  let created = 0;
  let skipped = 0;

  for (const member of members) {
    if (!member.username) {
      console.warn(`Skipping "${member.name}" (id ${member.id}) — no username. Run scripts/add-member-usernames.js first.`);
      continue;
    }

    const usernameDoc = await db.collection('usernames').doc(member.username).get();
    if (usernameDoc.exists) {
      skipped++;
      continue;
    }

    const userRecord = await admin.auth().createUser({
      email: syntheticEmail(member.username),
      password: member.username,
      displayName: member.name
    });

    await db.collection('roles').doc(userRecord.uid).set({
      username: member.username,
      memberId: member.id,
      role: 'viewer',
      mustChangePassword: true,
      createdAt: new Date().toISOString()
    });

    await db.collection('usernames').doc(member.username).set({
      memberId: member.id,
      uid: userRecord.uid
    });

    console.log(`Provisioned ${member.name} (@${member.username}) -> uid ${userRecord.uid}`);
    created++;
  }

  console.log(`\nDone. Created ${created} account(s), skipped ${skipped} already-provisioned member(s).`);
  if (created > 0) {
    console.log('Default password for each new account is their own username. They will be forced to change it on first sign-in.');
    console.log('Remember: promote exactly one account to "owner" in the Firebase Console (Firestore -> roles/{uid} -> role) — nobody can do this from the app.');
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('FAILED:', err.message);
    process.exit(1);
  });
