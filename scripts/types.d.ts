// subset-font 与 fontkit 没有自带类型声明，这里只声明本项目用到的部分。

declare module 'subset-font' {
  interface SubsetFontOptions {
    targetFormat?: 'sfnt' | 'woff' | 'woff2' | 'truetype'
    preserveNameIds?: number[]
    variationAxes?: Record<string, number | { min: number; max: number; default?: number }>
    keepAllGlyphs?: boolean
    noLayoutClosure?: boolean
  }
  function subsetFont(buffer: Buffer, text: string | null, options?: SubsetFontOptions): Promise<Buffer>
  export default subsetFont
}

declare module 'fontkit' {
  interface Glyph {
    advanceWidth: number
  }
  interface Font {
    unitsPerEm: number
    characterSet: number[]
    hasGlyphForCodePoint(codePoint: number): boolean
    glyphForCodePoint(codePoint: number): Glyph
  }
  interface FontCollection {
    fonts: Font[]
  }
  export function create(buffer: Uint8Array | Buffer, postscriptName?: string): Font | FontCollection
}
