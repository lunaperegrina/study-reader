export const GRADES = ["again", "hard", "good", "easy"] as const
export type GradeName = (typeof GRADES)[number]

export type SrsCard = {
	reps: number
	lapses: number
	ef: number
	interval: number
	due: number
}

export type GradedCard = SrsCard & {
	gradedAt: string
}

const GRADE_TO_QUALITY: Record<GradeName, number> = {
	again: 2,
	hard: 3,
	good: 4,
	easy: 5,
}

export function epochNow(): number {
	return Math.floor(Date.now() / 1000)
}

export function isoFromEpoch(seconds: number): string {
	return new Date(seconds * 1000)
		.toISOString()
		.replace(/\.\d{3}Z$/, "Z")
}

export function newCard(now: number = epochNow()): SrsCard {
	return {
		reps: 0,
		lapses: 0,
		ef: 2.5,
		interval: 0,
		due: now,
	}
}

export function isDue(card: { due?: number }, now: number = epochNow()): boolean {
	return now >= (card.due ?? 0)
}

export function grade(
	card: SrsCard,
	gradeName: GradeName,
	now: number = epochNow(),
): GradedCard {
	const quality = GRADE_TO_QUALITY[gradeName] ?? 4

	if (quality < 3) {
		return {
			reps: 0,
			lapses: (card.lapses ?? 0) + 1,
			ef: card.ef,
			interval: 0,
			due: now + 600,
			gradedAt: isoFromEpoch(now),
		}
	}

	const reps = (card.reps ?? 0) + 1
	let interval: number
	if (reps === 1) {
		interval = 1
	} else if (reps === 2) {
		interval = 6
	} else {
		interval = Math.floor((card.interval ?? 6) * card.ef) + 1
	}

	const ef = card.ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))

	return {
		reps,
		lapses: card.lapses ?? 0,
		ef: Math.max(1.3, ef),
		interval,
		due: now + interval * 86400,
		gradedAt: isoFromEpoch(now),
	}
}
