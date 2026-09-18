# AGENTS.md

Convenções do monorepo study-reader. Estrutura no padrão smartmil-monorepo / poligloteca.

## Regras gerais

- Workspace pnpm (`pnpm-workspace.yaml`): `apps/*` + `packages/*`. Sem turbo/nx — orquestração via scripts raiz `pnpm --filter` (`<pkg>:<ação>`).
- Pacotes scoped `@study-reader/<kebab>`, diretório sem o scope. Todo `package.json`: `private: true`, `version: "0.1.0"`, `"type": "module"`.
- Dependências entre pacotes sempre `"workspace:*"`.
- Pacotes de domínio são source-only: `"exports": { ".": "./src/index.ts" }`, sem build step. Testes com Vitest.
- Sem config raiz de lint/tsconfig — cada pacote tem o seu `tsconfig.json` strict e roda `check` (`tsc --noEmit`).
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, com scope `feat(koreader-plugin):`). Sem hooks/commitlint — é convenção.
- Zero comentários explicativos no código — o código se explica. Comentários só para restrições que o código não expressa.
- Docs de produto/repo em inglês; docs de processo e conversas com o time em português.
- Licenças (definido 2026-09-18): pacotes (`packages/*`) MIT; texto da spec `.study` CC0; apps da plataforma (`apps/*`) AGPL-3.0. Cada pacote/app tem seu `LICENSE`.

## Pacotes

| Pacote | Papel |
| --- | --- |
| `packages/study-format` | Spec `.study` + JSON Schemas + toolkit TS (zod + fflate) |
| `packages/mdx-to-study` | Converter conteúdo de curso (MDX) → pacote `.study` |
| `packages/koreader-plugin` | Plugin Lua `studyreader.koplugin` para KOReader + deploy SSH |
| `packages/contracts` | DTOs zod compartilhados api/web (sync, outline, cursos) |
| `packages/srs` | SM-2 em TS — port exato do `srs.lua`, com vetores de conformance compartilhados |

## Plataforma (apps)

- `apps/api` (`@study-reader/api`): Bun + Elysia (prefixo `/api`, rotas em `/api/v1`), padrão Controller + Service + model por domínio em `src/routes/<dominio>/`, envelope de erro `{error, code, details}` via `AppError`, better-auth montado em `/api/auth/*`, Drizzle (node-postgres) com schemas em `src/db/schema/` re-exportados por `schema-exported.ts` e migrations commitadas (`drizzle-kit generate`, nunca push). Postgres local: `docker compose up -d` (porta host 5434).
- `apps/web` (`@study-reader/web`): Vite SPA + React 19 + TanStack Router (file-based) + TanStack Query. Componentes são **epaper-components** (`e-*`, Web Components, MIT; wrappers React em `src/components/ink.tsx`) + Tailwind v4 apenas para layout — sem shadcn/radix. Estética papel/e-ink: tokens `--ink-*`, sem sombra, gradiente ou animação.
- UI e mensagens de erro em pt-BR; strings da web em `apps/web/src/locales/pt-BR.ts` (chave flat + `t()`), prontas para novos idiomas.
- Env por app via `.env.example` copiado para `.env` (api lê com Bun; web usa prefixo `VITE_`). Deploy: Railway, Dockerfiles no padrão da casa (api `bun build --compile` → distroless; web build Vite → Caddy).

## koreader-plugin (Lua)

- Código Lua em `packages/koreader-plugin/plugin/studyreader.koplugin/`.
- Alvo: KOReader estável (APIs `WidgetContainer`, `addToMainMenu`, `UIManager`, `ReaderUI:showReader`, `require("json")`).
- O pacote `.study` é **imutável**: o plugin nunca escreve nele. Estado do usuário em `<koreader-data>/studyreader/data/<course-id>/{progress,answers,reviews}.json`.
- Deploy no dispositivo: `pnpm plugin:deploy`. Não há CI de Lua no M1.
- Ver e operar o dispositivo remotamente (screenshot do e-ink, taps/swipes, relançar KOReader com arquivo, crash.log): `pnpm plugin:remote` — loop completo em `packages/koreader-plugin/docs/DEVELOPING.md`. Em debug/validação de UI, usar isso em vez de pedir foto do aparelho ao usuário.

## Contexto de produto

- O `.study` é o produto central: formato aberto, conteúdo portátil, ferramentas de terceiros podem gerar/consumir (Anki → .study, Obsidian → .study etc.).
- Plataforma web (M9+): login + biblioteca privada (upload livre de `.study`), web reader, criador de curso com IA (BYOK/self-host e instância hospedada) e sync de progresso web ↔ Kindle. Sem billing no MVP; cursos gerados de material do próprio usuário são privados por padrão (não há catálogo público nem compartilhamento).
- O pacote funciona 100% offline depois de criado; a plataforma replica estado (JSONs por curso, merge per-key LWW), nunca vira dependência do plugin.
- Poligloteca é um produto separado — nenhum código compartilhado, no máximo interoperabilidade via formato no futuro.
- `examples/` só pode conter conteúdo próprio (apenas `tiny-course.study` é trackeado; os demais `.study` de teste ficam locais, ignorados pelo git).
