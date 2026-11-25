import { AgentConnectError, type AgentConnectErrorCode } from '@open-agent-connect/web'

export interface TutorFailureDiagnostic {
  readonly code: AgentConnectErrorCode | 'operation_failed'
  readonly status?: number
}

/** Keep gateway-supplied error text out of the tutor transcript. */
export function diagnoseTutorFailure(error: unknown): TutorFailureDiagnostic {
  if (error instanceof AgentConnectError) return { code: error.code, status: error.status }
  return { code: error instanceof DOMException && error.name === 'AbortError' ? 'task_interrupted' : 'operation_failed' }
}

export function tutorFailureMessage({ code }: TutorFailureDiagnostic): string {
  switch (code) {
    case 'task_interrupted': return 'The tutor response was interrupted.'
    case 'invalid_app_grant': return 'Bookhand’s approval is no longer valid. Reconnect to the gateway.'
    case 'session_capacity': return 'The gateway is at capacity. End a session in the gateway or wait for one to close.'
    case 'agent_execution_failed': return 'Your agent could not complete this response.'
    case 'tool_execution_failed': return 'A Bookhand tool failed during this response.'
    default: return 'The tutor could not complete this response.'
  }
}

export function formatTutorFailureDiagnostic({ code, status }: TutorFailureDiagnostic): string {
  return status === undefined ? code : `${code} (HTTP ${status})`
}
