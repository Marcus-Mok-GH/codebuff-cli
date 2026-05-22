/**
 * Shared analytics core module (no-op stub).
 * PostHog has been removed. This module preserves the interface
 * so dependent code can still import and compile.
 */

/** Interface for analytics client methods used for event capture */
export interface AnalyticsClient {
  capture: (params: {
    distinctId: string
    event: string
    properties?: Record<string, any>
  }) => void
  flush: () => Promise<void>
}

/** Extended client interface with identify, alias, and exception capture */
export interface AnalyticsClientWithIdentify extends AnalyticsClient {
  identify: (params: {
    distinctId: string
    properties?: Record<string, any>
  }) => void
  alias: (data: { distinctId: string; alias: string }) => void
  captureException: (
    error: any,
    distinctId: string,
    properties?: Record<string, any>,
  ) => void
}

/** Environment name type */
export type AnalyticsEnvName = 'dev' | 'test' | 'prod'

/** Base analytics configuration */
export interface AnalyticsConfig {
  envName: AnalyticsEnvName
  posthogApiKey: string
  posthogHostUrl: string
}

/** Options for creating a PostHog client */
export interface PostHogClientOptions {
  host: string
  flushAt?: number
  flushInterval?: number
  enableExceptionAutocapture?: boolean
}

/**
 * No-op PostHog client factory.
 * Returns a mock object that does nothing.
 */
export function createPostHogClient(
  _apiKey: string,
  _options: PostHogClientOptions,
): AnalyticsClientWithIdentify {
  return {
    capture: () => {},
    flush: async () => {},
    identify: () => {},
    alias: () => {},
    captureException: () => {},
  }
}

/**
 * Generates a unique anonymous ID for pre-login tracking.
 */
export function generateAnonymousId(): string {
  return `anon_${crypto.randomUUID()}`
}
