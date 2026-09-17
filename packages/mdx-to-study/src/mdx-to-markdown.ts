import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkStringify from "remark-stringify";
import { parse as parseYaml } from "yaml";
import type { Blockquote, Paragraph, Root } from "mdast";
import { extractJsxBlocks } from "./extract-jsx.ts";
import { parseCallout, parseQuiz } from "./jsx-blocks.ts";

export type LessonFrontmatter = {
	title?: string;
	description?: string;
};

export type MarkdownOptions = {
	quizIds: string[];
	keyframeQueue: string[];
};

type Children = Root["children"];

function textParagraph(value: string): Paragraph {
	return { type: "paragraph", children: [{ type: "text", value }] };
}

function calloutBlockquote(type: "info" | "warning", text: string): Blockquote {
	const prefix = type === "warning" ? "⚠️ " : "ℹ️ ";
	return {
		type: "blockquote",
		children: [textParagraph(prefix + text)],
	};
}

function sectionEnd(children: Children, headingIndex: number) {
	for (let i = headingIndex + 1; i < children.length; i += 1) {
		const node = children[i];
		if (node.type === "heading" && node.depth <= 2) return i;
	}
	return children.length;
}

function insertLeftoverKeyframes(
	children: Children,
	h2Indices: number[],
	leftovers: string[],
) {
	if (leftovers.length === 0 || h2Indices.length === 0) return;
	const insertions = leftovers.map((asset, order) => {
		const bucket = Math.min(
			Math.floor(((order + 1) * h2Indices.length) / (leftovers.length + 1)),
			h2Indices.length - 1,
		);
		const index = sectionEnd(children, h2Indices[bucket]);
		return { index, order, node: textParagraph(`{{image:${asset}}}`) };
	});
	insertions
		.sort((a, b) => b.index - a.index || b.order - a.order)
		.forEach((insertion) => children.splice(insertion.index, 0, insertion.node));
}

function transform(
	children: Children,
	blocks: ReturnType<typeof extractJsxBlocks>["blocks"],
	options: MarkdownOptions,
) {
	const result: Children = [];
	const h2Indices: number[] = [];
	let quizCursor = 0;
	let keyframeCursor = 0;

	for (const node of children) {
		if (node.type === "yaml") continue;

		if (node.type === "paragraph") {
			const first = node.children[0];
			const text = first && "value" in first ? String(first.value) : "";
			const match = /^%%JSX:(\d+)%%$/.exec(text.trim());
			if (match) {
				const block = blocks[Number(match[1])];
				if (block.kind === "quiz") {
					for (const _ of parseQuiz(block)) {
						const id = options.quizIds[quizCursor];
						quizCursor += 1;
						if (!id) {
							throw new Error(`missing quiz id at cursor ${quizCursor - 1}`);
						}
						result.push(textParagraph(`{{quiz:${id}}}`));
					}
					continue;
				}
				if (block.kind === "mermaid") {
					const asset = options.keyframeQueue[keyframeCursor];
					keyframeCursor += 1;
					if (asset) result.push(textParagraph(`{{image:${asset}}}`));
					continue;
				}
				if (block.kind === "callout") {
					const callout = parseCallout(block);
					result.push(calloutBlockquote(callout.type, callout.text));
					continue;
				}
			}
		}

		if (node.type === "heading" && node.depth === 2) {
			h2Indices.push(result.length);
		}

		result.push(node);
	}

	insertLeftoverKeyframes(
		result,
		h2Indices,
		options.keyframeQueue.slice(keyframeCursor),
	);
	return result;
}

export function mdxToMarkdown(mdx: string, options: MarkdownOptions) {
	const { markdown, blocks } = extractJsxBlocks(mdx);
	const parser = unified()
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkFrontmatter, ["yaml"]);
	const tree = parser.parse(markdown);

	let frontmatter: LessonFrontmatter = {};
	const yamlNode = tree.children.find((node) => node.type === "yaml");
	if (yamlNode && "value" in yamlNode) {
		frontmatter = parseYaml(String(yamlNode.value)) ?? {};
	}

	tree.children = transform(tree.children, blocks, options);

	const serializer = unified().use(remarkStringify).use(remarkGfm);
	const output = serializer.stringify(tree);
	return { markdown: `${String(output).trim()}\n`, frontmatter };
}
