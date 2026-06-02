/**
 * API client for communicating with the FastAPI backend.
 */

const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res
}

export async function fetchModels() {
  const res = await request('/models')
  return (await res.json()).models
}

export async function fetchModelStatus() {
  const res = await request('/models/status')
  return res.json()
}

export async function loadModel(name) {
  await request('/models/load', {
    method: 'POST',
    body: JSON.stringify({ model: name }),
  })
}

export async function unloadModel(name) {
  await request('/models/unload', {
    method: 'POST',
    body: JSON.stringify({ model: name }),
  })
}

export async function chatStream(conversationId, model, message, options = {}) {
  const body = {
    conversation_id: conversationId || undefined,
    model,
    message,
    system_prompt: options.systemPrompt || '',
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
    images: options.images || [],
    files: options.files || [],
  }
  const res = await request('/chat/send', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return res
}

export async function uploadFile(file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${BASE}/chat/upload`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error('Upload failed')
  return res.json()
}

export async function listConversations() {
  const res = await request('/conversations')
  return (await res.json()).conversations
}

export async function getConversation(id) {
  const res = await request(`/conversations/${encodeURIComponent(id)}`)
  return res.json()
}

export async function createConversation({ model, systemPrompt, temperature, maxTokens }) {
  const res = await request('/conversations', {
    method: 'POST',
    body: JSON.stringify({
      model,
      system_prompt: systemPrompt || '',
      temperature: temperature ?? 0.7,
      max_tokens: maxTokens ?? 2048,
    }),
  })
  return (await res.json()).conversation_id
}

export async function deleteConversation(id) {
  await request(`/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function exportConversation(id) {
  const res = await request(`/conversations/${encodeURIComponent(id)}/export`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `conversation-${id.slice(0, 8)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importConversation(file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${BASE}/conversations/import`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Import failed' }))
    throw new Error(err.detail)
  }
  return res.json()
}

export async function fetchSystemStats() {
  const res = await request('/system/stats')
  return res.json()
}

export async function fetchRamStatus() {
  const res = await request('/system/ram')
  return res.json()
}

export async function fetchSettings() {
  const res = await request('/system/settings')
  return res.json()
}

export async function updateSettings(settings) {
  await request('/system/settings', {
    method: 'POST',
    body: JSON.stringify(settings),
  })
}
