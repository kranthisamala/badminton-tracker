const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const PORT = Number(process.env.PORT || 5000);
const BASE_DIR = __dirname;
const DATA_FILE = path.join(BASE_DIR, 'badminton_data.json');
const MAX_BODY_BYTES = 2 * 1024 * 1024;

const DEFAULT_DATA = {
  members: [],
  sessions: [],
  attendance: {},
  duesPayments: [],
  nextId: 1,
  nextMemberId: 1
};

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(body));
  res.end(body);
}

function isValidTrackerData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (!Array.isArray(data.members)) return false;
  if (!data.members.every(m => m && typeof m === 'object' && typeof m.id === 'number' && typeof m.name === 'string')) return false;
  if (!Array.isArray(data.sessions)) return false;
  if (!data.attendance || typeof data.attendance !== 'object' || Array.isArray(data.attendance)) return false;
  if (!Object.values(data.attendance).every(ids => Array.isArray(ids) && ids.every(id => typeof id === 'number'))) return false;
  if (typeof data.nextId !== 'number') return false;
  if (typeof data.nextMemberId !== 'number') return false;
  if (data.duesPayments !== undefined && !Array.isArray(data.duesPayments)) return false;
  return true;
}

async function atomicWriteJson(filePath, payload) {
  const tempPath = filePath + '.tmp';
  const content = JSON.stringify(payload, null, 2) + '\n';
  await fs.writeFile(tempPath, content, 'utf8');
  await fs.rename(tempPath, filePath);
}

async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await atomicWriteJson(DATA_FILE, DEFAULT_DATA);
  }
}

async function readData() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

async function readRequestJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;

    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const parsed = raw.trim() ? JSON.parse(raw) : null;
        resolve(parsed);
      } catch {
        reject(new Error('invalid json'));
      }
    });

    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (requestUrl.pathname === '/data' && req.method === 'GET') {
    try {
      const data = await readData();
      sendJson(res, 200, data);
    } catch {
      sendJson(res, 500, { error: 'failed to read data file' });
    }
    return;
  }

  if (requestUrl.pathname === '/data' && req.method === 'POST') {
    try {
      const payload = await readRequestJson(req);
      if (!isValidTrackerData(payload)) {
        sendJson(res, 400, { error: 'invalid tracker data payload' });
        return;
      }

      await atomicWriteJson(DATA_FILE, payload);
      sendJson(res, 200, { ok: true });
    } catch (error) {
      if (error && error.message === 'payload too large') {
        sendJson(res, 413, { error: 'payload too large' });
        return;
      }
      if (error && error.message === 'invalid json') {
        sendJson(res, 400, { error: 'invalid json' });
        return;
      }
      sendJson(res, 500, { error: 'failed to save data file' });
    }
    return;
  }

  if (requestUrl.pathname === '/' && req.method === 'GET') {
    sendJson(res, 200, {
      service: 'badminton-tracker-api',
      status: 'ok',
      endpoints: ['/data']
    });
    return;
  }

  sendJson(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  Badminton Tracker - Node Backend');
  console.log('  ---------------------------------');
  console.log(`  Server running at http://localhost:${PORT}`);
  console.log('  Data file: badminton_data.json');
  console.log('  Press Ctrl+C to stop');
  console.log('');
});
