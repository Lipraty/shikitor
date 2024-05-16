import './index.scss'

import type { Shikitor } from '@shikitor/core'
import provideCompletions from '@shikitor/core/plugins/provide-completions'
import providePopup from '@shikitor/core/plugins/provide-popup'
import provideSelectionToolbox from '@shikitor/core/plugins/provide-selection-toolbox'
import selectionToolboxForMd from '@shikitor/core/plugins/selection-toolbox-for-md'
import { WithoutCoreEditor } from '@shikitor/react'
import type { ClientOptions } from 'openai'
import OpenAI from 'openai'
import React, { useMemo, useRef, useState } from 'react'
import type { BundledLanguage, BundledTheme } from 'shiki'
import { Avatar, Button, Input, MessagePlugin, Select } from 'tdesign-react'

import { useQueries } from '#hooks/useQueries.tsx'
import { useShikitorCreate } from '#hooks/useShikitorCreate.ts'

import atUser from './plugins/at-user'

const bundledPlugins = [
  providePopup,
  provideCompletions({
    popupPlacement: 'top',
    footer: false
  }),
  atUser({
    targets: ['Shikitor', 'YiJie', 'ShikitorBot']
  }),
  provideSelectionToolbox,
  selectionToolboxForMd
]

export default function Messenger() {
  const {
    value: {
      theme = 'github-dark'
    }
  } = useQueries<{
    theme: BundledTheme
    language: BundledLanguage
  }>()
  const [text, setText] = useState('')

  const storageConfig = JSON.parse(
    localStorage.getItem('openai-config') ?? '{ "baseURL": "https://api.openai.com/v1" }'
  )
  const [config, setConfig] = useState(
    {
      ...storageConfig,
      dangerouslyAllowBrowser: true
    } as ClientOptions
  )
  const openaiRef = useRef<OpenAI | null>(null)
  function createOpenAI() {
    if (!config.apiKey || !config.baseURL) return
    openaiRef.current = new OpenAI(config)
  }
  openaiRef.current === null && createOpenAI()

  const [messages, setMessages] = useState<OpenAI.ChatCompletionMessageParam[]>([
    {
      role: 'system',
      content: 'You are a shikitor document helper bot. You can ask me anything about shikitor.'
    }
  ])
  const filteredMessages = useMemo(() => messages.filter(({ role }) => role !== 'system'), [messages])
  const sendMessage = async (message: string) => {
    let newMessages = [...messages, {
      role: 'user',
      content: message
    }] satisfies OpenAI.ChatCompletionMessageParam[]
    setMessages(newMessages)
    setText('')
    if (!openaiRef.current) {
      await MessagePlugin.error('OpenAI not initialized')
      return
    }
    const completions = await openaiRef.current.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: newMessages,
      stream: true
    })
    newMessages = [...newMessages, { role: 'assistant', content: 'Thinking...' }]
    setMessages(newMessages)
    const streamMessage = {
      role: 'assistant',
      content: ''
    } satisfies OpenAI.ChatCompletionMessageParam
    for await (const { choices: [{ delta }] } of completions) {
      streamMessage.content += delta.content ?? ''
      newMessages[newMessages.length - 1] = streamMessage
      setMessages([...newMessages])
    }
  }

  const shikitorRef = useRef<Shikitor>(null)
  const shikitorCreate = useShikitorCreate()
  return (
    <div className='chatroom'>
      <div className='messages'>
        {filteredMessages.length > 0
          ? filteredMessages.map((message, i) => (
            <div key={i} className='message'>
              {{
                'system': () => <></>,
                'tool': () => <></>,
                'function': () => <></>,
                'user': () => (
                  <>
                    <Avatar size='small'>
                      YiJie
                    </Avatar>
                    {message.content}
                  </>
                ),
                'assistant': () => (
                  <>
                    <Avatar
                      size='small'
                      image={`${import.meta.env.BASE_URL}public/favicon.svg`}
                    />
                    {message.content}
                  </>
                )
              }[message.role]?.()}
            </div>
          ))
          : (
            <div className='config'>
              <div className='config-item'>
                <label>API Key</label>
                <Input value={config.apiKey} onChange={v => setConfig(old => ({ ...old, apiKey: v }))} />
              </div>
              <div className='config-item'>
                <label>Base URL</label>
                <Select
                  filterable
                  creatable
                  options={[
                    { label: 'OpenAI', value: 'https://api.openai.com/v1' },
                    { label: 'AIProxy', value: 'https://api.aiproxy.io/v1' }
                  ]}
                  value={config.baseURL ?? ''}
                  onChange={v => setConfig(old => ({ ...old, baseURL: v as string }))}
                />
              </div>
              <Button
                style={{
                  marginTop: 8
                }}
                onClick={() => {
                  createOpenAI()
                  localStorage.setItem('openai-config', JSON.stringify(config))
                }}
              >
                Confirm
              </Button>
            </div>
          )}
      </div>
      <div className='message-sender'>
        <Avatar size='small'>YiJie</Avatar>
        <WithoutCoreEditor
          ref={shikitorRef}
          create={shikitorCreate}
          value={text}
          onChange={setText}
          options={useMemo(() => ({
            theme,
            language: 'markdown',
            lineNumbers: 'off',
            placeholder: 'Typing here...',
            autoSize: { maxRows: 10 }
          }), [theme])}
          plugins={bundledPlugins}
          onColorChange={({ bg, fg }) => {
            const style = document.documentElement.style
            style.setProperty('--bg', bg)
            style.setProperty('--fg', fg)
            const hoverColor = `color-mix(in srgb, ${fg}, ${bg} 10%)`
            style.setProperty('--hover', hoverColor)
          }}
          onMounted={shikitor => shikitor.focus()}
          onKeydown={e => {
            if (e.key === 'Enter' && e.metaKey && text.length !== 0) {
              e.preventDefault()
              sendMessage(text)
              return
            }
          }}
        />
        <div className='send-tooltip'>
          <kbd>⌘ enter</kbd>
        </div>
      </div>
    </div>
  )
}
