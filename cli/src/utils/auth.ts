import fs from 'fs'
import os from 'os'
import path from 'path'
import { z } from 'zod'

export const userSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  email: z.string(),
  authToken: z.string(),
  fingerprintId: z.string().optional(),
  fingerprintHash: z.string().optional(),
  credits: z.number().optional(),
})

export type User = z.infer<typeof userSchema>

export const getConfigDir = (): string => {
  return path.join(os.homedir(), '.config', 'manicode')
}

export const getCredentialsPath = (): string => {
  return path.join(getConfigDir(), 'credentials.json')
}

export const getUserCredentials = (): User | null => {
  return {
    id: 'local',
    email: 'local@localhost',
    name: 'Local User',
    authToken: 'dummy',
  }
}

export type AuthTokenSource = 'credentials' | 'environment' | null

export interface AuthTokenDetails {
  token?: string
  source: AuthTokenSource
}

export const getAuthTokenDetails = (): AuthTokenDetails => {
  return { token: 'dummy', source: 'credentials' }
}

export const getAuthToken = (): string => {
  return 'dummy'
}

export const hasAuthCredentials = (): boolean => {
  return true
}

export interface AuthValidationResult {
  authenticated: boolean
  hasInvalidCredentials: boolean
}

const readCredentialsFile = (): Record<string, unknown> => {
  return {}
}

export const saveUserCredentials = (_user: User): void => {
  // no-op
}

export const clearUserCredentials = (): void => {
  // no-op
}

export async function logoutUser(): Promise<boolean> {
  return true
}
