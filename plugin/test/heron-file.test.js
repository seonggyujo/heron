/** heron-file.js: what the status line leaves for Heron, and only inside a Heron pane. */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');
const { tempConfig, setup, statusLine } = require('./helpers');

const INPUT = {
  session_id: 's1',
  model: { id: 'claude-opus-5-5' },
  effort: { level: 'high' },
  context_window: { used_percentage: 34 },
  rate_limits: { five_hour: { used_percentage: 42.5, resets_at: 1738425600 }, seven_day: { used_percentage: null } },
};

test('inside a Heron pane, writes the limits, the context use, the effort and the selected model', () => {
  const config = tempConfig();
  setup(config, 'sync');
  statusLine(config, INPUT, '123-4');
  const written = JSON.parse(fs.readFileSync(path.join(config.agentDir, '123-4.status.json'), 'utf8'));
  assert.ok(Number.isFinite(written.at));
  assert.deepStrictEqual(
    { model: written.model, effort: written.effort, context: written.context, limits: written.limits },
    { model: 'claude-opus-5-5', effort: 'high', context: 34, limits: { five_hour: { used: 42.5, resets_at: 1738425600 }, seven_day: null } },
  );
  assert.deepStrictEqual(fs.readdirSync(config.agentDir), ['123-4.status.json'], 'no temporary file is left');
});

test('outside Heron, or with a key that is not a pane key, writes nothing', () => {
  const config = tempConfig();
  setup(config, 'sync');
  statusLine(config, INPUT);
  const outside = path.join(config.dir, 'escape');
  statusLine(config, INPUT, path.relative(config.agentDir, outside));
  assert.deepStrictEqual(fs.readdirSync(config.agentDir), []);
  assert.ok(!fs.existsSync(outside + '.status.json'), 'nothing is written outside the folder');
});

test('missing fields become null', () => {
  const config = tempConfig();
  setup(config, 'sync');
  statusLine(config, {}, '1-1');
  const written = JSON.parse(fs.readFileSync(path.join(config.agentDir, '1-1.status.json'), 'utf8'));
  assert.deepStrictEqual(
    [written.model, written.effort, written.context, written.limits],
    [null, null, null, { five_hour: null, seven_day: null }],
  );
});
