import useStore from '../store/useStore'

export default function ConversationList() {
  const {
    conversations, activeConversationId,
    loadConversation, deleteConversation, exportActiveConversation,
  } = useStore()

  if (conversations.length === 0) {
    return (
      <div className="text-xs text-gray-600 text-center py-6">
        No conversations yet. Start a new chat!
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          className={`
            group flex items-center gap-1 rounded-lg px-3 py-2 cursor-pointer text-sm transition-colors
            ${conv.id === activeConversationId
              ? 'bg-indigo-900/40 text-indigo-200'
              : 'text-gray-300 hover:bg-surface-700/60'
            }
          `}
          onClick={() => loadConversation(conv.id)}
        >
          <svg className="w-3.5 h-3.5 shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="flex-1 truncate text-xs">
            {conv.title || 'New Chat'}
          </span>
          <span className="text-[10px] text-gray-600 shrink-0 hidden group-hover:block">
            {conv.model?.split(':')[0]}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              deleteConversation(conv.id)
            }}
            className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-500 hover:text-red-400 transition-all shrink-0"
            title="Delete conversation"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
