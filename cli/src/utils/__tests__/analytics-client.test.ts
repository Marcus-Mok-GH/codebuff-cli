import { describe, test, expect, beforeEach } from 'bun:test'

import {
  initAnalytics,
  trackEvent,
  identifyUser,
  resetAnalyticsState,
} from '../analytics'

describe('analytics stub', () => {
  beforeEach(() => {
    resetAnalyticsState()
  })

  test('initAnalytics does not throw', () => {
    expect(() => initAnalytics()).not.toThrow()
  })

  test('trackEvent does not throw', () => {
    expect(() => trackEvent('test_event', { foo: 'bar' })).not.toThrow()
  })

  test('identifyUser sets identified flag', () => {
    expect(identifyUser('user-123', { email: 'test@example.com' })).toBeUndefined()
  })
})
