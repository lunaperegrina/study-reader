export type RateLimitOptions = {
	windowSeconds: number
	max: number
}

export type RateLimitDecision = {
	allowed: boolean
	retryAfterSeconds: number
}

export function createRateLimiter(options: RateLimitOptions) {
	const buckets = new Map<string, { count: number; resetAt: number }>()

	function prune(now: number) {
		if (buckets.size < 10_000) return
		for (const [key, bucket] of buckets) {
			if (bucket.resetAt <= now) buckets.delete(key)
		}
	}

	return {
		check(key: string): RateLimitDecision {
			const now = Date.now()
			prune(now)

			const bucket = buckets.get(key)
			if (!bucket || bucket.resetAt <= now) {
				buckets.set(key, {
					count: 1,
					resetAt: now + options.windowSeconds * 1000,
				})
				return { allowed: true, retryAfterSeconds: 0 }
			}

			bucket.count += 1
			if (bucket.count > options.max) {
				return {
					allowed: false,
					retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
				}
			}
			return { allowed: true, retryAfterSeconds: 0 }
		},
	}
}
