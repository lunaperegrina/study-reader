# The `.study` Format — Specification v1

A `.study` file is a **portable, immutable study course package**: lessons in
Markdown, a quiz bank, a flashcard deck and assets, bundled as a ZIP.

```
.study file                reader runtime                user state
(portable content)   →     (renders + interacts)   →     (progress + SRS)
```

The analogy: `.study` is to a study reader what `.epub` is to an e-reader.
Anyone can build tools that produce or consume `.study` files — the format is
the product, not any specific app.

## 1. Container

- A `.study` file is a standard **ZIP** archive (deflate or store, any tooling).
- Recommended file extension: `.study`; recommended media type:
  `application/x-study+zip` (unregistered, informational).
- All text files are UTF-8. Paths inside the archive use `/` separators.
- The archive MUST be readable without executing anything: no scripts, no
  executable content.

## 2. Structure

```
manifest.json                  (required) entry point
content/<name>.md              (required, ≥1) lesson content in Markdown
questions/questions.json       (optional) quiz bank
flashcards/flashcards.json     (optional) flashcard deck
assets/<name>                  (optional) images, covers, audio…
```

Additional files and folders are allowed; consumers MUST ignore what they do
not understand.

## 3. `manifest.json`

```json
{
  "formatVersion": 1,
  "id": "course-system-design-em-livro",
  "version": 1,
  "title": "System Design em Livro",
  "description": "78 lessons on system design fundamentals",
  "author": "Augusto Galego",
  "language": "pt-BR",
  "cover": "assets/cover.jpg",
  "modules": [
    {
      "id": "intro",
      "title": "01. Intro",
      "lessons": [
        {
          "id": "F01",
          "title": "O que é System Design",
          "content": "content/001-o-que-e-system-design.md"
        }
      ]
    }
  ]
}
```

Field rules:

| Field | Required | Meaning |
| --- | --- | --- |
| `formatVersion` | ✔ | Version of **this specification** the package targets. A consumer that does not support it must say so ("This course requires Study Format v2"). Current: `1`. |
| `id` | ✔ | Stable course identifier. Used to key user state outside the package. Slug-style (`^[a-z0-9][a-z0-9-]*$`), unique per course. |
| `version` | ✔ | Version **of the course content** (monotonic integer). Bump when content changes. User state is preserved across content versions. |
| `title` | ✔ | Display title. |
| `description` |  | One-line description. |
| `author` |  | Content author. |
| `language` |  | BCP-47 tag. |
| `cover` |  | Path (inside the archive) to a cover image. |
| `modules[]` | ✔ | Ordered modules. |
| `modules[].id` | ✔ | Unique within the course. |
| `modules[].title` | ✔ | Display title. |
| `modules[].lessons[]` | ✔ | Ordered lessons. |
| `lessons[].id` | ✔ | Unique within the course. Referenced by user state. |
| `lessons[].title` | ✔ | Display title. |
| `lessons[].content` | ✔ | Archive path to the lesson Markdown. |

Unknown top-level fields MUST be ignored (forward compatibility). The reserved
`extensions` object (see §7) is the sanctioned place for vendor data.

## 4. Lesson content (`content/*.md`)

Standard Markdown (CommonMark + GFM tables recommended). A lesson must remain
readable as plain Markdown in any editor — interactivity is expressed through
**block directives**, standalone paragraph-level tokens:

```
{{quiz:q-load-balancing-01}}
{{flashcard:card-001}}
{{image:assets/F01_k1.jpg}}
```

- `{{quiz:<id>}}` — render an interactive quiz question (from the quiz bank)
  at this point in the lesson.
- `{{flashcard:<id>}}` — render an inline flashcard.
- `{{image:<path>}}` — render an image from the archive.

Directives MUST occupy their own paragraph. Consumers render unknown
directives as inert text and MUST NOT fail.

## 5. Quiz bank (`questions/questions.json`)

A JSON object keyed by question id:

```json
{
  "F03-q1": {
    "type": "single-choice",
    "question": "Qual é o objetivo principal de um load balancer?",
    "code": "optional code context",
    "options": [
      { "id": "a", "text": "Distribuir tráfego" },
      { "id": "b", "text": "Armazenar dados" }
    ],
    "correct": ["a"],
    "explanation": "Load balancers distribuem requisições entre múltiplos servidores."
  }
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `type` | ✔ | `single-choice` or `multiple-choice`. |
| `question` | ✔ | Prompt text. |
| `code` |  | Optional code context (rendered monospaced). |
| `options[]` | ✔ | ≥2 options with stable `id` (unique per question) and `text`. |
| `correct` | ✔ | Correct option ids. Exactly 1 for `single-choice`; ≥1 for `multiple-choice` (all-or-nothing grading). |
| `explanation` |  | Shown after answering. |

## 6. Flashcards (`flashcards/flashcards.json`)

A JSON array:

```json
[
  {
    "id": "card-001",
    "front": "O que é horizontal scaling?",
    "back": "Adicionar mais máquinas ao sistema.",
    "tags": ["scaling", "system-design"]
  }
]
```

Ids are unique within the deck. Consumers typically schedule cards with a
spaced-repetition algorithm; the scheduling state belongs to the user, not to
this file.

## 7. Immutability and user state

**A `.study` package is immutable.** Consumers MUST NOT rewrite the archive —
progress, answers and scheduling live outside the package, keyed by course
`id` (and tolerant of `version` bumps):

```
<data-dir>/<course-id>/
  progress.json    { currentLesson, completedLessons[], ... }
  answers.json     { <question-id>: { selected[], correct, answeredAt } }
  reviews.json     { <card-id>: SRS scheduling state }
```

This makes the package trivially portable (send the file to anyone, any
device) and safe to update (download a new `version`, keep your progress).

## 8. Versioning

Two independent versions, by design:

- **`formatVersion`** — the spec revision. Breaking changes to structure or
  schemas bump this. Consumers reject packages they cannot parse with a clear
  message pointing to a runtime update.
- **`version`** — the course content revision. Bumped by the author on any
  content change. Question/card/lesson ids SHOULD remain stable across
  versions so user state survives.

Spec revision history:

| formatVersion | Date | Notes |
| --- | --- | --- |
| 1 | 2026-09-17 | Initial public specification. |

## 9. Extensions

Vendors MAY add domain metadata under `manifest.extensions.<vendor>`:

```json
{
  "extensions": {
    "example-lang": { "language": "zh-CN", "level": "HSK2", "tts": true }
  }
}
```

Consumers ignore vendors they do not understand; they MUST NOT strip unknown
extensions when re-packaging.

## 10. Minimum viable package

A valid `.study` file needs only:

```
manifest.json            (formatVersion, id, version, title, 1 module, 1 lesson)
content/001-intro.md     (any Markdown; zero directives)
```

Quiz bank, flashcard deck and assets are optional.

## 11. Validation

Machine-readable JSON Schemas ship alongside this spec:

- [`schemas/manifest.schema.json`](schemas/manifest.schema.json)
- [`schemas/questions.schema.json`](schemas/questions.schema.json)
- [`schemas/flashcards.schema.json`](schemas/flashcards.schema.json)

The TypeScript toolkit in `src/` validates and reads/writes packages
programmatically.
