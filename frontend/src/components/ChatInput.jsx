import { useState, useRef, useCallback, useEffect } from 'react'
import useStore from '../store/useStore'
import * as api from '../api'

export default function ChatInput() {
  const [text, setText] = useState('')
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const imageInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const { sendMessage, isStreaming, stopStreaming, selectedModel, activeConversationId,
    uploadedFiles, addFile, removeFile, clearFiles, models } = useStore()

  // Check if current model supports images
  const modelInfo = models.find(m => m.name === selectedModel)
  const supportsImages = modelInfo?.supports_images || false

  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 200) + 'px'
    }
  }, [text])

  const handleKeyDown = useCallback(
    (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSend()
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [text, isStreaming, selectedModel],
  )

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      try {
        const result = await api.uploadFile(file)
        addFile(result)
      } catch (err) {
        console.error('Upload failed:', err)
      }
    }
    setUploading(false)
    e.target.value = ''
  }

  const handleSend = async () => {
    const trimmed = text.trim()
    if ((!trimmed && uploadedFiles.length === 0) || isStreaming || !selectedModel) return

    setText('')
    if (!activeConversationId) {
      await useStore.getState().newConversation()
    }
    await sendMessage(trimmed)
  }

  const disabled = !selectedModel

  return (
    <div className="shrink-0 border-t border-surface-700 bg-surface-800/80 backdrop-blur-sm px-4 py-3">
      <div className="max-w-3xl mx-auto">
        {/* File previews */}
        {uploadedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {uploadedFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-surface-700 border border-surface-600 rounded-lg px-2 py-1 text-xs">
                <span className="text-gray-400">
                  {f.type === 'image' ? '🖼️' : '📄'}
                </span>
                <span className="text-gray-300 max-w-[150px] truncate">{f.filename}</span>
                <button onClick={() => removeFile(i)} className="text-gray-500 hover:text-red-400 ml-1">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 bg-surface-700 rounded-2xl border border-surface-600 px-4 py-2 focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500 transition-all">
          {/* File upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isStreaming}
            className="shrink-0 p-1.5 text-gray-400 hover:text-indigo-300 disabled:opacity-30 transition-colors rounded-lg"
            title="Upload file (txt, md, csv, py, json, log...)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          {/* Image upload button - only shown for vision models */}
          <button
            onClick={() => imageInputRef.current?.click()}
            disabled={disabled || isStreaming || !supportsImages}
            className={`shrink-0 p-1.5 transition-colors rounded-lg ${
              supportsImages
                ? 'text-gray-400 hover:text-indigo-300'
                : 'text-gray-700 cursor-not-allowed opacity-30'
            }`}
            title={supportsImages ? 'Upload image (vision model)' : 'Current model does not support images'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'Select a model first...' : 'Type a message... (Enter to send)'}
            disabled={disabled || isStreaming}
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-sm text-gray-100 placeholder-gray-500 max-h-[200px] disabled:opacity-40"
          />

          {uploading && (
            <svg className="w-4 h-4 animate-spin text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}

          {isStreaming ? (
            <button
              onClick={stopStreaming}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={disabled || (!text.trim() && uploadedFiles.length === 0) || uploading}
              className="shrink-0 p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          )}
        </div>

        {/* Hidden file inputs */}
        <input ref={fileInputRef} type="file" multiple accept=".txt,.md,.csv,.py,.js,.json,.html,.xml,.log,.pdf" onChange={handleFileUpload} className="hidden" />
        <input ref={imageInputRef} type="file" multiple accept="image/*" onChange={handleFileUpload} className="hidden" />

        <p className="text-[10px] text-gray-600 text-center mt-1.5">
          {selectedModel
            ? `Model: ${selectedModel}${supportsImages ? ' · 🖼️ Images supported' : ''}  ·  📎 files · Enter to send`
            : 'Select a model from the sidebar to start chatting'}
        </p>
      </div>
    </div>
  )
}
