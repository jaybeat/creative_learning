export interface GatewayResponse {
  status: number
  headers: Record<string, string>
  body: string
}
export declare const LIMITS: {
  bodyBytes: number
  codeBytes: number
  inputs: number
  inputBytes: number
  concurrent: number
  cacheMs: number
  compile: { cpu: number; clock: number; memory: number; proc: number; stderr: number; message: number }
  run: { cpu: number; clock: number; memory: number; proc: number; stdout: number; stderr: number }
}
export declare function mapStatus(r: { status: string; fileError?: { type: string }[] }): string
export declare function cleanCompileMessage(s: string, max?: number): string
export declare function createGateway(o: {
  secret: string
  goJudge: (path: string, init?: RequestInit) => Promise<Response>
  now?: () => number
}): (req: { method: string; path: string; headers: Record<string, string | string[] | undefined>; body: string; ip?: string }) => Promise<GatewayResponse>
export declare function startServer(o: { secret: string; port?: number; goJudgeUrl?: string }): import('node:http').Server
