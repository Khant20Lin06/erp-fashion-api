export interface RequestLinkResponseDto {
  /**
   * The bot integration layer must relay this back to the SAME Telegram
   * chat that requested it, then discard it — never log it, never store
   * it anywhere but the (already-hashed) TelegramLinkOtp row.
   */
  code: string;
  expiresAt: Date;
}

export interface VerifyLinkResponseDto {
  customerId: string;
  customerName: string;
}
