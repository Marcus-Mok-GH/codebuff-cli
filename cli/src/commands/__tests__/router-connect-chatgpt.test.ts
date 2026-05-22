import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { useChatStore } from '../../state/chat-store'

import type { RouterParams } from '../command-registry'

const saveToHistory = mock(() => {})
const setInputValue = mock(() => {})
const setMessages = mock(() => {})

describe('routeUserPrompt connect:chatgpt mode (stubbed)', () => {
  beforeEach(() => {
    useChatStore.getState().reset()
    useChatStore.getState().setInputMode('connect:chatgpt')
    saveToHistory.mockClear()
    setInputValue.mockClear()
    setMessages.mockClear()
  })

  afterEach(() => {
    useChatStore.getState().reset()
  })

  test('when in connect:chatgpt mode, input mode is reset to default', async () => {
    const { routeUserPrompt } = await import('../router')

    const params = {
      abortControllerRef: { current: null },
      agentMode: 'DEFAULT',
      inputRef: { current: null },
      inputValue: '',
      isChainInProgressRef: { current: false },
      isStreaming: false,
      logoutMutation: {} as RouterParams['logoutMutation'],
      streamMessageIdRef: { current: null },
      addToQueue: () => {},
      clearMessages: () => {},
      saveToHistory,
      scrollToLatest: () => {},
      sendMessage: async () => {},
      setCanProcessQueue: () => {},
      setInputFocused: () => {},
      setInputValue,
      setIsAuthenticated: () => {},
      setMessages,
      setUser: () => {},
      stopStreaming: () => {},
    } satisfies RouterParams

    await routeUserPrompt(params)

    expect(useChatStore.getState().inputMode).toBe('default')
  })
})
