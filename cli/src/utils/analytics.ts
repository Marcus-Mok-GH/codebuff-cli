/**
 * Analytics stub module.
 *
 * PostHog has been removed from the CLI to avoid runtime DB errors.
 * All exports remain for backwards compatibility but are no-ops.
 */

export enum AnalyticsErrorStage {
  Init = 'init',
  Track = 'track',
  Identify = 'identify',
  Flush = 'flush',
  CaptureException = 'captureException',
}

type AnalyticsErrorContext = {
  stage: AnalyticsErrorStage
} & Record<string, unknown>

type AnalyticsErrorLogger = (
  error: unknown,
  context: AnalyticsErrorContext,
) => void

/** Dependencies that can be injected for testing */
export interface AnalyticsDeps {
  env: {
  }
  isProd: boolean
  createClient: (apiKey: string, options: unknown) => unknown
  generateAnonymousId?: () => string
}

export let identified: boolean = false

let analyticsErrorLogger: AnalyticsErrorLogger | undefined

export function setAnalyticsErrorLogger(loggerFn: AnalyticsErrorLogger) {
  analyticsErrorLogger = loggerFn
}

/** Reset analytics state - for testing only */
export function resetAnalyticsState(_deps?: AnalyticsDeps) {
  identified = false
}

export function initAnalytics() {
  // No-op: PostHog removed from CLI
}

export async function flushAnalytics() {
  // No-op: PostHog removed from CLI
}

export function trackEvent(
  _event: string,
  _properties?: Record<string, any>,
) {
  // No-op: PostHog removed from CLI
}

export function identifyUser(_userId: string, _properties?: Record<string, any>) {
  identified = true
  // No-op: PostHog removed from CLI
}

export function logError(
  _error: any,
  _userId?: string,
  _properties?: Record<string, any>,
) {
  // No-op: PostHog removed from CLI
}
