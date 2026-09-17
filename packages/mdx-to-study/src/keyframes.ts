import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

export type KeyframeEntry = {
	t: number;
	stable_for: number;
	png: string;
};

export type KeyframeAsset = {
	assetPath: string;
	data: Buffer;
};

export function selectKeyframes(
	keyframes: KeyframeEntry[],
	count: number,
): KeyframeEntry[] {
	if (count <= 0 || keyframes.length === 0) return [];
	const sorted = [...keyframes].sort((a, b) => a.t - b.t);
	if (sorted.length <= count) return sorted;
	const first = sorted[0].t;
	const last = sorted[sorted.length - 1].t;
	const width = Math.max(last - first, 1);
	const buckets: KeyframeEntry[][] = Array.from({ length: count }, () => []);
	for (const entry of sorted) {
		const bucket = Math.min(
			Math.floor(((entry.t - first) / width) * count),
			count - 1,
		);
		buckets[bucket].push(entry);
	}
	return buckets.map((bucket) =>
		bucket.length === 0
			? sorted[Math.floor(sorted.length / 2)]
			: bucket.reduce((best, entry) =>
					entry.stable_for > best.stable_for ? entry : best,
				),
	);
}

export async function compressKeyframes(
	sourceRoot: string,
	fid: string,
	keyframes: KeyframeEntry[],
	count: number,
	maxWidth = 1200,
): Promise<KeyframeAsset[]> {
	const selected = selectKeyframes(keyframes, count);
	const assets: KeyframeAsset[] = [];
	for (const [index, entry] of selected.entries()) {
		const absolute = join(sourceRoot, entry.png);
		const data = await sharp(absolute)
			.resize({ width: maxWidth, withoutEnlargement: true })
			.jpeg({ quality: 72 })
			.toBuffer();
		assets.push({ assetPath: `assets/${fid}-k${index + 1}.jpg`, data });
	}
	return assets;
}

export async function loadKeyframes(
	sourceRoot: string,
	fid: string,
): Promise<KeyframeEntry[]> {
	const raw = await readFile(join(sourceRoot, ".work", fid, "keyframes.json"), "utf8");
	const parsed = JSON.parse(raw) as { keyframes?: KeyframeEntry[] };
	return parsed.keyframes ?? [];
}
