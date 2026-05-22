import { describe, expect, test } from 'bun:test'

import {
  exchangeChatGptCodeForTokens,
  getChatGptOAuthStatus,
} from '../chatgpt-oauth'

describe('chatgpt-oauth utility (stubbed)', () => {
  test('exchangeChatGptCodeForTokens returns empty credentials', async () => {
    const result = await exchangeChatGptCodeForTokens('auth-code')
    expect(result).toEqual({
      accessToken: '',
      refreshToken: '',
      expiresAt: 0,
      connectedAt: 0,
    })
  })

  test('getChatGptOAuthStatus returns not connected', () => {
    expect(getChatGptOAuthStatus()).toEqual({ connected: false })
  })
})
