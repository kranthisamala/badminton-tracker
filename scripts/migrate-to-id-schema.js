// One-off migration: converts badminton_data.json from name-based identity
// (members: string[], payments[].player, attendance: name[], duesPayments.from/to)
// to id-based identity (members: {id,name}[], payments[].memberId, attendance: id[],
// duesPayments.fromId/toId).
//
// Reads the most recent backup in backups/, writes the converted result to
// badminton_data.candidate.json (does NOT touch the live badminton_data.json).
// Run scripts/validate-migration.js against the candidate before promoting it.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BACKUPS_DIR = path.join(ROOT, 'backups');
const CANDIDATE_FILE = path.join(ROOT, 'badminton_data.candidate.json');

function latestBackupFile() {
  const files = fs.readdirSync(BACKUPS_DIR)
    .filter(f => f.startsWith('badminton_data.pre-id-migration.') && f.endsWith('.json'))
    .sort();
  if (!files.length) {
    throw new Error('No backup found in backups/. Run the backup step first.');
  }
  return path.join(BACKUPS_DIR, files[files.length - 1]);
}

function migrate(oldData) {
  const members = oldData.members.map((name, index) => ({ id: index + 1, name }));
  const nameToId = new Map(members.map(m => [m.name, m.id]));

  function resolveId(name, context) {
    const id = nameToId.get(name);
    if (id === undefined) {
      throw new Error(`Unknown member name "${name}" referenced in ${context}. Aborting migration.`);
    }
    return id;
  }

  const sessions = oldData.sessions.map(session => ({
    id: session.id,
    date: session.date,
    cost: session.cost,
    payments: session.payments.map(p => ({
      memberId: resolveId(p.player, `session ${session.id} payments`),
      amount: p.amount
    })),
    notes: session.notes
  }));

  const attendance = {};
  Object.keys(oldData.attendance).forEach(sessionId => {
    attendance[sessionId] = oldData.attendance[sessionId].map(name =>
      resolveId(name, `attendance[${sessionId}]`)
    );
  });

  const duesPayments = (oldData.duesPayments || []).map(payment => ({
    id: payment.id,
    fromId: resolveId(payment.from, `duesPayments id=${payment.id} (from)`),
    toId: resolveId(payment.to, `duesPayments id=${payment.id} (to)`),
    amount: payment.amount,
    date: payment.date,
    note: payment.note
  }));

  const nextMemberId = members.length ? Math.max(...members.map(m => m.id)) + 1 : 1;

  return {
    members,
    sessions,
    attendance,
    duesPayments,
    nextId: oldData.nextId,
    nextMemberId
  };
}

function main() {
  const backupPath = latestBackupFile();
  console.log('Reading backup:', backupPath);
  const oldData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

  const newData = migrate(oldData);

  fs.writeFileSync(CANDIDATE_FILE, JSON.stringify(newData, null, 2) + '\n', 'utf8');
  console.log('Wrote candidate:', CANDIDATE_FILE);
  console.log('Members mapped:', newData.members.length);
  console.log('Next: run `node scripts/validate-migration.js` before promoting the candidate.');
}

main();
