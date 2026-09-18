import { Injectable, Logger } from '@nestjs/common';

export interface GuardrailValidationResult {
  safe: boolean;
  reason?: string;
  sanitized?: string;
}

const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions/i,
  /disregard\s+(?:all\s+)?(?:previous|prior|system)\s+instructions/i,
  /(?:reveal|show|display|print|expose)\s+(?:your\s+)?(?:system\s+prompt|initial\s+prompt|developer\s+instructions)/i,
  /you\s+are\s+now\s+(?:in\s+)?(?:developer|jailbreak|god|dan)\s+mode/i,
  /\b(?:drop\s+table|delete\s+from|update\s+\w+\s+set|truncate\s+table)\b/i,
  /<script\b[^>]*>[\s\S]*?<\/script>/i,
  /(?:exec|eval|system)\s*\(/i,
];

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /apikey/i,
  /api_key/i,
  /authorization/i,
  /credit_?card/i,
  /cvv/i,
  /pin/i,
  /private_?key/i,
];

const CREDIT_CARD_REGEX = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
const JWT_REGEX = /\beyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g;

@Injectable()
export class AiGuardrailsService {
  private readonly logger = new Logger(AiGuardrailsService.name);

  /**
   * Validates raw user prompt text against prompt injection, jailbreak attempts,
   * and dangerous instruction tampering before passing to LLM.
   */
  validateInput(input: string): GuardrailValidationResult {
    if (!input || typeof input !== 'string') {
      return { safe: true, sanitized: '' };
    }

    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        this.logger.warn(`Prompt injection pattern blocked: ${pattern}`);
        return {
          safe: false,
          reason: 'Input contains potentially unsafe instructions or prompt injection patterns.',
        };
      }
    }

    // Mask any accidental credit cards or JWT tokens in input
    const sanitized = input
      .replace(CREDIT_CARD_REGEX, '[REDACTED_CARD]')
      .replace(JWT_REGEX, '[REDACTED_JWT]');

    return { safe: true, sanitized };
  }

  /**
   * Validates tool arguments to ensure the LLM hasn't hallucinated or been manipulated
   * into passing injection payloads inside tool parameters.
   */
  validateArguments(toolName: string, args: unknown): GuardrailValidationResult {
    if (!args || typeof args !== 'object') {
      return { safe: true };
    }

    const json = JSON.stringify(args);
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(json)) {
        this.logger.warn(`Dangerous pattern in arguments for tool ${toolName}: ${pattern}`);
        return {
          safe: false,
          reason: `Tool arguments for '${toolName}' contain disallowed SQL, code, or injection syntax.`,
        };
      }
    }

    return { safe: true };
  }

  /**
   * Recursively scrubs sensitive credentials, keys, and PII from arguments
   * before storing in the audit log or emitting metrics.
   */
  maskSensitiveData(data: unknown, extraSensitiveKeys: string[] = []): unknown {
    if (data === null || data === undefined) return data;
    if (typeof data === 'string') {
      return data
        .replace(CREDIT_CARD_REGEX, '[REDACTED_CARD]')
        .replace(JWT_REGEX, '[REDACTED_JWT]');
    }
    if (Array.isArray(data)) {
      return data.map((item) => this.maskSensitiveData(item, extraSensitiveKeys));
    }
    if (typeof data === 'object') {
      const masked: Record<string, unknown> = {};
      const sensitivePatterns = [
        ...SENSITIVE_KEY_PATTERNS,
        ...extraSensitiveKeys.map((k) => new RegExp(`^${k}$`, 'i')),
      ];

      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        const isSensitiveKey = sensitivePatterns.some((pattern) => pattern.test(key));
        if (isSensitiveKey) {
          masked[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          masked[key] = this.maskSensitiveData(value, extraSensitiveKeys);
        } else if (typeof value === 'string') {
          masked[key] = value
            .replace(CREDIT_CARD_REGEX, '[REDACTED_CARD]')
            .replace(JWT_REGEX, '[REDACTED_JWT]');
        } else {
          masked[key] = value;
        }
      }
      return masked;
    }
    return data;
  }

  /**
   * Inspects LLM output for system prompt leakage or internal error backtraces.
   */
  validateOutput(output: string): GuardrailValidationResult {
    if (!output || typeof output !== 'string') {
      return { safe: true, sanitized: '' };
    }

    // Mask leaked JWTs or keys in output
    let sanitized = output
      .replace(CREDIT_CARD_REGEX, '[REDACTED_CARD]')
      .replace(JWT_REGEX, '[REDACTED_JWT]');

    // Check for internal database stack trace leakage
    if (/Error:\s*(?:ER_|ECONNREFUSED|PROTOCOL_)/i.test(output)) {
      this.logger.error('Database connection error detected in LLM output; redacting.');
      sanitized = 'စနစ်အတွင်း အချက်အလက်များ လုပ်ဆောင်ရာတွင် အခက်အခဲရှိနေပါသည်။ ကျေးဇူးပြု၍ ခဏအကြာမှ ထပ်မံကြိုးစားပေးပါ။';
      return { safe: true, sanitized, reason: 'Internal error redacted' };
    }

    return { safe: true, sanitized };
  }
}
