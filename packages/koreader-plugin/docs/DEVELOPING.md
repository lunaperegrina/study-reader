# Developing the KOReader plugin

## Dev loop over SSH

The fastest iteration cycle (no cable, no restart gymnastics):

```sh
STUDYREADER_HOST=root@192.168.15.3 STUDYREADER_PORT=2222 pnpm plugin:deploy
```

The script:

1. `tar`s `plugin/studyreader.koplugin/` over ssh → `/mnt/us/koreader/plugins/studyreader.koplugin/` (Kindle paths; override with `STUDYREADER_PLUGIN_DST`). Stock Kindle firmware has no rsync — hence tar over ssh.
2. `tar`s `examples/*.study` → `/mnt/us/documents/study/` (override with `STUDYREADER_STUDY_DST`)
3. runs `STUDYREADER_RESTART_CMD` (default `killall -TERM luajit`) — KOReader exits to the launcher; reopen it to load the new plugin code (over ssh: `cd /mnt/us/koreader && nohup ./koreader.sh >/dev/null 2>&1 &`)

Other variables: `STUDYREADER_PORT` (SSH port; the reference Kindle uses 2222).

### Password auth without typing

If the device's sshd only does password auth (Kindle USBNetwork), inject it via
OpenSSH's askpass instead of installing sshpass:

```sh
printf '#!/bin/sh\necho "DEVICE_PASSWORD"\n' > /tmp/kindle-askpass.sh
chmod +x /tmp/kindle-askpass.sh
export SSH_ASKPASS=/tmp/kindle-askpass.sh SSH_ASKPASS_REQUIRE=force DISPLAY=:0
pnpm plugin:deploy
```

Notes from the reference Kindle: key auth from `/mnt/us/usbnet/etc/keys/` fails
because user storage is FAT (chmod is a no-op → world-writable authorized_keys
is rejected), and root's home is tmpfs (`/tmp/root`), so keys don't survive
reboots either — password + askpass is the pragmatic loop.

## Debugging

- KOReader on Kindle tees stdout/stderr to `/mnt/us/koreader/crash.log` — watch it live:
  `ssh -p 2222 root@<ip> 'tail -f /mnt/us/koreader/crash.log'`
- `pidof luajit` to check the process (busybox `ps` output is unreliable there)
- Add `logger.dbg(...)` calls — dbg-level needs `./koreader.sh` started with `-d`

## Remote control: screen + input over SSH

`tools/kindle-remote.sh` (root script `plugin:remote`) gives the dev machine
eyes and hands on the device, so plugin UIs can be verified without anyone
holding the Kindle:

```sh
export STUDYREADER_HOST=root@192.168.15.3 STUDYREADER_PORT=2222
pnpm plugin:remote info                                      # fb/touch/pid probe
pnpm plugin:remote screenshot [/tmp/kindle-screen.png]       # e-ink framebuffer -> PNG
pnpm plugin:remote tap <x> <y> [hold_ms]                     # hold 100ms = tap, 900 = long-press
pnpm plugin:remote swipe <x1> <y1> <x2> <y2> [ms]            # drag gesture
pnpm plugin:remote launch [/mnt/us/documents/study/foo.study]# restart KOReader, optionally opening a file
pnpm plugin:remote log [lines]                               # tail crash.log
```

How it works: screenshots read `/dev/fb0` (reference device: 8bpp grayscale,
1072×1448 — override with `STUDYREADER_FB_GEOMETRY=WxH`) and convert locally
with ffmpeg; input is protocol-B evdev events base64'd into the touchscreen
(`/dev/input/event1`, `pt_mt`), paced device-side with `usleep`. Same
`SSH_ASKPASS` auth as `deploy.sh`; needs `python3` + `ffmpeg` locally.

Full iteration loop without touching the device:

```sh
pnpm plugin:deploy
pnpm plugin:remote launch /mnt/us/documents/study/aws-ai-practitioner-aif-c01.study
sleep 12 && pnpm plugin:remote screenshot /tmp/s.png
pnpm plugin:remote tap 536 200   # "Practice exam (N questions)"
pnpm plugin:remote log 30        # errors end up in crash.log
```

Caveats: the framebuffer shows the logical screen — e-ink ghosting/flash
artifacts are not visible; tap coordinates are pixels in the fb's coordinate
space; busybox `sleep` is integer-only, which is why pacing uses `usleep`.
`launch` appends KOReader output to `crash.log` (redirecting to /dev/null
would silently lose logs, unlike framework-launched boots).

## Local tests (no device needed)

The pure modules (`md2xhtml`, `srs`) run under plain luajit:

```sh
cd packages/koreader-plugin
luajit tests/run.lua
```

The UI modules (`store`, `screens`, `quiz`, `review`) depend on KOReader
internals (`ffi/archiver`, `ui/widget/*`, `ReaderUI`) and are tested on-device.

## Reference sources

While writing plugin code, keep a shallow clone of the matching KOReader
sources around (the plugin targets current `master` APIs):

```sh
git clone --depth 1 https://github.com/koreader/koreader vendor/koreader
git clone --depth 1 https://github.com/koreader/koreader-base vendor/koreader-base
```

Useful references:

- `vendor/koreader/frontend/pluginloader.lua` — how plugins are discovered, `_meta.lua` fields, `package.path` injection
- `vendor/koreader/frontend/apps/reader/readerui.lua` — `ReaderUI:showReader(file)` (the only safe way to open a document)
- `vendor/koreader-base/ffi/archiver.lua` — `Archiver.Reader` (ZIP reading via libarchive)
- `vendor/koreader/plugins/vocabbuilder.koplugin/main.lua` — canonical example of a FocusManager-based plugin UI

## Simple UI integration

The reference Kindle uses [simpleui.koplugin](https://github.com/doctorhetfield-cmd/simpleui.koplugin)
as its home interface, which replaces the native file manager and hides the
standard main menu. The plugin therefore integrates with it when present:

- registers a Simple UI **Quick Action** (`studyreader_open` → My courses) via
  `QA.register` (guarded by `pcall`, no hard dependency)
- registers a KOReader **dispatcher action** `study_open` (bindable to gestures
  and to Simple UI custom actions)

To surface the Quick Action on the Simple UI home: edit the quick actions
(bottom bar / action list) and add "Study" from the picker.

## Known limitations (M1)

- Quiz re-answering is not supported yet (answered questions are skipped)
- Nested lists and escaped pipes inside table cells are not handled by the Markdown renderer
- Sync is manual (menu-triggered); courses can also be downloaded from the paired account (see "Cloud sync against a local api")

## Cloud sync against a local api (M12)

The plugin can pair with a study-reader platform instance and sync course
state + download courses over Wi-Fi. To test against the api on your machine:

1. Start Postgres + api + web:
   ```sh
   docker compose up -d
   pnpm api:db:migrate        # first time only
   pnpm dev                   # api on :3001 (all interfaces), web on :5173
   ```
2. In the web app: Settings → "Gerar código de pareamento" (6-char code,
   valid for 10 minutes).
3. On the Kindle, KOReader menu → Study → "Pair account": enter
   `http://<your-machine-lan-ip>:3001` and the code. The token is stored in
   `<koreader-data>/studyreader/sync.json`.
4. "Download my courses" pulls every `.study` from the account into
   `<koreader-data>/studyreader/courses/`; "Sync now" merges progress,
   answers and reviews per-key (last-write-wins on answeredAt / gradedAt /
   completed timestamps — the same rules the server applies, mirrored in
   `sync.lua` and tested in both directions).

Driving the pairing UI over e-ink is slow; alternatively pair from the dev
machine and drop the token on the device:

```sh
CODE=$(curl -s -b cookies.txt -X POST localhost:3001/api/v1/devices/pairing-code | jq -r .code)
TOKEN=$(curl -s -X POST localhost:3001/api/v1/devices/pair -H 'Content-Type: application/json' \
  -d "{\"code\":\"$CODE\",\"name\":\"Kindle\"}" | jq -r .deviceToken)
ssh -p 2222 root@kindle 'mkdir -p /mnt/us/koreader/studyreader' 
echo "{\"server\":\"http://192.168.15.4:3001\",\"token\":\"$TOKEN\"}" | \
  ssh -p 2222 root@kindle 'cat > /mnt/us/koreader/studyreader/sync.json'
```

Then use the remote tool (`pnpm plugin:remote screenshot` / `tap`) to open
Study → "Download my courses" and "Sync now" and verify on the framebuffer.
