import type { FreebuffSessionResponse } from '../types/freebuff-session'

export interface FreebuffSessionProgress {
  fraction: number
  remainingMs: number
}

export function useFreebuffSessionProgress(
  _session: FreebuffSessionResponse | null,
): FreebuffSessionProgress | null {
  return null
}
