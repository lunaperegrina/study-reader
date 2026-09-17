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

See [`packages/koreader-plugin/docs/DEVELOPING.md`](packages/koreader-plugin/docs/DEVELOPING.md).
