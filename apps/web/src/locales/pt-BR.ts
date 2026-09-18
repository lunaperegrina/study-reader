export const dictionary = {
	"app.name": "study-reader",
	"app.tagline": "Seu material de estudo, virado curso, no seu e-reader.",
	"nav.library": "Meus cursos",
	"nav.settings": "Ajustes",
	"nav.logout": "Sair",
	"login.title": "Entrar",
	"login.email": "E-mail",
	"login.password": "Senha",
	"login.submit": "Entrar",
	"login.toRegister": "Não tem conta? Criar conta",
	"login.failed": "E-mail ou senha inválidos.",
	"register.title": "Criar conta",
	"register.name": "Nome",
	"register.email": "E-mail",
	"register.password": "Senha (mínimo 8 caracteres)",
	"register.submit": "Criar conta",
	"register.toLogin": "Já tem conta? Entrar",
	"register.failed": "Não foi possível criar a conta.",
	"landing.badge.format": "Formato aberto",
	"landing.badge.licenses": "MIT · CC0",
	"landing.badge.offline": "100% offline",
	"landing.hero.eyebrow": "study-reader · cursos no seu e-reader",
	"landing.hero.title": "Seu material de estudo, virado curso, no seu e-reader.",
	"landing.hero.sub":
		"Você manda a apostila, o PDF ou a anotação do caderno. A IA devolve um curso: lições, quizzes, flashcards. Baixa o .study, abre no Kindle e estuda. Na hora de revisar, quem manda é o SM-2, o mesmo algoritmo de repetição espaçada do Anki.",
	"landing.hero.ctaPrimary": "Criar conta",
	"landing.hero.ctaSecondary": "Entrar",
	"landing.hero.ctaSession": "Ir para meus cursos",
	"landing.hero.codeTitle": "meu-curso.study",
	"landing.hero.code": `meu-curso.study
├── manifest.json
├── content/
│   ├── 001-primeira-licao.md
│   ├── 002-segunda-licao.md
│   └── 003-exercicios.md
├── questions/
│   └── questions.json
├── flashcards/
│   └── flashcards.json
└── assets/
    └── diagrama.png`,
	"landing.stats.file.value": "1",
	"landing.stats.file.label": "arquivo portátil (.study)",
	"landing.stats.srs.value": "SM-2",
	"landing.stats.srs.label": "repetição espaçada",
	"landing.stats.offline.value": "100%",
	"landing.stats.offline.label": "offline no dispositivo",
	"landing.stats.open.value": "CC0",
	"landing.stats.open.label": "spec e toolkits abertos",
	"landing.what.eyebrow": "O que é",
	"landing.what.title": "O formato é o produto.",
	"landing.what.p1":
		"O study-reader gira em torno de um formato aberto de curso, o .study. Você cola o texto ou anexa um PDF, revisa a estrutura que a IA montou e gera as lições. O resultado é um pacote que você baixa e guarda. Ninguém mais precisa ver.",
	"landing.what.p2":
		"O pacote é imutável e funciona offline. No e-reader, o plugin do KOReader renderiza as lições e grava seu progresso em JSON no próprio dispositivo. A web só replica esse estado: o sync empurra os JSONs dos dois lados e, em conflito, vale o mais recente. Se a plataforma sumir amanhã, seus cursos continuam abrindo.",
	"landing.what.p3":
		"A spec é CC0 e os toolkits são MIT, então qualquer ferramenta pode ler e escrever .study: um exportador de Anki, um plugin de Obsidian, o que aparecer. Você não fica preso a esta plataforma.",
	"landing.how.eyebrow": "Como funciona",
	"landing.how.title": "Do material ao e-reader em quatro passos.",
	"landing.how.step1.title": "Envie seu material",
	"landing.how.step1.desc":
		"Cole o texto ou anexe .md, .txt ou PDF. O curso nasce privado: não há catálogo público nem compartilhamento.",
	"landing.how.step2.title": "A IA monta o curso",
	"landing.how.step2.desc":
		"Antes de gerar o conteúdo, você revisa módulos e lições e corta o que não prestar. Os quizzes e flashcards saem do próprio material. A IA roda com a sua chave de API ou numa instância sua.",
	"landing.how.step3.title": "Estude no e-reader",
	"landing.how.step3.desc":
		"Baixe o .study e abra no Kindle com o plugin do KOReader. E-ink não notifica nada: é você, o texto e uma bateria que dura semanas.",
	"landing.how.step4.title": "Revise e sincronize",
	"landing.how.step4.desc":
		"O SM-2 agenda a revisão: cada dia ele mostra os cartões na hora certa de vê-los de novo. O progresso sincroniza entre o dispositivo e a web.",
	"landing.format.eyebrow": "O formato",
	"landing.format.title": "Um zip com lições em Markdown e o resto do curso em JSON.",
	"landing.format.p1":
		"O manifest descreve o curso, cada lição é um Markdown, e o quiz e os flashcards moram em JSON. Sem banco, sem runtime: é um zip que qualquer ferramenta consegue ler e escrever.",
	"landing.format.code": `{
  "formatVersion": 1,
  "id": "direito-constitucional",
  "version": 1,
  "title": "Direito Constitucional",
  "language": "pt-BR",
  "modules": [
    {
      "id": "controle-de-constitucionalidade",
      "title": "Controle de constitucionalidade",
      "lessons": [
        {
          "id": "licao-01",
          "title": "Noções gerais",
          "content": "content/licao-01.md"
        }
      ]
    }
  ]
}`,
	"landing.features.eyebrow": "A plataforma",
	"landing.features.title": "O que já funciona hoje.",
	"landing.features.library.title": "Biblioteca privada",
	"landing.features.library.desc":
		"Você sobe um .study e ele entra na biblioteca. Não tem catálogo público nem feed: seu material é seu.",
	"landing.features.creator.title": "Criador com IA",
	"landing.features.creator.desc":
		"Do material bruto ao pacote pronto, com a estrutura aberta pra você mexer antes. Roda com a sua chave de API ou com uma instância hospedada por você.",
	"landing.features.webreader.title": "Leitor web",
	"landing.features.webreader.desc":
		"O mesmo curso do Kindle, aberto no navegador. Quiz e progresso contam pros dois lados.",
	"landing.features.srs.title": "Flashcards SM-2",
	"landing.features.srs.desc":
		"A versão web (TypeScript) e a do plugin (Lua) rodam o mesmo SM-2, conferidas pelos mesmos vetores de teste. O que você estudou aqui vale lá.",
	"landing.features.sync.title": "Sync Kindle ↔ web",
	"landing.features.sync.desc":
		"O Kindle pareia com um código, uma vez. Depois o estado mergeia sozinho, chave a chave; em conflito, vale o mais recente.",
	"landing.features.plugin.title": "Plugin KOReader",
	"landing.features.plugin.desc":
		"Lua puro pra KOReader: roda em Kindle, Kobo, PocketBook. Código aberto, deploy por SSH.",
	"landing.faq.eyebrow": "Perguntas comuns",
	"landing.faq.title": "Perguntas comuns.",
	"landing.faq.q1": "Preciso de um Kindle?",
	"landing.faq.a1":
		"Não. O leitor web cobre o ciclo todo, da leitura à revisão. Mas o produto foi desenhado pra e-ink: o plugin roda em qualquer dispositivo com KOReader, de Kindle a Kobo e PocketBook.",
	"landing.faq.q2": "Funciona offline?",
	"landing.faq.a2":
		"O pacote .study funciona 100% offline depois de criado. A web só replica estado; o plugin nunca depende dela.",
	"landing.faq.q3": "Meus cursos são privados?",
	"landing.faq.a3":
		"Sim. Curso gerado do seu material nasce privado. Não há catálogo público nem compartilhamento.",
	"landing.faq.q4": "Posso usar qualquer material?",
	"landing.faq.a4":
		"Sim. Apostila, PDF, anotação de caderno, o que você estiver tentando aprender. O conteúdo é seu; a IA só organiza.",
	"landing.faq.q5": "Quanto custa?",
	"landing.faq.a5":
		"O MVP é gratuito, sem cobrança. Formato e plugin são open source.",
	"landing.footer.tagline": "study-reader · cursos no seu e-reader",
	"landing.footer.github": "GitHub",
	"landing.footer.spec": "Spec do formato .study",
	"landing.footer.licenses": "pacotes MIT · spec CC0 · apps AGPL-3.0",
	"library.title": "Meus cursos",
	"library.empty": "Nenhum curso ainda.",
	"library.emptyHint":
		"Envie um arquivo .study ou crie um curso com IA a partir do seu material.",
	"library.upload": "Enviar .study",
	"library.uploading": "Enviando…",
	"library.uploadFailed": "Falha ao enviar o pacote: {reason}",
	"library.open": "Abrir",
	"library.download": "Baixar",
	"library.delete": "Excluir",
	"library.deleteConfirm": "Excluir este curso da sua biblioteca?",
	"library.modules": "{count} módulos",
	"library.lessons": "{count} lições",
	"library.sourceUpload": "enviado",
	"library.sourceAi": "gerado por IA",
	"library.createWithAi": "Criar curso com IA",
	"library.comingSoon": "Em breve",
	"course.back": "Voltar",
	"course.download": "Baixar .study",
	"course.description": "Descrição",
	"course.author": "Autor",
	"course.language": "Idioma",
	"course.version": "Versão",
	"settings.title": "Ajustes",
	"settings.devices": "Dispositivos",
	"settings.devicesHint":
		"Pareie seu Kindle: no menu do plugin studyreader, escolha “Configurar conta” e digite o código abaixo.",
	"settings.generateCode": "Gerar código de pareamento",
	"settings.codeExpires": "Expira em {time}",
	"settings.noDevices": "Nenhum dispositivo pareado.",
	"settings.deviceSince": "Pareado em {date}",
	"reader.loading": "Carregando…",
	"reader.loadFailed": "Não foi possível carregar o curso.",
	"reader.lessonNotFound": "Lição não encontrada.",
	"reader.showAnswer": "Mostrar resposta",
	"reader.answer": "Responder",
	"reader.correct": "Correto",
	"reader.incorrect": "Incorreto",
	"reader.gradeAgain": "Errei",
	"reader.gradeHard": "Difícil",
	"reader.gradeGood": "Bom",
	"reader.gradeEasy": "Fácil",
	"reader.completeLesson": "Concluir lição",
	"reader.lessonDone": "Lição concluída",
	"reader.reviewsTitle": "Revisões",
	"reader.reviewsDue": "Revisar ({count})",
	"reader.noReviews": "Nada para revisar",
	"reader.noReviewsHint": "Volte quando houver cartões vencidos.",
	"reader.reviewProgress": "{current} de {total}",
	"reader.reviewRecorded": "Revisão registrada",
	"create.title": "Criar curso com IA",
	"create.step1": "Etapa 1 de 3 — material",
	"create.step2": "Etapa 2 de 3 — estrutura",
	"create.step3": "Etapa 3 de 3 — geração",
	"create.step1Hint":
		"Cole o texto do seu material de estudo ou envie um arquivo (.md, .mdx, .txt ou .pdf). O curso é gerado a partir dele e fica privado na sua biblioteca.",
	"create.pasteLabel": "Cole aqui o texto do material…",
	"create.orFile": "Enviar arquivo",
	"create.next": "Gerar estrutura",
	"create.outlining": "Analisando o material…",
	"create.step2Hint": "Revise módulos e lições. Remova o que não quiser antes de gerar o conteúdo.",
	"create.moduleLabel": "Módulo {index}",
	"create.removeLesson": "Remover",
	"create.generateAll": "Gerar curso ({count} lições)",
	"create.backToInput": "← Voltar ao material",
	"create.backToOutline": "← Voltar à estrutura",
	"create.generatingLesson": "Escrevendo: {title}…",
	"create.assembling": "Montando o pacote .study…",
} as const

export type MessageKey = keyof typeof dictionary

export function t(key: MessageKey, params?: Record<string, string | number>) {
	let text: string = dictionary[key]
	for (const [name, value] of Object.entries(params ?? {})) {
		text = text.replaceAll(`{${name}}`, String(value))
	}
	return text
}
