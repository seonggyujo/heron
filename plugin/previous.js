/**
 * The user's own status line, which setup.js saved next to this file when it put heron-limits in
 * its place: runs it with the same input and hands back what it printed, so the status line looks
 * as it did. Null when there is none, or when it fails or takes longer than TIMEOUT_MS.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// setup.js writes it in the folder this copy runs from.
const SAVED_NAME = 'previous-statusline.json';
const SAVED_FILE = path.join(__dirname, SAVED_NAME);
const TIMEOUT_MS = 3000;

function savedCommand() {
  try {
    const saved = JSON.parse(fs.readFileSync(SAVED_FILE, 'utf8')).statusLine;
    return saved && saved.type === 'command' && typeof saved.command === 'string' ? saved.command : null;
  } catch (e) {
    return null;
  }
}

/** Calls done(output or null) once. */
function run(input, done) {
  const command = savedCommand();
  // Never run ourselves: that would recurse.
  if (!command || command.includes('heron-limits/statusline.js')) return done(null);

  let finished = false;
  const finish = out => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    done(out ? out.replace(/\s+$/, '') || null : null);
  };
  // Our own timer: killing the shell on Windows leaves its child running with the pipe open,
  // and waiting for the pipe to close would wait for that child.
  const timer = setTimeout(() => finish(null), TIMEOUT_MS);
  const start = useShell => {
    // Status line commands are written for a POSIX shell (Git Bash on Windows): "~", quotes.
    const child = useShell
      ? spawn(command, { shell: true, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] })
      : spawn(process.env.SHELL || (process.platform === 'win32' ? 'bash' : '/bin/sh'), ['-c', command], {
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'ignore'],
        });
    let out = '';
    let retried = false;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => (out += chunk));
    child.on('error', e => {
      if (e.code === 'ENOENT' && !useShell) {
        retried = true;
        start(true);
      } else finish(null);
    });
    child.on('close', code => retried || finish(code === 0 ? out : null));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  };
  start(false);
}

module.exports = { run, SAVED_NAME };
