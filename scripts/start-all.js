const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const API_PORT = 5000;

function startProcess(name, command, cwd) {
  const child = spawn(command, {
    cwd,
    stdio: 'inherit',
    shell: true,
    windowsHide: false
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${name}] exited with signal ${signal}`);
      return;
    }
    console.log(`[${name}] exited with code ${code}`);
  });

  child.on('error', (error) => {
    console.error(`[${name}] failed to start:`, error.message);
  });

  return child;
}

function findFreePort(startPort, maxAttempts) {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    function tryPort(port) {
      const server = net.createServer();

      server.once('error', () => {
        server.close(() => {
          attempt += 1;
          if (attempt >= maxAttempts) {
            reject(new Error('no free dev port found for Angular'));
            return;
          }
          tryPort(port + 1);
        });
      });

      server.once('listening', () => {
        server.close(() => resolve(port));
      });

      server.listen(port);
    }

    tryPort(startPort);
  });
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port);
  });
}

let api = null;
let web = null;

let isShuttingDown = false;

function shutdown() {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  console.log('\nShutting down dev processes...');

  stopChild(web);
  stopChild(api);

  setTimeout(() => process.exit(0), 300);
}

function stopChild(child) {
  if (!child || child.killed) {
    return;
  }

  if (isWindows) {
    spawn('taskkill /PID ' + child.pid + ' /T /F', {
      stdio: 'ignore',
      shell: true
    });
    return;
  }

  child.kill('SIGINT');
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function start() {
  try {
    const apiPortAvailable = await isPortAvailable(API_PORT);
    if (apiPortAvailable) {
      api = startProcess('api', 'node server.js', ROOT);
    } else {
      console.log(`API port ${API_PORT} already in use. Reusing existing backend.`);
    }

    const angularPort = await findFreePort(4300, 100);
    console.log(`Starting Angular dev server on port ${angularPort}`);
    web = startProcess('web', `npm --prefix badminton-angular start -- --port ${angularPort} --host 127.0.0.1`, ROOT);

    if (api) {
      api.on('exit', (code) => {
        if (!isShuttingDown && code !== 0) {
          shutdown();
        }
      });
    }

    web.on('exit', (code) => {
      if (!isShuttingDown && code !== 0) {
        shutdown();
      }
    });
  } catch (error) {
    console.error('Failed to start combined dev environment:', error.message);
    process.exit(1);
  }
}

start();
