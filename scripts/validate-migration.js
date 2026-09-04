// Validates badminton_data.candidate.json (id-based) against the pre-migration
// backup (name-based) in backups/. Recomputes per-member financials independently
// from both shapes using the same formula as TrackerStoreService:
//   balance = sessionPaid - shareOwed + duesPaid - duesReceived
// and asserts they match exactly (within floating point tolerance).
//
// Exits 0 and prints PASS only if everything matches. Exits 1 on any mismatch.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BACKUPS_DIR = path.join(ROOT, 'backups');
const CANDIDATE_FILE = path.join(ROOT, 'badminton_data.candidate.json');
const EPSILON = 0.001;

function latestBackupFile() {
  const files = fs.readdirSync(BACKUPS_DIR)
    .filter(f => f.startsWith('badminton_data.pre-id-migration.') && f.endsWith('.json'))
    .sort();
  if (!files.length) throw new Error('No backup found in backups/.');
  return path.join(BACKUPS_DIR, files[files.length - 1]);
}

function summarizeOld(data) {
  const owed = {}, sessionPaid = {}, duesPaid = {}, duesReceived = {};
  data.members.forEach(name => { owed[name] = 0; sessionPaid[name] = 0; duesPaid[name] = 0; duesReceived[name] = 0; });

  data.sessions.forEach(session => {
    const attendees = data.attendance[String(session.id)] || [];
    if (!attendees.length) return;
    const share = session.cost / attendees.length;
    attendees.forEach(name => { if (owed[name] !== undefined) owed[name] += share; });
    session.payments.forEach(p => { if (sessionPaid[p.player] !== undefined) sessionPaid[p.player] += p.amount; });
  });

  (data.duesPayments || []).forEach(p => {
    if (duesPaid[p.from] !== undefined) duesPaid[p.from] += p.amount;
    if (duesReceived[p.to] !== undefined) duesReceived[p.to] += p.amount;
  });

  const result = {};
  data.members.forEach(name => {
    result[name] = {
      owed: owed[name],
      sessionPaid: sessionPaid[name],
      duesPaid: duesPaid[name],
      duesReceived: duesReceived[name],
      balance: sessionPaid[name] - owed[name] + duesPaid[name] - duesReceived[name]
    };
  });
  return result;
}

function summarizeNew(data) {
  const idToName = new Map(data.members.map(m => [m.id, m.name]));
  const owed = {}, sessionPaid = {}, duesPaid = {}, duesReceived = {};
  data.members.forEach(m => { owed[m.id] = 0; sessionPaid[m.id] = 0; duesPaid[m.id] = 0; duesReceived[m.id] = 0; });

  data.sessions.forEach(session => {
    const attendees = data.attendance[String(session.id)] || [];
    if (!attendees.length) return;
    const share = session.cost / attendees.length;
    attendees.forEach(id => { if (owed[id] !== undefined) owed[id] += share; });
    session.payments.forEach(p => { if (sessionPaid[p.memberId] !== undefined) sessionPaid[p.memberId] += p.amount; });
  });

  (data.duesPayments || []).forEach(p => {
    if (duesPaid[p.fromId] !== undefined) duesPaid[p.fromId] += p.amount;
    if (duesReceived[p.toId] !== undefined) duesReceived[p.toId] += p.amount;
  });

  const result = {};
  data.members.forEach(m => {
    result[m.name] = {
      owed: owed[m.id],
      sessionPaid: sessionPaid[m.id],
      duesPaid: duesPaid[m.id],
      duesReceived: duesReceived[m.id],
      balance: sessionPaid[m.id] - owed[m.id] + duesPaid[m.id] - duesReceived[m.id]
    };
  });
  return result;
}

function close(a, b) {
  return Math.abs(a - b) < EPSILON;
}

function main() {
  const backupPath = latestBackupFile();
  const oldData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

  if (!fs.existsSync(CANDIDATE_FILE)) {
    console.error('FAIL: candidate file not found. Run scripts/migrate-to-id-schema.js first.');
    process.exit(1);
  }
  const newData = JSON.parse(fs.readFileSync(CANDIDATE_FILE, 'utf8'));

  const errors = [];

  // Structural checks
  if (oldData.members.length !== newData.members.length) {
    errors.push(`member count mismatch: old=${oldData.members.length} new=${newData.members.length}`);
  }
  const oldNames = new Set(oldData.members);
  const newNames = new Set(newData.members.map(m => m.name));
  oldNames.forEach(n => { if (!newNames.has(n)) errors.push(`member "${n}" missing in new data`); });
  newNames.forEach(n => { if (!oldNames.has(n)) errors.push(`member "${n}" unexpected in new data (not in old)`); });

  const newIds = newData.members.map(m => m.id);
  if (new Set(newIds).size !== newIds.length) errors.push('duplicate member ids in new data');

  if (oldData.sessions.length !== newData.sessions.length) {
    errors.push(`session count mismatch: old=${oldData.sessions.length} new=${newData.sessions.length}`);
  }
  oldData.sessions.forEach((oldSession, i) => {
    const newSession = newData.sessions[i];
    if (!newSession || newSession.id !== oldSession.id || newSession.date !== oldSession.date || newSession.cost !== oldSession.cost) {
      errors.push(`session mismatch at index ${i} (id ${oldSession.id})`);
    }
  });

  Object.keys(oldData.attendance).forEach(sessionId => {
    const oldCount = (oldData.attendance[sessionId] || []).length;
    const newCount = (newData.attendance[sessionId] || []).length;
    if (oldCount !== newCount) errors.push(`attendance count mismatch for session ${sessionId}: old=${oldCount} new=${newCount}`);
  });

  const oldDues = oldData.duesPayments || [];
  const newDues = newData.duesPayments || [];
  if (oldDues.length !== newDues.length) errors.push(`dues payment count mismatch: old=${oldDues.length} new=${newDues.length}`);
  const oldDuesTotal = oldDues.reduce((s, p) => s + p.amount, 0);
  const newDuesTotal = newDues.reduce((s, p) => s + p.amount, 0);
  if (!close(oldDuesTotal, newDuesTotal)) errors.push(`dues total mismatch: old=${oldDuesTotal} new=${newDuesTotal}`);

  if (typeof newData.nextMemberId !== 'number' || newData.nextMemberId <= Math.max(...newIds, 0)) {
    errors.push('nextMemberId is missing or not greater than the max member id');
  }

  // Financial checks
  const oldSummary = summarizeOld(oldData);
  const newSummary = summarizeNew(newData);

  Object.keys(oldSummary).forEach(name => {
    const o = oldSummary[name];
    const n = newSummary[name];
    if (!n) { errors.push(`member "${name}" missing from new summary`); return; }
    ['owed', 'sessionPaid', 'duesPaid', 'duesReceived', 'balance'].forEach(field => {
      if (!close(o[field], n[field])) {
        errors.push(`${name}.${field} mismatch: old=${o[field]} new=${n[field]}`);
      }
    });
  });

  if (errors.length) {
    console.error(`FAIL: ${errors.length} mismatch(es) found:\n`);
    errors.forEach(e => console.error(' - ' + e));
    process.exit(1);
  }

  console.log('PASS: candidate matches backup exactly.');
  console.log(`  members: ${newData.members.length}, sessions: ${newData.sessions.length}, dues: ${newDues.length}`);
}

main();
