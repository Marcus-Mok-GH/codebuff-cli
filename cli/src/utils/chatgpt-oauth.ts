import type { ChatGptOAuthCredentials } from '@codebuff/sdk'

export function startChatGptOAuthFlow(): { codeVerifier: string; authUrl: string } {
  return { codeVerifier: '', authUrl: '' }
}

export function stopChatGptOAuthServer(): void {
}

export function connectChatGptOAuth(): {
  authUrl: string
  credentials: Promise<ChatGptOAuthCredentials>
} {
  return {
    authUrl: '',
    credentials: Promise.resolve({
      accessToken: '',
      refreshToken: '',
      expiresAt: 0,
      connectedAt: 0,
    }),
  }
}

export async function exchangeChatGptCodeForTokens(
  _authCodeInput: string,
  _codeVerifier?: string,
): Promise<ChatGptOAuthCredentials> {
  return {
    accessToken: '',
    refreshToken: '',
    expiresAt: 0,
    connectedAt: 0,
  }
}

export function disconnectChatGptOAuth(): void {
}

export function getChatGptOAuthStatus(): {
  connected: boolean
  expiresAt?: number
  connectedAt?: number
} {
  return { connected: false }
}
