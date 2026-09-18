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
} as const

export type MessageKey = keyof typeof dictionary

export function t(key: MessageKey, params?: Record<string, string | number>) {
	let text: string = dictionary[key]
	for (const [name, value] of Object.entries(params ?? {})) {
		text = text.replaceAll(`{${name}}`, String(value))
	}
	return text
}
