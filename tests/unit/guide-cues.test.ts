import { describe, expect, test } from 'vitest'
import { assemble, locateCues, normSpeech, phraseTime, type Beat, type Card, type Screen } from '../../scripts/lib/course'

const beat = (n: number, text: string, pic = '画面'): Beat => ({ n, screen: 0, pic, text, src: '原样', chars: text.length })

describe('念到哪，看到哪：cue 的短语和时间', () => {
  test('normSpeech 去掉标点、反引号和加粗记号', () => {
    expect(normSpeech('读到`3+4`，它能**马上**算出7吗？')).toBe('读到3+4它能马上算出7吗')
  })

  test('短语按顺序往后找，同一个短语第二次出现时找后一个；跨"同上"的拍', () => {
    const c: Card = { id: '0-01', screen: 0, html: '', beats: [beat(1, '读到3，写出去。读到4，写出去。'), beat(2, '读到`+`：左边是3。', '同上')], cues: [{ at: '写出去' }, { at: '写出去' }, { at: '读到`+`' }] }
    const hits = locateCues(c)
    expect(hits.map((h) => [h.beat, h.i])).toEqual([[1, 3], [1, 9], [2, 0]])
  })

  test('找不到的短语报错（assemble 也会报）', () => {
    const errors: string[] = []
    locateCues({ id: '0-01', screen: 0, html: '', beats: [beat(1, '读到3')], cues: [{ at: '读到4' }] }, errors)
    expect(errors[0]).toMatch(/读到4/)
    const screens: Screen[] = [{ n: 0, name: '', beats: [beat(1, '读到3')], pauses: [] }]
    expect(assemble(screens, [{ beat: 1, html: '', cues: [{ at: '没有' }] }]).errors[0]).toMatch(/没有/)
  })

  test('有逐字时间就用它，没有或字数对不上就按字数比例', () => {
    const text = '从左往右读' // 5 个字
    const times = [[0.1, 0.3], [0.3, 0.5], null, [0.9, 1.1], [1.1, 1.4]] as ([number, number] | null)[]
    expect(phraseTime(text, 2, 1, 3, times)).toEqual([0.3, 1.1])
    expect(phraseTime(text, 2, 0, 1, null)).toEqual([0, 0.4])
    expect(phraseTime(text, 2, 0, 1, [[0, 1]])).toEqual([0, 0.4])
  })
})
