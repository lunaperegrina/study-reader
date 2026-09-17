# Developing the KOReader plugin

## Dev loop over SSH

The fastest iteration cycle (no cable, no restart gymnastics):

```sh
STUDYREADER_HOST=root@192.168.1.50 pnpm plugin:deploy
```

The script:

1. `rsync`s `plugin/studyreader.koplugin/` → `/mnt/us/koreader/plugins/studyreader.koplugin/` (Kindle paths; override with `STUDYREADER_PLUGIN_DST`)
2. `rsync`s `examples/*.study` → `/mnt/us/documents/study/` (override with `STUDYREADER_STUDY_DST`)
3. runs `STUDYREADER_RESTART_CMD` (default `killall -TERM luajit`) — KOReader exits to the launcher; reopen it to load the new plugin code

Enabling SSH on a Kindle usually means installing [USBNetwork](https://www.mobileread.com/forums/showthread.php?t=186645) (comes with KUAL) and either `ssh` over Wi-Fi or USB.

## Debugging

- Crash log: `/mnt/us/koreader/crash.log` on the device (`ssh root@kindle tail -50 /mnt/us/koreader/crash.log`).
- Runtime log (verbose): restart KOReader from a shell with
  `./reader.lua -d` to get debug output on stdout.
- Add `logger.dbg(...)` calls — the plugin already logs warnings through
  `logger` (requires `-d` or `--debug` to show dbg-level).

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

## Known limitations (M1)

- Quiz re-answering is not supported yet (answered questions are skipped)
- Nested lists and escaped pipes inside table cells are not handled by the Markdown renderer
- No sync, no import wizard — courses are copied manually into the `study/` folder
