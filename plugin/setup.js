#!/usr/bin/env node
/**
 * Puts the heron-limits status line in place and takes it out again.
 *
 *   node setup.js sync        SessionStart hook: take the status line, keeping the user's own one
 *                             to run inside ours, and refresh the installed copy after an update
 *   node setup.js first-run   UserPromptSubmit hook: "sync" once, so a plugin installed
 *                             mid-session is in place after the next restart
 *   node setup.js disable     /heron-limits:disable: give the user's own status line back
 *
 * settings.json points at a copy in ~/.claude/heron-limits/, not into the plugin, because the
 * plugin's folder changes with every version, and a copy keeps working if the plugin is removed.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { SAVED_NAME } = require('./previous');
const { replaceFile } = require('./replace-file');

const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json');
const DATA_DIR = path.join(CONFIG_DIR, 'heron-limits');
const PREVIOUS_FILE = path.join(DATA_DIR, SAVED_NAME);
// Written by the first sync, so the per-message hook can stop early.
const INITIALIZED_FILE = path.join(DATA_DIR, 'initialized');
// What a script requires comes before it, so a status line that starts while they are being
// copied finds what it needs.
const SCRIPTS = ['replace-file.js', 'heron-file.js', 'previous.js', 'statusline.js'];
// Forward slashes: the command runs in a shell, and backslashes break it on Windows.
const COMMAND = 'node "' + path.join(DATA_DIR, 'statusline.js').split(path.sep).join('/') + '"';

function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  replaceFile(file, text);
}

/** Copies the scripts the status line runs when they differ from the plugin's. */
function copyScripts() {
  for (const name of SCRIPTS) {
    const source = fs.readFileSync(path.join(__dirname, name), 'utf8');
    const target = path.join(DATA_DIR, name);
    let current = null;
    try {
      current = fs.readFileSync(target, 'utf8');
    } catch (e) {}
    if (current !== source) writeAtomic(target, source);
  }
}

/** Parsed settings plus the indent used in the file, so a rewrite keeps its style. */
function readSettings() {
  let text;
  try {
    text = fs.readFileSync(SETTINGS_FILE, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return { settings: {}, indent: 2 };
    throw e;
  }
  const indent = text.match(/^([ \t]+)"/m);
  try {
    return { settings: text.trim() ? JSON.parse(text) : {}, indent: indent ? indent[1] : 2 };
  } catch (e) {
    throw new Error(SETTINGS_FILE + ' is not valid JSON, so it was left unchanged');
  }
}

function writeSettings({ settings, indent }) {
  writeAtomic(SETTINGS_FILE, JSON.stringify(settings, null, indent) + '\n');
}

const isOurs = statusLine => Boolean(statusLine && statusLine.command === COMMAND);

/**
 * Takes the status line unless it is ours already. The user's own one is saved to run inside
 * ours, and its other settings (refreshInterval, padding) stay. Prints a note for Claude when it
 * changes, because the change shows only after Claude Code restarts.
 */
function sync() {
  try {
    const file = readSettings();
    const current = file.settings.statusLine;
    copyScripts();
    if (!isOurs(current)) {
      writeAtomic(PREVIOUS_FILE, JSON.stringify({ statusLine: current || null }, null, 2) + '\n');
      const { type, command, ...rest } = current || {};
      file.settings.statusLine = { type: 'command', command: COMMAND, ...rest };
      writeSettings(file);
      console.log(
        'heron-limits plugin: the status line now also sends usage limits to Heron; it shows the same as before.' +
          ' In your next reply, tell the user once to restart Claude Code for this to take effect.',
      );
    }
    if (!fs.existsSync(INITIALIZED_FILE)) writeAtomic(INITIALIZED_FILE, '');
  } catch (e) {}
}

function firstRun() {
  if (!fs.existsSync(INITIALIZED_FILE)) sync();
}

function disable() {
  const file = readSettings();
  if (!isOurs(file.settings.statusLine)) return 'The heron-limits status line was not on.';
  let previous = null;
  try {
    previous = JSON.parse(fs.readFileSync(PREVIOUS_FILE, 'utf8')).statusLine;
  } catch (e) {}
  if (previous) file.settings.statusLine = previous;
  else delete file.settings.statusLine;
  writeSettings(file);
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  return (
    (previous ? 'Your own status line is back.' : 'statusLine was removed from settings.json.') +
    ' Uninstall or disable the plugin now; while it is on, the next session start takes the status line again.'
  );
}

const action = process.argv[2];
try {
  if (action === 'sync') sync();
  else if (action === 'first-run') firstRun();
  else if (action === 'disable') console.log(disable());
  else {
    // stderr and exit code 1, never 2: from a hook, exit code 2 blocks the user's prompt.
    console.error('usage: node setup.js sync | first-run | disable');
    process.exitCode = 1;
  }
} catch (e) {
  console.log('Failed: ' + e.message);
  process.exitCode = 1;
}
