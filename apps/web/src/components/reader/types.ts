import type { SyncState } from "@study-reader/contracts"

export type ApplyState = (mutate: (draft: SyncState) => SyncState) => void
