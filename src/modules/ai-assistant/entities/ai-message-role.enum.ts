/**
 * Validated message roles — never accept an arbitrary user-provided role
 * string. USER/ASSISTANT are the visible conversation turns; SYSTEM is the
 * one injected instruction message (never user-authored); TOOL carries a
 * tool call's structured result back into the conversation.
 */
export enum AiMessageRole {
  User = 'USER',
  Assistant = 'ASSISTANT',
  System = 'SYSTEM',
  Tool = 'TOOL',
}
