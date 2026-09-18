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
- No sync, no import wizard — courses are copied manually into the `study/` folder
