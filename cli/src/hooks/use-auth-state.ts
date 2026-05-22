import { useCallback, useState } from 'react'
import { useLogoutMutation } from './use-auth-query'
import type { MultilineInputHandle } from '../components/multiline-input'
import type { User } from '../utils/auth'

interface UseAuthStateOptions {
  requireAuth: boolean | null
  inputRef: React.MutableRefObject<MultilineInputHandle | null>
  setInputFocused: (focused: boolean) => void
  resetChatStore: () => void
}

export const useAuthState = ({
  requireAuth: _requireAuth,
  inputRef: _inputRef,
  setInputFocused: _setInputFocused,
  resetChatStore: _resetChatStore,
}: UseAuthStateOptions) => {
  const logoutMutation = useLogoutMutation()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(true)
  const [user, setUser] = useState<User | null>({
    id: 'local',
    email: 'local@localhost',
    name: 'Local User',
    authToken: 'dummy',
  })

  const handleLoginSuccess = useCallback((loggedInUser: User) => {
    setUser(loggedInUser)
    setIsAuthenticated(true)
  }, [])

  return {
    isAuthenticated,
    setIsAuthenticated,
    user,
    setUser,
    handleLoginSuccess,
    logoutMutation,
  }
}
