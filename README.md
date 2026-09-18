# study-reader

Turn any material you want to learn into an interactive course on your e-reader.

study-reader is an open study ecosystem built on two pieces:

- **`.study` — an open course format.** A portable ZIP package containing
  lessons in Markdown, quizzes, flashcards and assets. Content is immutable and
  readable anywhere; user state never lives inside the package.
- **`studyreader.koplugin` — a KOReader plugin.** The runtime that opens
  `.study` files on Kindle/Kobo/PocketBook: renders lessons, runs quizzes,
  schedules flashcard reviews (SM-2) and tracks progress — fully offline.

```
.study file              KOReader plugin            local user state
(portable content)  →    (runtime / player)    →    (progress + SRS)
```

The analogy: `.study` is to this plugin what `.epub` is to an e-reader.

## Status

Early development (M1):

- [x] `.study` format specification + JSON Schemas + TypeScript toolkit
- [x] `mdx-to-study` converter (built against a real 78-lesson System Design course)
- [x] KOReader plugin: courses, lesson reading (crengine), quizzes, flashcards + SRS
- [ ] Cloud sync / web reader / AI generation (out of scope for M1)

## Repository layout

```
packages/
  study-format/      the .study spec, JSON Schemas and a TS toolkit (zod + fflate)
  mdx-to-study/      converter: course content (MDX) → .study
  koreader-plugin/   studyreader.koplugin (Lua) + SSH deploy script
examples/            sample .study courses
```

## The .study format (summary)

A `.study` file is a ZIP:

```
manifest.json            entry point: formatVersion, course version, modules, lessons
content/001-intro.md     lesson content in Markdown
questions/questions.json quiz bank: { id: { type, question, options, correct, explanation } }
flashcards/flashcards.json   deck: [{ id, front, back, tags }]
assets/                  images and covers
```

Lessons embed interactive blocks as plain-text directives, so the Markdown
stays readable outside any platform:

```
{{quiz:q-load-balancing-01}}
{{flashcard:card-001}}
{{image:assets/F01_k1.jpg}}
```

See [`packages/study-format/SPEC.md`](packages/study-format/SPEC.md) for the
full specification.

## Quick start

```sh
pnpm install
pnpm test            # toolkit + converter tests
pnpm study:build -- --source <course-books> --out examples/
```

Deploy the plugin + a `.study` course to a Kindle running KOReader over SSH:

```sh
STUDYREADER_HOST=root@kindle-ip pnpm plugin:deploy
```

The same device can be driven remotely (e-ink screenshots, injected taps,
relaunching KOReader, crash.log) — `pnpm plugin:remote screenshot` — so UI work
is verified without holding the reader.

## Web platform

`apps/web` + `apps/api` form the study-reader platform: private library
(upload any `.study`), an in-browser reader (lessons, quizzes, SM-2 flashcard
reviews) and an AI course creator (paste text or upload `.md`/`.pdf`; outline
review, then per-lesson generation). Progress syncs with the Kindle plugin:
pair the device in Settings → dispositivos, then use "Sync now" / "Download my
courses" in KOReader's Study menu.

```sh
docker compose up -d          # Postgres on 127.0.0.1:5435
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm api:db:migrate
pnpm dev                      # api :3001, web :5173
```

AI generation needs a provider key in `apps/api/.env`
(`ANTHROPIC_API_KEY` or `OPENAI_API_KEY` + optional `OPENAI_BASE_URL`,
`CREATOR_MODEL`, `CREATOR_MONTHLY_LIMIT`). Self-hosted instances use their own
keys; the hosted deployment applies a monthly per-account quota.

Deploy (Railway, house pattern): `apps/api/Dockerfile` compiles the api with
Bun into a distroless image (migrations in `apps/api/drizzle`, apply on boot or
manually against the prod `DATABASE_URL`); `apps/web/Dockerfile` builds the SPA
and serves it with Caddy. See [`packages/koreader-plugin/docs/DEVELOPING.md`](packages/koreader-plugin/docs/DEVELOPING.md)
for the local device-sync loop.

See [`packages/koreader-plugin/docs/DEVELOPING.md`](packages/koreader-plugin/docs/DEVELOPING.md).

## Licensing

| Component | License |
| --- | --- |
| `.study` format specification ([SPEC.md](packages/study-format/SPEC.md)) | CC0 1.0 (public domain) |
| `packages/study-format`, `packages/mdx-to-study`, `packages/koreader-plugin` | MIT |
| `apps/*` (web platform) | AGPL-3.0 |

The spec is CC0 so anyone can implement or fork the format without
restriction; the toolkit and plugin are MIT for maximum adoption; the platform
apps are AGPL so hosted derivatives must stay open.
