import './index.scss'

import { getHighlighter } from 'shiki'
import { derive } from 'valtio/utils'
import { proxy, snapshot, subscribe } from 'valtio/vanilla'

import type {
  ResolvedSelection,
  Shikitor,
  ShikitorOptions
} from '../editor'
import { callUpdateDispatcher } from '../editor'
import type { ResolvedPopup } from '../editor/register'
import type { _KeyboardEvent, ShikitorPlugin } from '../plugin'
import type { PickByValue } from '../types'
import { isMultipleKey } from '../utils/isMultipleKey'
import { isWhatBrowser } from '../utils/isWhatBrowser'
import { listen } from '../utils/listen'
import { throttle } from '../utils/throttle'
import { debounceWatch } from '../utils/valtio/debounceWatch'
import { isSameSnapshot } from '../utils/valtio/isSameSnapshot'
import { cursorControlled } from './controlled/cursorControlled'
import { popupsControlled } from './controlled/popupsControlled'
import { valueControlled } from './controlled/valueControlled'
import { resolveInputPlugins } from './resolveInputPlugins'
import { shikitorStructureTransformer } from './structureTransfomer'

function initDom(target: HTMLElement) {
  target.classList.add('shikitor')
  target.innerHTML = ''

  const input = document.createElement('textarea')
  const output = document.createElement('div')

  input.classList.add('shikitor-input')
  input.setAttribute('autocapitalize', 'off')
  input.setAttribute('autocomplete', 'off')
  input.setAttribute('autocorrect', 'off')
  input.setAttribute('spellcheck', 'false')

  output.classList.add('shikitor-output')

  target.append(output, input)
  return [input, output] as const
}

export async function create(target: HTMLElement, inputOptions: ShikitorOptions): Promise<Shikitor> {
  const {
    onChange,
    onCursorChange,
    onDispose
  } = inputOptions
  const [input, output] = initDom(target)

  const optionsRef = proxy({
    current: {
      ...inputOptions,
      plugins: await resolveInputPlugins(inputOptions.plugins)
    }
  })

  const {
    dispose: disposePopupsControlled,
    popups
  } = popupsControlled(() => shikitor, target)
  const {
    dispose: disposeValueControlled,
    valueRef,
    rawTextHelperRef
  } = valueControlled(input, optionsRef, value => {
    onChange?.(value)
    callAllShikitorPlugins('onChange', value)
  })
  const {
    dispose: disposeCursorControlled,
    cursorRef
  } = cursorControlled(
    rawTextHelperRef,
    optionsRef,
    cursor => {
      onCursorChange?.(cursor)
      callAllShikitorPlugins('onCursorChange', cursor)
    }
  )
  let prevSelection: ResolvedSelection | undefined
  const languageRef = derive({
    current: get => get(optionsRef).current.language
  })

  const disposes = [
    disposePopupsControlled,
    disposeValueControlled,
    disposeCursorControlled
  ] as (() => void)[]
  const scopeWatch: typeof debounceWatch = (get, options) => {
    const dispose = debounceWatch(get, options)
    disposes.push(dispose)
    return dispose
  }
  const scopeSubscribe: typeof subscribe = (...args) => {
    const dispose = subscribe(...args)
    disposes.push(dispose)
    return dispose
  }

  const pluginsRef = derive({
    current: get => get(optionsRef).current.plugins
  })
  function callAllShikitorPlugins<
    K extends Exclude<keyof PickByValue<ShikitorPlugin, (...args: any[]) => any>, undefined>
  >(method: K, ...args: Parameters<Exclude<ShikitorPlugin[K], undefined>>) {
    const plugins = pluginsRef.current
    return plugins.map(ShikitorPlugin => ShikitorPlugin[method]?.call(
      shikitor,
      // @ts-ignore
      ...args
    ))
  }
  let prevPluginSnapshots = snapshot(pluginsRef).current
  scopeSubscribe(pluginsRef, async () => {
    const pluginSnapshots = snapshot(pluginsRef).current
    if (prevPluginSnapshots === pluginSnapshots) {
      return
    }
    const removedPlugins = prevPluginSnapshots.filter(p => !pluginSnapshots.find(pp => isSameSnapshot(p, pp)))
    removedPlugins.forEach(p => {
      const index = prevPluginSnapshots.indexOf(p)
      pluginsDisposes[index]?.dispose()
      pluginsDisposes.splice(index, 1)
      p.onDispose?.call(shikitor)
    })
    const newPlugins = pluginSnapshots.filter(p => !prevPluginSnapshots.find(pp => isSameSnapshot(p, pp)))
    await Promise.all(
      newPlugins.map(async plugin => {
        const dispose = await plugin.install?.call(shikitor, shikitor)
        pluginsDisposes.push(dispose)
      })
    )
    prevPluginSnapshots = pluginSnapshots
  })

  const dispose = () => {
    disposes.forEach(dispose => dispose())
    disposeAllPlugins()
    onDispose?.()
    callAllShikitorPlugins('onDispose')
  }

  scopeWatch(get => {
    const {
      readOnly,
      lineNumbers = 'on'
    } = get(derive({
      readOnly: get => get(optionsRef).current.readOnly,
      lineNumbers: get => get(optionsRef).current.lineNumbers
    }))
    target.classList.toggle('line-numbers', lineNumbers === 'on')
    target.classList.toggle('read-only', readOnly === true)
  })
  let highlighter: ReturnType<typeof getHighlighter> | undefined
  const highlighterDeps = derive({
    theme: get => get(optionsRef).current.theme,
    language: get => get(optionsRef).current.language
  })
  scopeWatch(async get => {
    const {
      theme = 'github-light',
      language = 'javascript'
    } = get(highlighterDeps)
    highlighter = getHighlighter({ themes: [theme], langs: [language] })
  })
  const outputRenderDeps = derive({
    theme: get => get(optionsRef).current.theme,
    language: get => get(optionsRef).current.language,
    decorations: get => get(optionsRef).current.decorations
  })
  scopeWatch(async get => {
    const value = get(valueRef).current
    const cursor = get(cursorRef).current
    const {
      theme = 'github-light',
      language = 'javascript',
      decorations
    } = get(outputRenderDeps)
    if (!highlighter || value === undefined) return

    const cursorLine = cursor?.line
    const { codeToHtml } = await highlighter
    output.innerHTML = codeToHtml(value, {
      lang: language,
      theme: theme,
      decorations,
      transformers: [
        shikitorStructureTransformer(target, cursorLine)
      ]
    })
  })
  let prevOutputHoverElement: Element | null = null
  input.addEventListener('mousemove', throttle(e => {
    input.style.pointerEvents = 'none'
    output.style.pointerEvents = 'auto'
    const outputHoverElement = document.elementFromPoint(e.clientX, e.clientY)
    input.style.pointerEvents = ''
    output.style.pointerEvents = ''
    if (outputHoverElement === prevOutputHoverElement) {
      return
    }
    prevOutputHoverElement = outputHoverElement
    if (outputHoverElement === null) {
      return
    }
    if (
      outputHoverElement.className.includes('shiki-editor')
      && outputHoverElement.className.includes('output')
    ) {
      return
    }

    if (!outputHoverElement?.className.includes('position')) {
      return
    }

    const offsetStr = /offset:(\d+)/
      .exec(outputHoverElement.className)
      ?.[1]
    if (!offsetStr) {
      return
    }
    const offset = Number(offsetStr)
    if (isNaN(offset)) {
      return
    }
    const [line, start, end] = /position:(\d+):(\d+),(\d+)/
      .exec(outputHoverElement.className)
      ?.slice(1)
      ?.map(Number)
    ?? []
    if (!line || !start || !end || [line, start, end].some(isNaN)) {
      return
    }

    callAllShikitorPlugins('onHoverElement', {
      start: { offset, line, character: start },
      end: { offset, line, character: end }
    }, {
      content: input.value.slice(start - 1, end - 1),
      element: outputHoverElement,
      raw: input.value
    })
  }, 50))

  function updateCursor() {
    const { resolvePosition } = shikitor.rawTextHelper
    const [start, end] = [input.selectionStart, input.selectionEnd]
    const selection = { start: resolvePosition(start), end: resolvePosition(end) }
    const pos = selection.start.offset !== prevSelection?.start.offset
      ? selection.start
      : selection.end
    if (optionsRef.current.cursor?.offset !== pos.offset) {
      optionsRef.current.cursor = resolvePosition(pos)
    }
    prevSelection = selection
  }
  const offDocumentSelectionChange = listen(document, 'selectionchange', () => {
    if (document.getSelection()?.focusNode === target) {
      updateCursor()
    }
  })
  input.addEventListener('keydown', e => {
    callAllShikitorPlugins('onKeydown', e as _KeyboardEvent)
    if (e.key === 'Escape' && !isMultipleKey(e)) {
      const cursor = cursorRef.current
      if (input.selectionStart !== input.selectionEnd && cursor) {
        e.preventDefault()
        input.setSelectionRange(cursor.offset, cursor.offset)
      }
    }
    // The Chrome browser never fires a selectionchange event when backspace or delete is pressed.
    // So we need to handle this case separately.
    // https://issues.chromium.org/41321247
    // https://issues.chromium.org/41399759
    if (isWhatBrowser('chrome')) {
      if (['Backspace', 'Delete', 'Enter'].includes(e.key) && !isMultipleKey(e)) {
        const s = { start: input.selectionStart, end: input.selectionEnd }
        setTimeout(() => {
          if (s.start !== input.selectionStart || s.end !== input.selectionEnd) {
            input.setSelectionRange(input.selectionStart, input.selectionEnd)
            document.dispatchEvent(new Event('selectionchange'))
          }
        }, 10)
      }
    }
  })
  input.addEventListener('keyup', callAllShikitorPlugins.bind(null, 'onKeyup'))
  input.addEventListener('keypress', callAllShikitorPlugins.bind(null, 'onKeypress'))
  input.addEventListener('scroll', () => {
    output.scrollTop = input.scrollTop
    output.scrollLeft = input.scrollLeft
  })

  const shikitor: Shikitor = {
    get value() {
      return valueRef.current
    },
    set value(value) {
      optionsRef.current.value = value
    },
    get options() {
      return snapshot(optionsRef).current
    },
    set options(newOptions) {
      this.updateOptions(newOptions)
    },
    async updateOptions(newOptions) {
      const {
        cursor,
        plugins,
        ...resolvedOptions
      } = callUpdateDispatcher(newOptions, this.options) ?? {}
      let newCursor = optionsRef.current.cursor
      if (cursor?.offset !== newCursor?.offset) {
        newCursor = cursor
      }
      optionsRef.current = {
        ...resolvedOptions,
        cursor: newCursor,
        plugins: await resolveInputPlugins(plugins ?? [])
      }
    },
    get language() {
      return this.options.language
    },
    set language(language) {
      this.updateLanguage(language)
    },
    updateLanguage(language) {
      const newLanguage = callUpdateDispatcher(language, this.language)
      if (newLanguage === undefined) {
        return
      }
      optionsRef.current.language = newLanguage
    },
    get cursor() {
      return cursorRef.current!
    },
    focus(cursor) {
      const { resolvePosition } = this.rawTextHelper
      const resolvedStartPos = resolvePosition(cursor ?? 0)
      input.setSelectionRange(
        resolvedStartPos.offset, resolvedStartPos.offset
      )
      input.focus()
    },
    get selections() {
      if (prevSelection === undefined) {
        updateCursor()
      }
      return [prevSelection!]
    },
    get rawTextHelper() {
      return rawTextHelperRef.current
    },
    updateSelection(index, selectionOrGetSelection) {
      const { selections } = this
      if (index < 0 || index >= selections.length) {
        return
      }
      const selectionT0 = selections[index]
      const selectionT1 = callUpdateDispatcher(selectionOrGetSelection, selectionT0)
      if (selectionT1 === undefined) {
        return
      }

      const { resolvePosition } = this.rawTextHelper
      const prevResolvedPrevSelection = {
        start: resolvePosition(selectionT0.start),
        end: resolvePosition(selectionT0.end)
      }
      const resolvedSelection = {
        start: resolvePosition(selectionT1.start),
        end: resolvePosition(selectionT1.end)
      }
      if ([
        prevResolvedPrevSelection.start.offset !== resolvedSelection.start.offset,
        prevResolvedPrevSelection.end.offset !== resolvedSelection.end.offset
      ].some(Boolean)) {
        // TODO
        // options.onSelectionChange?.(selection)
        // callAllShikitorPlugins('onSelectionChange', selection)
        prevSelection = resolvedSelection
      }
      input.setSelectionRange(resolvedSelection.start.offset, resolvedSelection.end.offset)
    },
    async upsertPlugin(plugin, index) {
      const p = await Promise.resolve(typeof plugin === 'function' ? plugin() : plugin)
      if (p === undefined) {
        throw new Error('Not provided plugin')
      }
      const plugins = pluginsRef.current
      const realIndex = index ?? plugins.length - 1
      if (realIndex < 0 || realIndex >= plugins.length) {
        throw new Error('Invalid index')
      }
      if (index === undefined) {
        plugins?.push(p)
      } else {
        plugins[realIndex]?.onDispose?.call(this)
        pluginsDisposes[realIndex]?.dispose()
        plugins?.splice(index, 1, p)
      }
      pluginsDisposes[realIndex] = await p.install?.call(this, this)
      return realIndex
    },
    async removePlugin(index) {
      const plugins = pluginsRef.current
      const p = plugins[index]
      if (p === undefined) {
        throw new Error(`Not found plugin at index ${index}`)
      }
      p.onDispose?.call(this)
      plugins[index]?.onDispose?.call(this)
      pluginsDisposes[index]?.dispose()
      plugins?.splice(index, 1)
    },
    dispose() {
      offDocumentSelectionChange()
      target.innerHTML = ''
      dispose()
    },
    registerPopupProvider(language, provider) {
      let providePopupsDispose: (() => void) | undefined
      let removeNewPopups: (() => void) | undefined
      let removeWatch: (() => void) | undefined
      function addPopups(npopups: ResolvedPopup[]) {
        popups.splice(0, popups.length, ...npopups)
        removeNewPopups = () => {
          const firstIndex = popups.indexOf(npopups[0])
          popups.splice(firstIndex, npopups.length)
        }
      }

      if (provider.position === 'relative') {
        const { providePopups, ...meta } = provider
        removeWatch = scopeWatch(async get => {
          const currentLanguage = snapshot(get(languageRef)).current
          const cursor = snapshot(get(cursorRef)).current
          // TODO use proxy ref
          const selection = prevSelection
          if (Array.isArray(language) && !language.includes(currentLanguage)) return
          if (typeof language === 'string' && language !== '*' && language === currentLanguage) return

          providePopupsDispose?.()
          const cursors = cursor ? [cursor] : []
          const selections = selection ? [selection] : []
          const { dispose, popups: newPopups } = await providePopups(cursors, selections)
          providePopupsDispose = dispose

          addPopups(newPopups.map(popup => ({
            ...popup,
            ...meta,
            cursors,
            selections,
            id: `${currentLanguage}:${popup.id}`
          })))
        })
      }
      if (provider.position === 'absolute') {
        const { providePopups, ...meta } = provider
        removeWatch = scopeWatch(async get => {
          const currentLanguage = get(languageRef).current
          if (Array.isArray(language) && !language.includes(currentLanguage)) return
          if (typeof language === 'string' && language !== '*' && language === currentLanguage) return

          providePopupsDispose?.()
          const { dispose, popups: newPopups } = await providePopups()
          providePopupsDispose = dispose

          addPopups(newPopups.map(popup => ({
            ...popup,
            ...meta,
            id: `${currentLanguage}:${popup.id}`
          })))
        })
      }
      return {
        dispose() {
          removeWatch?.()
          providePopupsDispose?.()
          removeNewPopups?.()
        }
      }
    },

    _getCursorAbsolutePosition(cursor): { x: number, y: number } {
      const { rawTextHelper: { line } } = this
      const span = document.createElement('span')
      span.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow-wrap: break-word;
      `
      const style = getComputedStyle(input);
      ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'textTransform', 'letterSpacing'].forEach(prop => {
        // @ts-ignore
        span.style[prop] = style[prop]
      })
      const text = '\n'.repeat(cursor.line - 1) + line(cursor).substring(0, cursor.character)
      const inTheLineStart = cursor.character === 0
      span.textContent = inTheLineStart ? text + ' ' : text
      document.body.appendChild(span)
      const rect = span.getBoundingClientRect()
      document.body.removeChild(span)
      const inputStyle = getComputedStyle(input)
      const left = parseInt(inputStyle.marginLeft) + parseInt(inputStyle.paddingLeft)
      const top = parseInt(inputStyle.marginTop) + parseInt(inputStyle.paddingTop)
      return {
        x: (
          inTheLineStart ? 0 : rect.right
        ) + left,
        y: rect.bottom + top
      }
    }
  }
  let pluginsDisposes = await Promise.all(
    callAllShikitorPlugins('install', shikitor)
  )
  function disposeAllPlugins() {
    pluginsDisposes.forEach(({ dispose } = { dispose: () => void 0 }) => dispose())
    pluginsDisposes = []
  }
  return shikitor
}
