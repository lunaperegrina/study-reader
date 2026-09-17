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
- Sem LICENSE ainda (decisão pendente do mantenedor).

## Pacotes

| Pacote | Papel |
| --- | --- |
| `packages/study-format` | Spec `.study` + JSON Schemas + toolkit TS (zod + fflate) |
| `packages/mdx-to-study` | Converter conteúdo de curso (MDX) → pacote `.study` |
| `packages/koreader-plugin` | Plugin Lua `studyreader.koplugin` para KOReader + deploy SSH |

## koreader-plugin (Lua)

- Código Lua em `packages/koreader-plugin/plugin/studyreader.koplugin/`.
- Alvo: KOReader estável (APIs `WidgetContainer`, `addToMainMenu`, `UIManager`, `ReaderUI:showReader`, `require("json")`).
- O pacote `.study` é **imutável**: o plugin nunca escreve nele. Estado do usuário em `<koreader-data>/studyreader/data/<course-id>/{progress,answers,reviews}.json`.
- Deploy/teste real é no dispositivo (Kindle via SSH) — `pnpm plugin:deploy`. Não há CI de Lua no M1.

## Contexto de produto

- O `.study` é o produto central: formato aberto, conteúdo portátil, ferramentas de terceiros podem gerar/consumir (Anki → .study, Obsidian → .study etc.).
- IA/plataforma web/cloud criam `.study`, mas o pacote funciona 100% offline depois de criado.
- Poligloteca é um produto separado — nenhum código compartilhado, no máximo interoperabilidade via formato no futuro.
- Plataforma (web/api/cloud) está fora do escopo do M1: primeiro formato + plugin validados no Kindle.
