export declare const MAX_SKEW: number
export declare function newNonce(): string
export declare function requestSignature(secret: string, o: { method: string; path: string; ts: string; nonce: string; body: string }): string
export declare function responseSignature(secret: string, o: { status: number; nonce: string; ts: string; body: string }): string
export declare function signRequest(
  secret: string,
  o: { method: string; path: string; body: string; now?: number },
): { nonce: string; headers: Record<'x-judge-ts' | 'x-judge-nonce' | 'x-judge-sig', string> }
export declare class NonceCache {
  add(nonce: string, nowSec: number): boolean
}
export declare function verifyRequest(
  secret: string,
  o: { method: string; path: string; headers: Record<string, string | string[] | undefined>; body: string; nonces: NonceCache; now?: number },
): null | 'bad_ts' | 'bad_nonce' | 'expired' | 'bad_sig' | 'replay'
export declare function signResponse(secret: string, o: { status: number; nonce: string; body: string; now?: number }): Record<'x-judge-ts' | 'x-judge-sig', string>
export declare function verifyResponse(
  secret: string,
  o: { status: number; nonce: string; headers: Record<string, string | null | undefined>; body: string; now?: number },
): null | 'bad_ts' | 'expired' | 'bad_sig'
