export type JsxBlockKind = "quiz" | "mermaid" | "callout";

export type JsxBlock = {
	kind: JsxBlockKind;
	raw: string;
	line: number;
};

export type ExtractedJsx = {
	markdown: string;
	blocks: JsxBlock[];
};

const OPENERS: Array<[JsxBlockKind, RegExp]> = [
	["quiz", /^<Quiz(?=[\s/>]|$)/],
	["mermaid", /^<Mermaid(?=[\s/>]|$)/],
	["callout", /^<Callout(?=[\s/>]|$)/],
];

export function extractJsxBlocks(mdx: string): ExtractedJsx {
	const lines = mdx.split("\n");
	const out: string[] = [];
	const blocks: JsxBlock[] = [];
	let i = 0;
	while (i < lines.length) {
		const line = lines[i];
		const opener = OPENERS.find(([, re]) => re.test(line));
		if (!opener) {
			out.push(line);
			i += 1;
			continue;
		}
		const [kind] = opener;
		const terminator =
			kind === "callout" ? /<\/Callout>\s*$/ : /\/>\s*$/;
		const raw: string[] = [line];
		let closed = terminator.test(line);
		let j = i + 1;
		while (!closed && j < lines.length) {
			raw.push(lines[j]);
			closed = terminator.test(lines[j]);
			j += 1;
		}
		blocks.push({ kind, raw: raw.join("\n"), line: i + 1 });
		out.push(`%%JSX:${blocks.length - 1}%%`);
		out.push("");
		i = j;
	}
	return { markdown: out.join("\n"), blocks };
}

export function balanceBraces(text: string, openIndex: number): number {
	let depth = 0;
	for (let i = openIndex; i < text.length; i += 1) {
		if (text[i] === "{") depth += 1;
		if (text[i] === "}") {
			depth -= 1;
			if (depth === 0) return i;
		}
	}
	return -1;
}
