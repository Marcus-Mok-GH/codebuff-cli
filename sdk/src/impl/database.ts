import { validateSingleAgent } from '@codebuff/common/templates/agent-validation'
import { DynamicAgentTemplateSchema } from '@codebuff/common/types/dynamic-agent-template'
import { getErrorObject } from '@codebuff/common/util/error'
import z from 'zod/v4'

import { WEBSITE_URL } from '../constants'
import {
  createAuthError,
  createNetworkError,
  createServerError,
  createHttpError,
  isRetryableStatusCode,
} from '../error-utils'
import {
  MAX_RETRIES_PER_MESSAGE,
  RETRY_BACKOFF_BASE_DELAY_MS,
  RETRY_BACKOFF_MAX_DELAY_MS,
} from '../retry-config'

import type {
  AddAgentStepFn,
  FetchAgentFromDatabaseFn,
  FinishAgentRunFn,
  GetUserInfoFromApiKeyInput,
  GetUserInfoFromApiKeyOutput,
  StartAgentRunFn,
  UserColumn,
} from '@codebuff/common/types/contracts/database'
import type { DynamicAgentTemplate } from '@codebuff/common/types/dynamic-agent-template'
import type { ParamsOf } from '@codebuff/common/types/function-params'

type CachedUserInfo = Partial<
  NonNullable<Awaited<GetUserInfoFromApiKeyOutput<UserColumn>>>
>

const userInfoCache: Record<
  string,
  CachedUserInfo | null
> = {}

const agentsResponseSchema = z.object({
  version: z.string(),
  data: DynamicAgentTemplateSchema,
})

/**
 * Perform an HTTP fetch with exponential backoff retries for retryable HTTP statuses and network errors.
 *
 * @param url - The request URL (string or URL) to fetch.
 * @param options - Fetch options such as method, headers, and body.
 * @param logger - Optional logger used to emit retry warnings; expected to implement `warn(obj, msg)`.
 * @returns The final `Response` from `fetch` (either a successful response or the last received response when retries are exhausted).
 * @throws An `Error` when all attempts fail due to network/transport errors and no response could be obtained.
 */
async function fetchWithRetry(
  url: URL | string,
  options: RequestInit,
  logger?: { warn: (obj: object, msg: string) => void },
): Promise<Response> {
  let lastError: Error | null = null
  let backoffDelay = RETRY_BACKOFF_BASE_DELAY_MS

  for (let attempt = 0; attempt <= MAX_RETRIES_PER_MESSAGE; attempt++) {
    try {
      const response = await fetch(url, options)

      if (response.ok || !isRetryableStatusCode(response.status)) {
        return response
      }

      if (attempt < MAX_RETRIES_PER_MESSAGE) {
        logger?.warn(
          { status: response.status, attempt: attempt + 1, url: String(url) },
          `Retryable HTTP error, retrying in ${backoffDelay}ms`,
        )
        await new Promise((resolve) => setTimeout(resolve, backoffDelay))
        backoffDelay = Math.min(backoffDelay * 2, RETRY_BACKOFF_MAX_DELAY_MS)
      } else {
        return response
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < MAX_RETRIES_PER_MESSAGE) {
        logger?.warn(
          { error: getErrorObject(lastError), attempt: attempt + 1, url: String(url) },
          `Network error, retrying in ${backoffDelay}ms`,
        )
        await new Promise((resolve) => setTimeout(resolve, backoffDelay))
        backoffDelay = Math.min(backoffDelay * 2, RETRY_BACKOFF_MAX_DELAY_MS)
      }
    }
  }

  throw lastError ?? new Error('Request failed after retries')
}

/**
 * Fetches and returns the requested user fields for the provided API key, using an in-memory cache and fetching only missing fields.
 *
 * The function updates the cache with any fields returned by the remote `/api/v1/me` endpoint.
 *
 * @param apiKey - The API key used for Bearer authentication for the request.
 * @param fields - Array of user field names to retrieve; result will contain exactly these keys.
 * @returns An object mapping each requested field name to its value.
 * @throws Authentication error when the API key is known to be invalid or authentication fails (HTTP 401/403/404).
 * @throws Network error when the request cannot be made due to network/transport failures.
 * @throws Server error for 5xx responses from the server.
 * @throws HTTP error for other non-successful responses or when the response does not contain the requested fields.
 */
export async function getUserInfoFromApiKey<T extends UserColumn>(
  params: GetUserInfoFromApiKeyInput<T>,
): GetUserInfoFromApiKeyOutput<T> {
  const { apiKey, fields, logger } = params

  const cached = userInfoCache[apiKey ?? '']
  if (cached === null) {
    throw createAuthError()
  }
  if (
    cached &&
    fields.every((field) =>
      Object.prototype.hasOwnProperty.call(cached, field),
    )
  ) {
    return Object.fromEntries(fields.map((field) => [field, cached[field]])) as {
      [K in T]: CachedUserInfo[K]
    } as Awaited<GetUserInfoFromApiKeyOutput<T>>
  }

  const fieldsToFetch = cached
    ? fields.filter(
        (field) => !Object.prototype.hasOwnProperty.call(cached, field),
      )
    : fields

  const urlParams = new URLSearchParams({
    fields: fieldsToFetch.join(','),
  })
  const url = new URL(`/api/v1/me?${urlParams}`, WEBSITE_URL)

  let response: Response
  try {
    response = await fetchWithRetry(
      url,
      {
        method: 'GET',
        headers: {
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
      },
      logger,
    )
  } catch (error) {
    logger.error(
      { error: getErrorObject(error), apiKey, fields },
      'getUserInfoFromApiKey network error',
    )
    throw createNetworkError('Network request failed')
  }

  if (response.status === 401 || response.status === 403 || response.status === 404) {
    logger.error(
      { apiKey, fields, status: response.status },
      'getUserInfoFromApiKey authentication failed',
    )
    delete userInfoCache[apiKey ?? '']
    const normalizedStatus = response.status === 404 ? 401 : response.status
    throw createHttpError('Authentication failed', normalizedStatus)
  }

  if (response.status >= 500 && response.status <= 599) {
    logger.error(
      { apiKey, fields, status: response.status },
      'getUserInfoFromApiKey server error',
    )
    throw createServerError('Server error', response.status)
  }

  if (!response.ok) {
    logger.error(
      { apiKey, fields, status: response.status },
      'getUserInfoFromApiKey request failed',
    )
    throw createHttpError('Request failed', response.status)
  }

  const cachedBeforeMerge = userInfoCache[apiKey ?? '']
  try {
    const responseBody = await response.json()
    const fetchedFields = responseBody as CachedUserInfo
    userInfoCache[apiKey ?? ''] = {
      ...(cachedBeforeMerge ?? {}),
      ...fetchedFields,
    }
  } catch (error) {
    logger.error(
      { error: getErrorObject(error), apiKey, fields },
      'getUserInfoFromApiKey JSON parse error',
    )
    throw createHttpError('Failed to parse response', response.status)
  }

  const userInfo = userInfoCache[apiKey ?? '']
  if (userInfo === null) {
    throw createAuthError()
  }
  if (
    !userInfo ||
    !fields.every((field) =>
      Object.prototype.hasOwnProperty.call(userInfo, field),
    )
  ) {
    logger.error(
      { apiKey, fields },
      'getUserInfoFromApiKey: response missing required fields',
    )
    throw createHttpError('Request failed', response.status)
  }
  return Object.fromEntries(
    fields.map((field) => [field, userInfo[field]]),
  ) as Awaited<GetUserInfoFromApiKeyOutput<T>>
}

/**
 * Fetches an agent template from the remote agents endpoint and returns it after validation.
 *
 * @param params - An object containing request parameters:
 *   - `apiKey` (optional): Bearer token to include in the request.
 *   - `parsedAgentId`: Object with `publisherId`, `agentId`, and optional `version` used to build the request path.
 *   - `logger`: Logger used for diagnostic messages.
 * @returns A validated agent template whose `id` is set to `"{publisherId}/{agentId}@{version}"` on success, or `null` if the fetch, parsing, or validation fails.
 */
export async function fetchAgentFromDatabase(
  params: ParamsOf<FetchAgentFromDatabaseFn>,
): ReturnType<FetchAgentFromDatabaseFn> {
  const { apiKey, parsedAgentId, logger } = params
  const { publisherId, agentId, version } = parsedAgentId

  const url = new URL(
    `/api/v1/agents/${publisherId}/${agentId}/${version ? version : 'latest'}`,
    WEBSITE_URL,
  )

  try {
    const response = await fetchWithRetry(
      url,
      {
        method: 'GET',
        headers: {
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
      },
      logger,
    )

    if (!response.ok) {
      logger.error({ response }, 'fetchAgentFromDatabase request failed')
      return null
    }

    const responseJson = await response.json()
    const parseResult = agentsResponseSchema.safeParse(responseJson)
    if (!parseResult.success) {
      logger.error(
        { responseJson, parseResult },
        `fetchAgentFromDatabase parse error`,
      )
      return null
    }

    const agentConfig = parseResult.data
    const rawAgentData = agentConfig.data as DynamicAgentTemplate

    const validationResult = validateSingleAgent({
      template: { ...rawAgentData, id: agentId, version: agentConfig.version },
      filePath: `${publisherId}/${agentId}@${agentConfig.version}`,
    })

    if (!validationResult.success) {
      logger.error(
        {
          publisherId,
          agentId,
          version: agentConfig.version,
          error: validationResult.error,
        },
        'fetchAgentFromDatabase: Agent validation failed',
      )
      return null
    }

    const agentTemplate = {
      ...validationResult.agentTemplate!,
      id: `${publisherId}/${agentId}@${agentConfig.version}`,
    }

    logger.debug(
      {
        publisherId,
        agentId,
        version: agentConfig.version,
        fullAgentId: agentTemplate.id,
        parsedAgentId,
      },
      'fetchAgentFromDatabase: Successfully loaded and validated agent from database',
    )

    return agentTemplate
  } catch (error) {
    logger.error(
      { error: getErrorObject(error), parsedAgentId },
      'fetchAgentFromDatabase error',
    )
    return null
  }
}

/**
 * Initiates a new agent run on the server.
 *
 * @param params - Function parameters including authentication and run context:
 *   - `apiKey` (optional): API key to include as a Bearer token.
 *   - `agentId`: The identifier of the agent to start.
 *   - `ancestorRunIds` (optional): Array of ancestor run IDs to link the new run to.
 *   - `logger`: Logger for recording errors and diagnostics.
 * @returns The created run's `runId` string if present, `null` on any failure.
 */
export async function startAgentRun(
  params: ParamsOf<StartAgentRunFn>,
): ReturnType<StartAgentRunFn> {
  const { apiKey, agentId, ancestorRunIds, logger } = params

  const url = new URL(`/api/v1/agent-runs`, WEBSITE_URL)

  try {
    const body = JSON.stringify({
      action: 'START',
      agentId,
      ancestorRunIds,
    })

    const response = await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body,
      },
      logger,
    )

    if (!response.ok) {
      const responseText = await response.text()
      logger.error({ response, responseText }, 'startAgentRun request failed')
      return null
    }

    const responseBody = await response.json()
    if (!responseBody?.runId) {
      logger.error(
        { responseBody },
        'no runId found from startAgentRun request',
      )
    }
    return responseBody?.runId ?? null
  } catch (error) {
    logger.error(
      { error: getErrorObject(error), agentId },
      'startAgentRun error',
    )
    return null
  }
}

/**
 * Finalizes an agent run by sending a `FINISH` action to the agent-runs API.
 *
 * Sends `runId`, final `status`, and optional summary metrics (`totalSteps`, `directCredits`, `totalCredits`) to the server. On non-OK responses or errors the function logs the failure and returns without a value.
 *
 * @param params - Parameters for finishing the agent run
 * @param params.runId - Identifier of the agent run to finalize
 * @param params.status - Final status of the run (e.g., `'completed'`, `'failed'`)
 * @param params.totalSteps - Total number of steps executed in the run, if available
 * @param params.directCredits - Direct credits consumed by the run, if available
 * @param params.totalCredits - Total credits consumed by the run, if available
 */
export async function finishAgentRun(
  params: ParamsOf<FinishAgentRunFn>,
): ReturnType<FinishAgentRunFn> {
  const {
    apiKey,
    runId,
    status,
    totalSteps,
    directCredits,
    totalCredits,
    logger,
  } = params

  const url = new URL(`/api/v1/agent-runs`, WEBSITE_URL)

  try {
    const response = await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          action: 'FINISH',
          runId,
          status,
          totalSteps,
          directCredits,
          totalCredits,
        }),
      },
      logger,
    )

    if (!response.ok) {
      logger.error({ response }, 'finishAgentRun request failed')
      return
    }
  } catch (error) {
    logger.error(
      { error: getErrorObject(error), runId, status },
      'finishAgentRun error',
    )
  }
}

/**
 * Adds a step to an existing agent run and returns the created step's ID if available.
 *
 * @param apiKey - Optional API key used for Bearer authentication
 * @param agentRunId - Identifier of the agent run to append the step to
 * @param stepNumber - Sequential number for the step within the run
 * @param credits - Credits consumed by this step
 * @param childRunIds - Optional array of child run IDs spawned by this step
 * @param messageId - Optional associated message ID
 * @param status - Step status; defaults to `'completed'`
 * @param errorMessage - Optional error message for failed steps
 * @param startTime - Optional ISO timestamp or epoch representing when the step started
 * @returns The created `stepId` string if present in the response, `null` otherwise
 */
export async function addAgentStep(
  params: ParamsOf<AddAgentStepFn>,
): ReturnType<AddAgentStepFn> {
  const {
    apiKey,
    agentRunId,
    stepNumber,
    credits,
    childRunIds,
    messageId,
    status = 'completed',
    errorMessage,
    startTime,
    logger,
  } = params

  const url = new URL(`/api/v1/agent-runs/${agentRunId}/steps`, WEBSITE_URL)

  try {
    const response = await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          stepNumber,
          credits,
          childRunIds,
          messageId,
          status,
          errorMessage,
          startTime,
        }),
      },
      logger,
    )

    const responseBody = await response.json()
    if (!response.ok) {
      logger.error({ responseBody }, 'addAgentStep request failed')
      return null
    }

    if (!responseBody?.stepId) {
      logger.error(
        { responseBody },
        'no stepId found from addAgentStep request',
      )
    }
    return responseBody.stepId ?? null
  } catch (error) {
    logger.error(
      {
        error: getErrorObject(error),
        agentRunId,
        stepNumber,
        credits,
        childRunIds,
        messageId,
        status,
        errorMessage,
        startTime,
      },
      'addAgentStep error',
    )
    return null
  }
}
