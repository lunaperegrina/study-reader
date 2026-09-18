# @study-reader/koreader-plugin

`studyreader.koplugin` — the KOReader runtime for [`.study`](../study-format/SPEC.md)
courses. Turns a KOReader device (Kindle, Kobo, PocketBook…) into a study reader:

- **My courses** — scans a `study/` folder for `.study` packages
- **Read lessons** — Markdown is rendered to XHTML and displayed by crengine
  with full formatting (bold, tables, diagrams)
- **Quizzes** — single/multiple choice with explanations, answers persisted locally
- **Flashcards** — SM-2 spaced repetition (Again / Hard / Good / Easy)
- **Progress** — completed lessons, continue studying, per-course percentages

Everything runs offline. The `.study` package is never modified: user state
lives under `<koreader-data>/studyreader/data/<course-id>/`.

## Layout

```
plugin/studyreader.koplugin/
  _meta.lua      plugin metadata (name/description for the plugin loader)
  main.lua       WidgetContainer + main-menu wiring ("Study" entry)
  store.lua      course discovery, .study (ZIP) reading via ffi/archiver, lesson rendering
  md2xhtml.lua   Markdown subset → standalone XHTML for crengine
  quiz.lua       quiz widget (single/multiple choice + feedback)
  review.lua     flashcard review widget (SM-2 grading)
  srs.lua        SM-2 scheduler
  state.lua      progress/answers/reviews JSON state
tests/run.lua    standalone luajit tests for the pure modules
deploy.sh        SSH deploy to a device
```

## Deploy to a device

Requires SSH access to the device (on Kindle: USBNetwork / KUAL).

```sh
STUDYREADER_HOST=root@192.168.1.50 pnpm plugin:deploy
```

Copies the plugin to `/mnt/us/koreader/plugins/studyreader.koplugin/`, ships any
`examples/*.study` to `/mnt/us/documents/study/`, and restarts KOReader. See
[docs/DEVELOPING.md](docs/DEVELOPING.md) for variables and the dev loop.

## Remote control (eyes + hands on the device)

Screenshots of the e-ink display, injected taps/swipes, relaunching KOReader
with a file open, and crash.log — all over SSH, no one needs to hold the
device:

```sh
STUDYREADER_HOST=root@192.168.1.50 pnpm plugin:remote screenshot
STUDYREADER_HOST=root@192.168.1.50 pnpm plugin:remote tap 536 660
```

Requires `python3` + `ffmpeg` locally; see
[docs/DEVELOPING.md](docs/DEVELOPING.md#remote-control-screen--input-over-ssh)
for the full command set and the iteration loop.

## Tests

```sh
pnpm plugin:test    # luajit tests/run.lua (pure modules)
pnpm plugin:check   # luajit syntax check of all plugin files
```
