import type { DecorationItem, ResolvedPosition, ThemedToken } from '@shikijs/core'

import { getRawTextHelper } from './getRawTextHelper'

export type DecoratedThemedToken = ThemedToken & { tagName?: string }
export type Decoration = Pick<DecorationItem, 'start' | 'end' | 'tagName'>
export type ResolvedDecoration =
  & Omit<
    Decoration, 'start' | 'end'
  >
  & {
  start: ResolvedPosition
  end: ResolvedPosition
}

export function decorateTokens(
  rawText: string,
  tokensLines: DecoratedThemedToken[][],
  decorations: Decoration[]
) {
  const { resolvePosition } = getRawTextHelper(rawText)
  const tokenDecorationsMap = new Map<DecoratedThemedToken, ResolvedDecoration[]>()
  for (const decoration of decorations) {
    const { start, end, ...omitStartAndEndDecoration } = decoration
    const startResolved = resolvePosition(start)
    const endResolved = resolvePosition(end)
    const tokens = tokensLines[startResolved.line - 1]
    if (!tokens) {
      continue
    }
    for (const token of tokens) {
      const tokenStart = token.offset
      const tokenEnd = token.offset + token.content.length
      // --123--
      //  ^^^
      // --123--
      //  ^^^^
      // --123--
      //  ^^^^^
      // --123--
      //   ^^^^
      // --123--
      //    ^^^
      if (!(endResolved.offset <= tokenStart || tokenEnd <= startResolved.offset)) {
        const tokenDecorations = tokenDecorationsMap.get(token) ?? []
        tokenDecorationsMap.set(token, tokenDecorations)
        tokenDecorations.push({
          ...omitStartAndEndDecoration,
          start: startResolved,
          end: endResolved
        })
      }
    }
  }
  const result: DecoratedThemedToken[][] = []
  for (const tokens of tokensLines) {
    const ntks: DecoratedThemedToken[] = []
    result.push(ntks)
    for (const token of tokens) {
      const tokenStart = token.offset
      const tokenEnd = token.offset + token.content.length
      const decorations = tokenDecorationsMap.get(token)
      if (decorations) {
        const points: Record<number, ResolvedDecoration[]> = {}
        points[0] = []
        points[token.content.length] = []
        for (const decoration of decorations) {
          const { start, end } = decoration
          const l = start.offset > tokenStart
            ? start.offset - tokenStart
            : 0
          const r = end.offset < tokenEnd
            ? end.offset - tokenStart
            : token.content.length
          points[l] = points[l] ?? []
          points[l].push(decoration)
          points[r] = points[r] ?? []
        }
        const pointIndexes = Object.keys(points).map(Number).sort((a, b) => a - b)
        for (let i = 0; i < pointIndexes.length - 1; i++) {
          const l = pointIndexes[i]
          const r = pointIndexes[i + 1]
          const lDecorations = points[l]
          if (lDecorations.length) {
            const tagNames = lDecorations.map(d => d.tagName).filter(Boolean)
            ntks.push({
              ...token,
              content: token.content.slice(l, r),
              offset: token.offset + l,
              tagName: tagNames.join(' ')
            })
          } else {
            ntks.push({
              ...token,
              content: token.content.slice(l, r),
              offset: token.offset + l
            })
          }
        }
      } else {
        ntks.push(token)
      }
    }
  }
  return result
}
