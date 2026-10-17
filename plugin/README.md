# heron-limits

A Claude Code plugin for [Heron](https://github.com/seonggyujo/heron). Heron's own hooks tell it
what each agent is doing and which model answered, but some things reach only Claude Code's
status line: the 5-hour and weekly usage limits, how full each agent's context window is, and the
selected model of a session you resumed. This plugin passes those to Heron, which shows the
limits and the context use in the bar along the bottom of its window and checks the answers of
resumed sessions against that model.

## Install

In Claude Code:

```
/plugin marketplace add seonggyujo/heron
/plugin install heron-limits@heron
```

Then send a message and restart Claude Code once; Claude Code reads the status line setting only
when it starts. Requires Node.js.

## What it changes

It points `statusLine` in `~/.claude/settings.json` at a small script in `~/.claude/heron-limits/`.
If you had a status line, the script runs it with the same input and prints what it printed, so
the status line looks as before; its `refreshInterval` and `padding` stay. Without one, the status
line stays empty. A status line you set later is taken in the same way at the next session start.

## Update

Claude Code does not update plugins from this marketplace on its own unless you turn on
auto-update for it. To get a new version, run this in your shell (or pick **Update now** for the
plugin in `/plugin`):

```
claude plugin update heron-limits@heron
```

The next session start puts the new status line script in `~/.claude/heron-limits/`.

Inside a Heron pane the script also writes `<pane>.status.json` in the folder Heron names
(`HERON_AGENT_DIR`): the limits with their reset times, the context use, and the selected model.
Outside Heron it writes nothing. The file stays on your machine.

## Uninstall

Run `/heron-limits:disable` first. It gives your own status line back (or removes `statusLine`)
and deletes `~/.claude/heron-limits/`. Then `/plugin uninstall heron-limits@heron`.

## Test

```sh
node --test "test/*.test.js"
```
