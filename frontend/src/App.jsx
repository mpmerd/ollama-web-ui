import { useEffect, useCallback } from 'react'
import useStore from './store/useStore'
import Layout from './components/Layout'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import SettingsPanel from './components/SettingsPanel'
import ErrorToast from './components/ErrorToast'

export default function App() {
  const {
    loadModels, loadConversations, fetchStats,
    sidebarOpen, settingsOpen, toggleSettings,
    error, clearError,
  } = useStore()

  // ── Init on mount ──
  useEffect(() => {
    loadModels()
    loadConversations()
    fetchStats()
    // Periodic stats refresh
    const interval = setInterval(() => fetchStats(), 10000)
    return () => clearInterval(interval)
  }, [])

  // ── Keyboard shortcut: Ctrl+B toggles sidebar ──
  const handleKeyDown = useCallback((e) => {
    if (e.ctrlKey && e.key === 'b') {
      e.preventDefault()
      useStore.getState().toggleSidebar()
    }
    if (e.key === 'Escape' && settingsOpen) {
      toggleSettings()
    }
  }, [settingsOpen, toggleSettings])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <Layout>
      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-30 w-72 bg-surface-800 border-r border-surface-700
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex-shrink-0
      `}>
        <Sidebar />
      </div>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => useStore.getState().toggleSidebar()}
        />
      )}

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full">
        <ChatView />
      </main>

      {/* Settings Panel overlay */}
      {settingsOpen && <SettingsPanel />}

      {/* Error toast */}
      {error && <ErrorToast message={error} onClose={clearError} />}
    </Layout>
  )
}
