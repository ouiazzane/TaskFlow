import { createHash } from 'node:crypto';

export function hashTokenId(tokenId: string): string {
  return createHash('sha256').update(tokenId).digest('hex');
}
