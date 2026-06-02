import { useRef, useEffect } from 'react'
import useStore from '../store/useStore'
import MessageBubble from './MessageBubble'
import ChatInput from './ChatInput'

export default function ChatView() {
  const {
    messages, streamingMessage, streamingThinking, isStreaming, selectedModel,
    activeConversationId, conversationLoading, modelsLoading,
    toggleSidebar, toggleSettings, exportActiveConversation,
    sidebarOpen, loadingStatus,
  } = useStore()
  const bottomRef = useRef(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingMessage])

  // Empty state: no conversation selected
  if (!activeConversationId && !selectedModel) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 p-8">
          <div className="text-6xl">🤖</div>
          <h2 className="text-xl font-semibold text-gray-300">Welcome to Ollama Web UI</h2>
          <p className="text-gray-500 max-w-md">
            Select a model from the sidebar and start a new conversation.
          </p>
          {modelsLoading && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading models...
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top bar */}
      <div className="shrink-0 px-4 py-3 border-b border-surface-700 bg-surface-800/80 backdrop-blur-sm flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-surface-700"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-100 truncate block">
            {selectedModel || 'No model selected'}
          </span>
          {activeConversationId && (
            <span className="text-xs text-gray-500">
              {messages.length} messages
            </span>
          )}
        </div>

        {/* Export */}
        {activeConversationId && (
          <button
            onClick={exportActiveConversation}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-surface-700 transition-colors"
            title="Export conversation"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
        )}

        {/* Settings gear */}
        <button
          onClick={toggleSettings}
          className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-surface-700 transition-colors"
          title="Settings"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37 2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {conversationLoading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="w-6 h-6 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : messages.length === 0 && !isStreaming ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-gray-500 text-sm">Send a message to start the conversation.</p>
            <p className="text-gray-600 text-xs mt-1">The model will be loaded lazily on your first message.</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Streaming message */}
            {isStreaming && streamingMessage && (
              <MessageBubble
                message={{ role: 'assistant', content: streamingMessage, id: 'streaming' }}
                isStreaming
              />
            )}

            {/* Thinking indicator (Gemma4 / reasoning models) */}
            {isStreaming && streamingThinking && !streamingMessage && (
              <div className="flex items-start gap-3 max-w-3xl">
                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 mt-1">
                  <span className="text-xs">🤖</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-indigo-400/60 italic mb-1">🧠 Thinking...</p>
                  <p className="text-xs text-gray-500/60 italic leading-relaxed whitespace-pre-wrap">{streamingThinking}</p>
                </div>
              </div>
            )}

            {/* Loading status (model loading progress) */}
            {isStreaming && !streamingMessage && loadingStatus && (
              <div className="flex items-start gap-3 max-w-3xl">
                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 mt-1">
                  <span className="text-xs">🤖</span>
                </div>
                <div className="flex items-center gap-2 py-3">
                  <svg className="w-4 h-4 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm text-indigo-300">{loadingStatus}</span>
                </div>
              </div>
            )}

            {/* Typing indicator (before any tokens arrive, no loading status) */}
            {isStreaming && !streamingMessage && !loadingStatus && (
              <div className="flex items-start gap-3 max-w-3xl">
                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                  <span className="text-xs">🤖</span>
                </div>
                <div className="flex items-center gap-1.5 py-3">
                  <span className="typing-dot w-2 h-2 bg-indigo-400 rounded-full inline-block" />
                  <span className="typing-dot w-2 h-2 bg-indigo-400 rounded-full inline-block" />
                  <span className="typing-dot w-2 h-2 bg-indigo-400 rounded-full inline-block" />
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <ChatInput />
    </div>
  )
}
