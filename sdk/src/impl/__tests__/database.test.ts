import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test'

import {
  startAgentRun,
  finishAgentRun,
  addAgentStep,
} from '../database'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger() {
  return {
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
    info: mock(() => {}),
  }
}

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Captures the RequestInit options passed to the most recent fetch() call.
function capturedOptions(mockFetch: ReturnType<typeof mock>): RequestInit {
  const calls = mockFetch.mock.calls
  expect(calls.length).toBeGreaterThan(0)
  return calls[calls.length - 1][1] as RequestInit
}

// ---------------------------------------------------------------------------
// Setup / teardown — replace globalThis.fetch for each test
// ---------------------------------------------------------------------------

let originalFetch: typeof globalThis.fetch
let mockFetch: ReturnType<typeof mock>

beforeEach(() => {
  originalFetch = globalThis.fetch
  mockFetch = mock(() => Promise.resolve(makeJsonResponse({})))
  globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
  mock.restore()
})

// ---------------------------------------------------------------------------
// startAgentRun
// ---------------------------------------------------------------------------

describe('startAgentRun', () => {
  test('sends Content-Type: application/json header', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ runId: 'run-1' }))

    await startAgentRun({
      apiKey: 'test-key',
      agentId: 'publisher/agent',
      ancestorRunIds: [],
      logger: makeLogger(),
    })

    const opts = capturedOptions(mockFetch)
    expect((opts.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    )
  })

  test('uses POST method', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ runId: 'run-2' }))

    await startAgentRun({
      apiKey: 'test-key',
      agentId: 'publisher/agent',
      ancestorRunIds: [],
      logger: makeLogger(),
    })

    expect(capturedOptions(mockFetch).method).toBe('POST')
  })

  test('includes Authorization header when apiKey provided', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ runId: 'run-3' }))

    await startAgentRun({
      apiKey: 'my-secret-key',
      agentId: 'publisher/agent',
      ancestorRunIds: [],
      logger: makeLogger(),
    })

    const headers = capturedOptions(mockFetch).headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer my-secret-key')
  })

  test('omits Authorization header when apiKey is absent', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ runId: 'run-4' }))

    await startAgentRun({
      agentId: 'publisher/agent',
      ancestorRunIds: [],
      logger: makeLogger(),
    })

    const headers = capturedOptions(mockFetch).headers as Record<string, string>
    expect(headers['Authorization']).toBeUndefined()
  })

  test('sends correct JSON body with START action', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ runId: 'run-5' }))

    await startAgentRun({
      apiKey: 'test-key',
      agentId: 'publisher/my-agent',
      ancestorRunIds: ['ancestor-1', 'ancestor-2'],
      logger: makeLogger(),
    })

    const body = JSON.parse(capturedOptions(mockFetch).body as string)
    expect(body).toMatchObject({
      action: 'START',
      agentId: 'publisher/my-agent',
      ancestorRunIds: ['ancestor-1', 'ancestor-2'],
    })
  })

  test('returns runId from successful response', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ runId: 'returned-run-id' }))

    const result = await startAgentRun({
      apiKey: 'test-key',
      agentId: 'publisher/agent',
      ancestorRunIds: [],
      logger: makeLogger(),
    })

    expect(result).toBe('returned-run-id')
  })

  test('returns null when response is not ok', async () => {
    mockFetch.mockResolvedValue(new Response('bad request', { status: 400 }))

    const result = await startAgentRun({
      apiKey: 'test-key',
      agentId: 'publisher/agent',
      ancestorRunIds: [],
      logger: makeLogger(),
    })

    expect(result).toBeNull()
  })

  test('returns null when fetch throws a network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const result = await startAgentRun({
      apiKey: 'test-key',
      agentId: 'publisher/agent',
      ancestorRunIds: [],
      logger: makeLogger(),
    })

    expect(result).toBeNull()
  })

  test('returns null when response body has no runId', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ other: 'field' }))

    const result = await startAgentRun({
      apiKey: 'test-key',
      agentId: 'publisher/agent',
      ancestorRunIds: [],
      logger: makeLogger(),
    })

    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// finishAgentRun
// ---------------------------------------------------------------------------

describe('finishAgentRun', () => {
  const baseParams = {
    apiKey: 'test-key' as string | undefined,
    userId: 'user-1' as string | undefined,
    runId: 'run-abc',
    status: 'completed' as const,
    totalSteps: 5,
    directCredits: 10,
    totalCredits: 15,
  }

  test('sends Content-Type: application/json header', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({}))

    await finishAgentRun({ ...baseParams, logger: makeLogger() })

    const headers = capturedOptions(mockFetch).headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
  })

  test('uses POST method', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({}))

    await finishAgentRun({ ...baseParams, logger: makeLogger() })

    expect(capturedOptions(mockFetch).method).toBe('POST')
  })

  test('includes Authorization header when apiKey provided', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({}))

    await finishAgentRun({ ...baseParams, apiKey: 'secret', logger: makeLogger() })

    const headers = capturedOptions(mockFetch).headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer secret')
  })

  test('omits Authorization header when apiKey is absent', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({}))

    await finishAgentRun({ ...baseParams, apiKey: undefined, logger: makeLogger() })

    const headers = capturedOptions(mockFetch).headers as Record<string, string>
    expect(headers['Authorization']).toBeUndefined()
  })

  test('sends correct JSON body with FINISH action', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({}))

    await finishAgentRun({
      ...baseParams,
      runId: 'run-xyz',
      status: 'failed',
      totalSteps: 3,
      directCredits: 2,
      totalCredits: 4,
      logger: makeLogger(),
    })

    const body = JSON.parse(capturedOptions(mockFetch).body as string)
    expect(body).toMatchObject({
      action: 'FINISH',
      runId: 'run-xyz',
      status: 'failed',
      totalSteps: 3,
      directCredits: 2,
      totalCredits: 4,
    })
  })

  test('returns undefined (void) on success', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({}))

    const result = await finishAgentRun({ ...baseParams, logger: makeLogger() })

    expect(result).toBeUndefined()
  })

  test('returns undefined on non-ok response (does not throw)', async () => {
    mockFetch.mockResolvedValue(new Response('error', { status: 500 }))

    const result = await finishAgentRun({ ...baseParams, logger: makeLogger() })

    expect(result).toBeUndefined()
  })

  test('returns undefined when fetch throws a network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const result = await finishAgentRun({ ...baseParams, logger: makeLogger() })

    expect(result).toBeUndefined()
  })

  test('Content-Type header present alongside Authorization header', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({}))

    await finishAgentRun({ ...baseParams, apiKey: 'my-key', logger: makeLogger() })

    const headers = capturedOptions(mockFetch).headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['Authorization']).toBe('Bearer my-key')
  })
})

// ---------------------------------------------------------------------------
// addAgentStep
// ---------------------------------------------------------------------------

describe('addAgentStep', () => {
  const baseParams = {
    apiKey: 'test-key' as string | undefined,
    userId: 'user-1' as string | undefined,
    agentRunId: 'run-abc',
    stepNumber: 1,
    credits: 5,
    messageId: 'msg-1' as string | null,
    startTime: new Date('2024-01-01T00:00:00Z'),
  }

  test('sends Content-Type: application/json header', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ stepId: 'step-1' }))

    await addAgentStep({ ...baseParams, logger: makeLogger() })

    const headers = capturedOptions(mockFetch).headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
  })

  test('uses POST method', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ stepId: 'step-2' }))

    await addAgentStep({ ...baseParams, logger: makeLogger() })

    expect(capturedOptions(mockFetch).method).toBe('POST')
  })

  test('includes Authorization header when apiKey provided', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ stepId: 'step-3' }))

    await addAgentStep({ ...baseParams, apiKey: 'my-key', logger: makeLogger() })

    const headers = capturedOptions(mockFetch).headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer my-key')
  })

  test('omits Authorization header when apiKey is absent', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ stepId: 'step-4' }))

    await addAgentStep({ ...baseParams, apiKey: undefined, logger: makeLogger() })

    const headers = capturedOptions(mockFetch).headers as Record<string, string>
    expect(headers['Authorization']).toBeUndefined()
  })

  test('sends correct JSON body with step fields', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ stepId: 'step-5' }))

    const startTime = new Date('2024-06-15T10:00:00Z')
    await addAgentStep({
      ...baseParams,
      stepNumber: 3,
      credits: 7,
      childRunIds: ['child-1'],
      messageId: 'msg-99',
      status: 'completed',
      startTime,
      logger: makeLogger(),
    })

    const body = JSON.parse(capturedOptions(mockFetch).body as string)
    expect(body).toMatchObject({
      stepNumber: 3,
      credits: 7,
      childRunIds: ['child-1'],
      messageId: 'msg-99',
      status: 'completed',
    })
  })

  test('uses completed as default status', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ stepId: 'step-6' }))

    await addAgentStep({ ...baseParams, logger: makeLogger() })

    const body = JSON.parse(capturedOptions(mockFetch).body as string)
    expect(body.status).toBe('completed')
  })

  test('returns stepId from successful response', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ stepId: 'returned-step-id' }))

    const result = await addAgentStep({ ...baseParams, logger: makeLogger() })

    expect(result).toBe('returned-step-id')
  })

  test('returns null when response is not ok', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: 'bad' }), { status: 400 }),
    )

    const result = await addAgentStep({ ...baseParams, logger: makeLogger() })

    expect(result).toBeNull()
  })

  test('returns null when fetch throws a network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const result = await addAgentStep({ ...baseParams, logger: makeLogger() })

    expect(result).toBeNull()
  })

  test('returns null when response body has no stepId', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ other: 'data' }))

    const result = await addAgentStep({ ...baseParams, logger: makeLogger() })

    expect(result).toBeNull()
  })

  test('Content-Type header present alongside Authorization header', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ stepId: 'step-x' }))

    await addAgentStep({ ...baseParams, apiKey: 'key-xyz', logger: makeLogger() })

    const headers = capturedOptions(mockFetch).headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['Authorization']).toBe('Bearer key-xyz')
  })

  test('posts to correct URL including agentRunId', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ stepId: 'step-y' }))

    await addAgentStep({ ...baseParams, agentRunId: 'run-999', logger: makeLogger() })

    const url = String(mockFetch.mock.calls[0][0])
    expect(url).toContain('/api/v1/agent-runs/run-999/steps')
  })
})
