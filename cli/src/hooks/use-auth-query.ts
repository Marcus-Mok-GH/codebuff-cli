import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import type { User } from '../utils/auth'
import type { GetUserInfoFromApiKeyFn } from '@codebuff/common/types/contracts/database'
import type { Logger } from '@codebuff/common/types/contracts/logger'

export const authQueryKeys = {
  all: ['auth'] as const,
  user: () => [...authQueryKeys.all, 'user'] as const,
  validation: (apiKey: string) =>
    [...authQueryKeys.all, 'validation', apiKey] as const,
}

export interface ValidateAuthParams {
  apiKey: string
  getUserInfoFromApiKey?: GetUserInfoFromApiKeyFn
  logger?: Logger
}

export async function validateApiKey(
  _params: ValidateAuthParams,
): Promise<{ id: string; email: string }> {
  return { id: 'local', email: 'local@localhost' }
}

export interface UseAuthQueryDeps {
  getUserCredentials?: () => User | null
  getUserInfoFromApiKey?: GetUserInfoFromApiKeyFn
  logger?: Logger
}

export function useAuthQuery(_deps: UseAuthQueryDeps = {}) {
  return useQuery({
    queryKey: authQueryKeys.validation('dummy'),
    queryFn: async () => ({ id: 'local', email: 'local@localhost' }),
    enabled: true,
  })
}

export interface UseLoginMutationDeps {
  saveUserCredentials?: (user: User) => void
  getUserInfoFromApiKey?: GetUserInfoFromApiKeyFn
  logger?: Logger
}

export function useLoginMutation(_deps: UseLoginMutationDeps = {}) {
  return useMutation({
    mutationFn: async (user: User) => user,
  })
}

export interface UseLogoutMutationDeps {
  logoutUser?: () => Promise<boolean>
  logger?: Logger
}

export function useLogoutMutation(_deps: UseLogoutMutationDeps = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      queryClient.removeQueries({ queryKey: authQueryKeys.all })
      return true
    },
  })
}
