import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'node:crypto';

export interface PendingApproval {
  token: string;
  toolName: string;
  userId: string;
  companyId: string;
  argumentHash: string;
  summary: string;
  createdAt: number;
  expiresAt: number;
}

export interface ApprovalCheckResult {
  approved: boolean;
  approvalToken?: string;
  summary?: string;
  error?: string;
}

const DEFAULT_APPROVAL_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class AiApprovalService {
  private readonly logger = new Logger(AiApprovalService.name);
  private readonly pendingApprovals = new Map<string, PendingApproval>();

  /**
   * Computes a deterministic SHA-256 hash of the tool arguments
   * to guarantee the approved payload cannot be tampered with.
   */
  computeArgumentHash(args: unknown): string {
    const serialized = JSON.stringify(args || {}, Object.keys(args || {}).sort());
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Creates a pending approval request for a tool requiring human confirmation.
   */
  requestApproval(
    userId: string,
    companyId: string,
    toolName: string,
    rawArguments: unknown,
    actionSummary: string,
    ttlMs: number = DEFAULT_APPROVAL_TTL_MS,
  ): PendingApproval {
    const token = crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    const argumentHash = this.computeArgumentHash(rawArguments);

    const pending: PendingApproval = {
      token,
      toolName,
      userId,
      companyId,
      argumentHash,
      summary: actionSummary,
      createdAt: now,
      expiresAt: now + ttlMs,
    };

    this.pendingApprovals.set(token, pending);
    this.logger.log(`Approval requested: tool=${toolName} user=${userId} token=${token.slice(0, 8)}...`);
    return pending;
  }

  /**
   * Verifies an approval token supplied by the user/caller before executing a sensitive tool.
   * If valid, consumes the token so it cannot be replayed.
   */
  verifyAndConsume(
    token: string | undefined,
    userId: string,
    companyId: string,
    toolName: string,
    rawArguments: unknown,
  ): ApprovalCheckResult {
    if (!token) {
      return { approved: false, error: 'Approval token is required for this action.' };
    }

    const pending = this.pendingApprovals.get(token);
    if (!pending) {
      return { approved: false, error: 'Approval token not found or already used.' };
    }

    if (Date.now() > pending.expiresAt) {
      this.pendingApprovals.delete(token);
      return { approved: false, error: 'Approval token has expired.' };
    }

    if (pending.userId !== userId || pending.companyId !== companyId || pending.toolName !== toolName) {
      this.logger.warn(`Approval token mismatch: expected user=${pending.userId}, got user=${userId}`);
      return { approved: false, error: 'Approval token does not match the current user/context.' };
    }

    const currentHash = this.computeArgumentHash(rawArguments);
    if (pending.argumentHash !== currentHash) {
      this.logger.warn(`Approval argument tamper detected for token ${token.slice(0, 8)}`);
      return { approved: false, error: 'Tool arguments do not match the approved parameters.' };
    }

    // Token is valid; consume it
    this.pendingApprovals.delete(token);
    this.logger.log(`Approval verified and consumed for tool=${toolName} user=${userId}`);
    return { approved: true, summary: pending.summary };
  }

  /**
   * Housekeeping: Purge expired approvals
   */
  cleanupExpired(): void {
    const now = Date.now();
    for (const [token, pending] of this.pendingApprovals.entries()) {
      if (now > pending.expiresAt) {
        this.pendingApprovals.delete(token);
      }
    }
  }
}
