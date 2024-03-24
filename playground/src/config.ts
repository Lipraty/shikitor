import type { ResolvedPosition } from '@shikijs/core'

import type { ShikitorOptions } from './core/editor'
import bracketMatcher from './plugins/bracket-matcher'
import codeStyler from './plugins/code-styler'

let defaultCode = `
console.log("Hello, World!")

function add(a, b) {
  return a + b
}
`.trimStart()
let cursor: undefined | ResolvedPosition

export default {
  get value() {
    return defaultCode
  },
  set value(value) {
    defaultCode = value
  },
  onChange(value) {
    defaultCode = value
  },
  get cursor() {
    return cursor
  },
  onCursorChange(newCursor) {
    cursor = newCursor
  },
  language: 'javascript',
  theme: 'github-dark',
  plugins: [
    bracketMatcher,
    codeStyler
  ]
} as ShikitorOptions
