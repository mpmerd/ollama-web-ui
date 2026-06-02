import { useState, useRef, useCallback } from 'react'
import useStore from '../store/useStore'
import ModelSelector from './ModelSelector'
import ConversationList from './ConversationList'
import ResourceMonitor from './ResourceMonitor'

export default function Sidebar() {
  const { toggleSettings, loadModels, modelsLoading, toggleSidebar } = useStore()
  const fileInputRef = useRef(null)

  const handleImport = useCallback((e) => {
    const file = e.target.files?.[0]
    if (file) {
      useStore.getState().importConversation(file)
    }
    e.target.value = ''
  }, [])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-surface-700 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <h1 className="font-semibold text-sm text-gray-100">Ollama UI</h1>
        </div>
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-1 text-gray-400 hover:text-white rounded"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {/* New Chat Button */}
        <button
          onClick={() => useStore.getState().newConversation()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>

        {/* Model Selector */}
        <ModelSelector />

        {/* Conversations */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 mb-2">
            Conversations
          </h2>
          <ConversationList />
        </div>
      </div>

      {/* Bottom actions */}
      <div className="border-t border-surface-700 p-2 space-y-1 shrink-0">
        {/* Refresh models */}
        <button
          onClick={loadModels}
          disabled={modelsLoading}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-surface-700 transition-colors disabled:opacity-50"
        >
          <svg className={`w-3.5 h-3.5 ${modelsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Models
        </button>

        {/* Import conversation */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-surface-700 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
          Import Chat
        </button>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />

        {/* Settings */}
        <button
          onClick={toggleSettings}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-surface-700 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </button>

        {/* Resource Monitor */}
        <ResourceMonitor />
      </div>
    </div>
  )
}
