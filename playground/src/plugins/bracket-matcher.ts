import type { Shikitor } from '../core/editor'
import type { ResolvedCursor } from '../core/editor/base'
import { definePlugin } from '../core/plugin'
import { isMultipleKey } from '../utils/isMultipleKey'

const bracketMap: Record<string, string | undefined> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '<': '>',
  ')': '(',
  ']': '[',
  '}': '{',
  '>': '<'
}
const lBrackets = ['(', '[', '{', '<']

const name = 'shikitor-bracket-matcher'
export default () => {
  let shikitorCursor: ResolvedCursor | undefined
  function insertBracketHighlighting(this: Shikitor) {
    const cursor = shikitorCursor
    const { decorations = [] } = this.options
    let newDecorations = [
      ...decorations.filter(d => !d.tagName?.includes(name))
    ]
    if (!cursor) {
      this.updateOptions({ decorations: newDecorations })
      return
    }
    const value = this.value
    const prev = value[cursor.offset - 1]
    const next = value[cursor.offset]

    const prevBracket = bracketMap[prev]
    const nextBracket = bracketMap[next]
    const relativeBracket = prevBracket || nextBracket
    if (relativeBracket) {
      const bracket = prevBracket ? prev : next

      const bracketOffset = prevBracket
        ? cursor.offset - 1
        : cursor.offset
      newDecorations.push({
        start: bracketOffset,
        end: bracketOffset + 1,
        tagName: `shikitor-bg-lighting ${name}`
      })
      const increase = lBrackets.includes(relativeBracket) ? -1 : 1
      const stack = []
      // TODO `console.log(")")`
      for (let i = bracketOffset + increase; ; i += increase) {
        if (i < 0 || i >= value.length) {
          break
        }
        const char = value[i]
        if (char === bracket) {
          stack.push(char)
        }
        if (char === relativeBracket) {
          if (stack.length === 0) {
            newDecorations.push({
              start: i,
              end: i + 1,
              tagName: `shikitor-bg-lighting ${name}`
            })
            break
          }
          stack.pop()
        }
      }
    } else {
      newDecorations = []
    }
    this.updateOptions({ decorations: newDecorations })
  }
  let isPressedDelete = false
  return definePlugin({
    name,
    onCursorChange(cursor) {
      shikitorCursor = cursor
      insertBracketHighlighting.call(this)
    },
    onKeydown(e) {
      if (e.key === 'Delete' && !isMultipleKey(e)) {
        isPressedDelete = true
      }
    },
    onKeyup(e) {
      if (e.key === 'Delete') {
        isPressedDelete = false
      }
    },
    onChange() {
      if (isPressedDelete) {
        insertBracketHighlighting.call(this)
      }
    }
  })
}
