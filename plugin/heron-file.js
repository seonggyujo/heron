/**
 * Heron link. Inside a Heron pane the shell carries HERON_PANE (the pane's key) and
 * HERON_AGENT_DIR (a folder Heron watches). The status line keeps <key>.status.json there with
 * what Heron cannot get by itself: the usage limits, the context use, and the selected model
 * (Heron's hooks do not get it for a resumed session). Outside Heron nothing is written. The file is replaced in one step (write, then rename), so Heron never reads half of
 * it. Never throws.
 */
'use strict';

const path = require('path');
const { replaceFile } = require('./replace-file');

const VERSION = 1;

/** The pane's status file, or null outside a Heron pane. */
function target() {
  const pane = process.env.HERON_PANE;
  const dir = process.env.HERON_AGENT_DIR;
  if (!pane || !dir || !/^\d+-\d+$/.test(pane)) return null;
  return path.join(dir, pane + '.status.json');
}

const finite = n => n !== null && n !== undefined && Number.isFinite(Number(n));

function limit(window) {
  if (!window || !finite(window.used_percentage)) return null;
  return { used: Number(window.used_percentage), resets_at: finite(window.resets_at) ? Number(window.resets_at) : null };
}

/** What Heron shows, from the status line input. */
function statusOf(input) {
  const limits = input.rate_limits || {};
  const context = input.context_window || {};
  const model = input.model || {};
  return {
    v: VERSION,
    at: Date.now(),
    model: typeof model.id === 'string' && model.id ? model.id : null,
    context: finite(context.used_percentage) ? Number(context.used_percentage) : null,
    limits: { five_hour: limit(limits.five_hour), seven_day: limit(limits.seven_day) },
  };
}

function write(input) {
  const file = target();
  if (!file) return;
  try {
    replaceFile(file, JSON.stringify(statusOf(input || {})));
  } catch (e) {}
}

module.exports = { write };
