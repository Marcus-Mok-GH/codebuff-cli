import { useEffect } from 'react'

import type { FreebuffSessionResponse } from '../types/freebuff-session'

let freebuffInstanceId = ''

export function useFreebuffSession(): { session: FreebuffSessionResponse | null } {
  return { session: null }
}

export function getFreebuffInstanceId(): string {
  return freebuffInstanceId
}

export function markFreebuffSessionEnded(): void {
  // no-op stub
}

export function markFreebuffSessionSuperseded(): void {
  // no-op stub
}

export async function refreshFreebuffSession(): Promise<void> {
  // no-op stub
}

export async function returnToFreebuffLanding(_opts?: { resetChat?: boolean }): Promise<void> {
  // no-op stub
}
