// One-off: adds a unique, single-word `username` field to every member in
// badminton_data.json, derived from their full name (lowercased,
// non-alphanumeric characters stripped, numeric suffix added on collision).
// `name` is untouched — this only adds `username` alongside it.
//
// Run once: node scripts/add-member-usernames.js
// (take a backup first — see backups/ for the pattern used elsewhere in this repo)

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'badminton_data.json');

function slugify(name, taken) {
  let base = name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'member';
  // Username doubles as the default first-login password, and Firebase Auth
  // requires passwords to be at least 6 characters.
  while (base.length < 6) base += '0';
  let candidate = base;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = base + n;
    n++;
  }
  taken.add(candidate);
  return candidate;
}

function main() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const taken = new Set();

  data.members.forEach(member => {
    if (member.username) {
      taken.add(member.username);
    }
  });

  data.members.forEach(member => {
    if (!member.username) {
      member.username = slugify(member.name, taken);
    }
  });

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');

  console.log('Assigned usernames:');
  data.members.forEach(m => console.log(`  ${m.id}\t${m.name}\t-> ${m.username}`));
}

main();
