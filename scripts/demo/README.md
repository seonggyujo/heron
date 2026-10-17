# Demo GIFs

Scripts that start a dev build of Heron, drive it and film it through its
DevTools port (CDP), and turn the recordings into the GIFs in `docs/media/`
used by the READMEs. Nothing touches Windows' own mouse or keyboard and the
window never takes focus, so the PC stays usable while they run.

| File | Role |
| --- | --- |
| `record.js` | Entry: starts the app, runs the scenes, films each into `rec/<scene>/` |
| `make-gifs.js` | `rec/<scene>/` to `docs/media/<scene>.gif` (50 fps, page size, 256 colors) |
| `scenes.js` | The terminal scenes: `split`, `arrange`, `shells`, `activity`, `settings` |
| `agents.js` | The first GIF of the READMEs, `agents` and `agents.ko`: three real Claude Code sessions |
| `stage.js` | What scenes do to the app (panes, shell menu, sidebar, language), found by page elements |
| `input.js` | Mouse and keyboard through CDP, with a drawn pointer |
| `capture.js` | Screencast frames to PNG files with their times |
| `app.js` | Starts and stops the dev build: own identifier, DevTools port, no focus, empty Claude Code config |
| `cdp.js` | A small DevTools Protocol client |
| `paths.js` | Folders, and where ffmpeg is |

## Use

```powershell
winget install Gyan.FFmpeg                # once
node scripts/demo/record.js               # every scene, a few minutes
node scripts/demo/record.js split,settings
node scripts/demo/make-gifs.js            # every recorded scene
```

`record.js` starts the dev build itself (`npx tauri dev` with its own
identifier, `io.github.seonggyujo.heron.demo`) and stops it at the end. An
installed Heron keeps running untouched: the two never share settings or the
single-instance lock. Every run starts from default settings.

The app runs with an empty Claude Code config folder (`CLAUDE_CONFIG_DIR`),
so its sidebar shows none of your own sessions.

## The agents GIFs

`agents` and `agents.ko` (Korean UI) start Claude Code in three panes, in
folders under `~/demo` that the script makes, and give each a tiny prompt on
Haiku. The sessions run as you: the panes drop `CLAUDE_CONFIG_DIR`, so they
use your login, your hooks (Heron's Claude Code hooks must be on for the
activity and tokens) and the heron-limits plugin if you have it. Recording
both uses a little of your plan's usage, and the sessions stay in your
Claude Code history.

`web-client` starts with `--permission-mode default` so that it waits for
permission; the other two run in your default mode. If yours asks about the
ping, the script allows it.

## When the UI changes

The scenes find buttons by their classes and text (`stage.js`), not by
coordinates, so most UI changes need nothing. A renamed class or label shows
up as an error naming what was not found.

Recordings go to `scripts/demo/rec/`, which git ignores.
