/**
 * Zustand store — single source of truth for the entire app.
 */

import { create } from 'zustand'
import * as api from '../api'

const DEFAULT_SETTINGS = {
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: '',
  modelTimeout: 15,
  maxLoadedModels: 2,
  ollamaKeepAlive: '10m',
}

const useStore = create((set, get) => ({
  // ── Models ──
  models: [],
  modelsLoading: false,
  selectedModel: null,
  modelStatus: {},

  // ── Conversations ──
  conversations: [],
  activeConversationId: null,
  messages: [],
  conversationLoading: false,

  // ── Streaming ──
  isStreaming: false,
  streamingMessage: '',
  streamingThinking: '',
  streamingMessageId: null,
  loadingStatus: '',
  abortController: null,

  // ── UI state ──
  sidebarOpen: true,
  settingsOpen: false,
  error: null,
  stats: null,
  settings: { ...DEFAULT_SETTINGS },

  // ── Actions ──

  loadModels: async () => {
    set({ modelsLoading: true, error: null })
    try {
      const models = await api.fetchModels()
      set({ models, modelsLoading: false })
      if (!get().selectedModel && models.length > 0) {
        const first = models[0]
        const ctxLen = first?.context_length || 8192
        set({ selectedModel: first.name })
        set((s) => ({ settings: { ...s.settings, _contextLength: ctxLen } }))
      }
      // Also fetch model status
      const status = await api.fetchModelStatus()
      set({ modelStatus: status })
    } catch (e) {
      set({ modelsLoading: false, error: e.message })
    }
  },

  selectModel: (name) => {
    const { models } = get()
    const model = models.find(m => m.name === name)
    const ctxLen = model?.context_length || 8192
    set({ selectedModel: name })
    // Update maxTokens ceiling to match model's context length
    const currentMaxTokens = get().settings.maxTokens
    if (currentMaxTokens > ctxLen) {
      set({ settings: { ...get().settings, maxTokens: ctxLen } })
    }
    // Store contextLength separately for settings slider
    set((s) => ({ settings: { ...s.settings, _contextLength: ctxLen } }))
  },

  // ── Conversations ──

  loadConversations: async () => {
    try {
      const conversations = await api.listConversations()
      set({ conversations })
    } catch (e) {
      console.error('Failed to load conversations:', e)
    }
  },

  loadConversation: async (id) => {
    set({ conversationLoading: true, activeConversationId: id, error: null })
    try {
      const conv = await api.getConversation(id)
      // Update context length from model info
      const { models } = get()
      const modelInfo = models.find(m => m.name === conv.model)
      const ctxLen = modelInfo?.context_length || 8192
      set({
        messages: conv.messages || [],
        conversationLoading: false,
        // Sync settings from conversation
        settings: {
          ...get().settings,
          systemPrompt: conv.system_prompt || '',
          temperature: conv.temperature ?? 0.7,
          maxTokens: conv.max_tokens ?? 2048,
          _contextLength: ctxLen,
        },
        selectedModel: conv.model,
      })
    } catch (e) {
      set({ conversationLoading: false, error: e.message })
    }
  },

  newConversation: async () => {
    const { selectedModel, settings } = get()
    if (!selectedModel) return
    try {
      const id = await api.createConversation({
        model: selectedModel,
        systemPrompt: settings.systemPrompt,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
      })
      set({
        activeConversationId: id,
        messages: [],
        streamingMessage: '',
        streamingMessageId: null,
      })
      await get().loadConversations()
      return id
    } catch (e) {
      set({ error: e.message })
    }
  },

  deleteConversation: async (id) => {
    try {
      await api.deleteConversation(id)
      const { activeConversationId } = get()
      if (activeConversationId === id) {
        set({ activeConversationId: null, messages: [] })
      }
      await get().loadConversations()
    } catch (e) {
      set({ error: e.message })
    }
  },

  // ── Chat / Send ──

  uploadedFiles: [],

  addFile: (fileObj) => set((s) => ({ uploadedFiles: [...s.uploadedFiles, fileObj] })),
  removeFile: (idx) => set((s) => ({ uploadedFiles: s.uploadedFiles.filter((_, i) => i !== idx) })),
  clearFiles: () => set({ uploadedFiles: [] }),

  sendMessage: async (text) => {
    const { selectedModel, settings, activeConversationId, isStreaming, uploadedFiles } = get()
    if (!selectedModel || isStreaming || !text.trim()) return

    // Build display text with file indicators
    const files = [...uploadedFiles]
    let displayText = text
    if (files.length > 0) {
      displayText = text + '\n\n[Archivos adjuntos: ' + files.map(f => f.filename).join(', ') + ']'
    }

    // Add user message locally
    const userMsg = { role: 'user', content: displayText, id: Date.now().toString() }
    set((s) => ({ messages: [...s.messages, userMsg], uploadedFiles: [] }))

    // Start streaming
    const abortCtrl = new AbortController()
    set({
      isStreaming: true,
      streamingMessage: '',
      streamingMessageId: null,
      loadingStatus: '',
      abortController: abortCtrl,
      error: null,
    })

    try {
      const response = await api.chatStream(
        activeConversationId,
        selectedModel,
        text,
        {
          systemPrompt: settings.systemPrompt,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          files: files.map(f => ({ type: f.type, filename: f.filename, content: f.content, data_url: f.data_url })),
        },
      )

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let convId = activeConversationId

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = JSON.parse(line.slice(6))

          switch (payload.type) {
            case 'start':
              convId = payload.conversation_id
              set({
                activeConversationId: convId,
                streamingMessageId: payload.message_id,
              })
              break
            case 'thinking':
              set((s) => ({
                streamingThinking: s.streamingThinking + payload.content,
              }))
              break
            case 'token':
              // Clear thinking when first token arrives
              set((s) => ({
                streamingMessage: s.streamingMessage + payload.content,
                streamingThinking: '',
              }))
              break
            case 'status':
              set({ loadingStatus: payload.content })
              break
            case 'title':
              // Update conversation list with new title
              set((s) => ({
                conversations: s.conversations.map((c) =>
                  c.id === convId ? { ...c, title: payload.title } : c,
                ),
              }))
              break
            case 'error':
              set({ error: payload.content, isStreaming: false })
              return
            case 'done':
              // Add assistant message to list
              set((s) => ({
                messages: [
                  ...s.messages,
                  {
                    role: 'assistant',
                    content: s.streamingMessage,
                    id: s.streamingMessageId,
                  },
                ],
                isStreaming: false,
                streamingMessage: '',
                streamingThinking: '',
                streamingMessageId: null,
              }))
              // Refresh conversations
              get().loadConversations()
              return
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        set({ error: e.message })
      }
      set({ isStreaming: false, streamingMessage: '', streamingThinking: '' })
    }
  },

  stopStreaming: () => {
    const { abortController } = get()
    if (abortController) {
      abortController.abort()
      set({ isStreaming: false, streamingThinking: '', abortController: null })
    }
  },

  // ── Settings ──

  updateSettings: async (newSettings) => {
    set({ settings: { ...get().settings, ...newSettings } })
    try {
      await api.updateSettings({
        model_timeout_minutes: newSettings.modelTimeout ?? get().settings.modelTimeout,
        max_loaded_models: newSettings.maxLoadedModels ?? get().settings.maxLoadedModels,
        ollama_keep_alive: newSettings.ollamaKeepAlive ?? get().settings.ollamaKeepAlive,
        auth_token: '',
      })
    } catch (e) {
      console.error('Failed to save settings:', e)
    }
  },

  // ── System ──

  fetchStats: async () => {
    try {
      const stats = await api.fetchSystemStats()
      set({ stats })
    } catch (e) {
      // silent
    }
  },

  // ── UI ──

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  clearError: () => set({ error: null }),

  // ── Model management ──

  forceUnloadModel: async (name) => {
    try {
      await api.unloadModel(name)
      set((s) => ({
        modelStatus: { ...s.modelStatus, [name]: { loaded: false, last_activity: 0, remaining_seconds: 0 } },
      }))
    } catch (e) {
      set({ error: e.message })
    }
  },

  // ── Export / Import ──

  exportActiveConversation: () => {
    const { activeConversationId } = get()
    if (activeConversationId) {
      api.exportConversation(activeConversationId)
    }
  },

  importConversation: async (file) => {
    try {
      const result = await api.importConversation(file)
      await get().loadConversations()
      if (result.conversation_id) {
        await get().loadConversation(result.conversation_id)
      }
    } catch (e) {
      set({ error: e.message })
    }
  },
}))

export default useStore
