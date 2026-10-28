// runtime.js 的类型（纯计算部分给测试用；createGuide 只在浏览器里用）
export type Rect = { x0: number; y0: number; x1: number; y1: number }
export type FocusSpan = { k: string; t0: number; t1: number; note?: string; side?: 'r' | 'l' | 'b' }
export const MOVE: number
export const FOCUS_IN: number
export const GLIDE: number
export const SETTLE: number
export const NOTE_ARROW: number
export const NOTE_FADE: number
export function ease(x: number): number
export function near(a: number, b: number): boolean
export function mid(r: Rect): [number, number]
export function groupRects(rs: Rect[]): Rect[]
export function focusState(f: FocusSpan, time: number, hasPrev: boolean, goesOn: boolean): { g: number; pad: number; a: number }
export function glideRect(R0: Rect[], r: Rect, g: number): Rect
export function notePlace(R: Rect, w: number, h: number, side?: 'r' | 'l' | 'b'): { side: 'r' | 'l' | 'b'; tx: number; ty: number; ax: number; ay: number; bx: number; by: number; cx: number; cyc: number }
export function noteState(f: FocusSpan & { note: string }, time: number, delay: number, a: number, goesOn: boolean): { pa: number; pw: number; op: number }
export function arrowHead(bx: number, by: number, cx: number, cyc: number): string
export function createGuide(env: unknown): { layer(ci: number): { el: HTMLElement }; frame(time: number, ci: number, step: { k: string }): (string | number)[] }
