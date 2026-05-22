import { publisher } from '../constants'
import type { SecretAgentDefinition } from '../types/secret-agent-definition'
import { createReviewer } from './code-reviewer'

const definition: SecretAgentDefinition = {
  id: 'code-reviewer-kimi',
  publisher,
  ...createReviewer('accounts/fireworks/models/kimi-k2p6'),
}

export default definition
