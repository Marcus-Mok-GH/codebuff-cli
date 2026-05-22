import { describe, expect, test, mock, afterEach } from 'bun:test'

import { CodebuffClient } from '../client'

describe('CodebuffClient', () => {
  const originalFetch = globalThis.fetch

  const setFetchMock = (mockFetch: ReturnType<typeof mock>) => {
    globalThis.fetch = mockFetch as unknown as typeof fetch
  }

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('checkConnection', () => {
    test('returns true when /api/models responds with an array', async () => {
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 'model-1', name: 'Model 1' }]),
        } as Response),
      )

      setFetchMock(mockFetch)

      const client = new CodebuffClient({ apiKey: 'test-key' })
      const result = await client.checkConnection()

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    test('returns false when response is not ok', async () => {
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve([{ id: 'model-1' }]),
        } as Response),
      )

      setFetchMock(mockFetch)

      const client = new CodebuffClient({ apiKey: 'test-key' })
      const result = await client.checkConnection()

      expect(result).toBe(false)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    test('returns false when /api/models responds with a non-array', async () => {
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'ok' }),
        } as Response),
      )

      setFetchMock(mockFetch)

      const client = new CodebuffClient({ apiKey: 'test-key' })
      const result = await client.checkConnection()

      expect(result).toBe(false)
    })

    test('returns false when response is not valid JSON', async () => {
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.reject(new Error('Invalid JSON')),
        } as Response),
      )

      setFetchMock(mockFetch)

      const client = new CodebuffClient({ apiKey: 'test-key' })
      const result = await client.checkConnection()

      expect(result).toBe(false)
    })

    test('returns false when fetch throws an error', async () => {
      const mockFetch = mock(() => Promise.reject(new Error('Network error')))

      setFetchMock(mockFetch)

      const client = new CodebuffClient({ apiKey: 'test-key' })
      const result = await client.checkConnection()

      expect(result).toBe(false)
    })

    test('returns false when response body is a string', async () => {
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve('not an array'),
        } as Response),
      )

      setFetchMock(mockFetch)

      const client = new CodebuffClient({ apiKey: 'test-key' })
      const result = await client.checkConnection()

      expect(result).toBe(false)
    })

    test('returns false when response body is null', async () => {
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(null),
        } as Response),
      )

      setFetchMock(mockFetch)

      const client = new CodebuffClient({ apiKey: 'test-key' })
      const result = await client.checkConnection()

      expect(result).toBe(false)
    })

    test('returns false when response body is an object with a message field', async () => {
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ message: 'healthy' }),
        } as Response),
      )

      setFetchMock(mockFetch)

      const client = new CodebuffClient({ apiKey: 'test-key' })
      const result = await client.checkConnection()

      expect(result).toBe(false)
    })
  })
})
