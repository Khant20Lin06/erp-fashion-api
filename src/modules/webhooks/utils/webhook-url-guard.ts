import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Blocks SSRF via client-supplied webhook subscription URLs
 * (docs/SECURITY_RULES.md #50 SSRF Protection). A webhook subscription URL
 * is untrusted client input that this server later fetches on the
 * subscriber's behalf (postSignedWebhook) — without this check, any user
 * who can create/update a subscription could point it at internal
 * infrastructure (loopback, private ranges, link-local/cloud metadata) and
 * read back the response body via the synchronous test-delivery endpoint.
 *
 * Checks both the literal hostname (covers "http://127.0.0.1/...",
 * "http://[::1]/...") and every IP a DNS lookup resolves it to (covers a
 * public-looking hostname that resolves to a private/internal address).
 * Callers that fetch the URL later should re-validate at fetch time too —
 * this function only guarantees the address was safe at validation time,
 * not at every future delivery (DNS can change between calls).
 */
export async function assertSafeWebhookUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new AppException(ErrorCode.ValidationError, 'url must be a valid URL');
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new AppException(
      ErrorCode.ValidationError,
      'url must use http or https',
    );
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');

  if (isIP(hostname)) {
    assertPublicAddress(hostname);
    return;
  }

  if (hostname.toLowerCase() === 'localhost') {
    throw new AppException(
      ErrorCode.ValidationError,
      'url must not target localhost or an internal address',
    );
  }

  let addresses: string[];
  try {
    const results = await lookup(hostname, { all: true });
    addresses = results.map((result) => result.address);
  } catch {
    throw new AppException(
      ErrorCode.ValidationError,
      'url hostname could not be resolved',
    );
  }

  if (addresses.length === 0) {
    throw new AppException(
      ErrorCode.ValidationError,
      'url hostname could not be resolved',
    );
  }

  for (const address of addresses) {
    assertPublicAddress(address);
  }
}

function assertPublicAddress(address: string): void {
  if (isPrivateOrReservedAddress(address)) {
    throw new AppException(
      ErrorCode.ValidationError,
      'url must not target a private, loopback, link-local, or reserved address',
    );
  }
}

/**
 * Conservative allowlist-by-exclusion of non-public IPv4/IPv6 ranges:
 * loopback, private (RFC1918), link-local (incl. the 169.254.169.254 cloud
 * metadata endpoint), CGNAT, multicast/reserved, and IPv4-mapped/6to4
 * encodings of the same. Intentionally broad — a false positive here just
 * rejects a webhook URL at creation time; a false negative is SSRF.
 */
function isPrivateOrReservedAddress(address: string): boolean {
  const version = isIP(address);

  if (version === 4) {
    const octets = address.split('.').map(Number);
    const [a, b] = octets;
    if (a === 127) return true; // loopback
    if (a === 10) return true; // RFC1918
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 0) return true; // "this network"
    if (a >= 224) return true; // multicast/reserved
    return false;
  }

  if (version === 6) {
    const normalized = address.toLowerCase();
    if (normalized === '::1') return true; // loopback
    if (normalized === '::') return true; // unspecified
    if (normalized.startsWith('fe80:')) return true; // link-local
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique local

    const mappedIPv4 = extractIPv4MappedAddress(normalized);
    if (mappedIPv4) {
      return isPrivateOrReservedAddress(mappedIPv4);
    }
    return false;
  }

  // Not a recognizable IP literal — treat conservatively as unsafe.
  return true;
}

/**
 * Extracts the embedded IPv4 address from an IPv4-mapped IPv6 literal.
 * Handles both the dotted-decimal form Node preserves for `::ffff:a.b.c.d`
 * and the fully-hex form the URL parser normalizes it to internally
 * (`::ffff:7f00:1` for `::ffff:127.0.0.1`), since which form `dns.lookup`
 * / `new URL().hostname` hands back is not guaranteed.
 */
function extractIPv4MappedAddress(normalized: string): string | null {
  const dottedMatch = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dottedMatch) {
    return dottedMatch[1];
  }

  const hexMatch = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMatch) {
    const high = parseInt(hexMatch[1], 16);
    const low = parseInt(hexMatch[2], 16);
    return [
      (high >> 8) & 0xff,
      high & 0xff,
      (low >> 8) & 0xff,
      low & 0xff,
    ].join('.');
  }

  return null;
}
