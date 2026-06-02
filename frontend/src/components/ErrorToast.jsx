import { useEffect } from 'react'

export default function ErrorToast({ message, onClose }) {
  // Auto-dismiss after 8 seconds
  useEffect(() => {
    const timer = setTimeout(onClose, 8000)
    return () => clearTimeout(timer)
  }, [message, onClose])

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md bg-red-900/90 border border-red-700 text-red-200 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-sm flex items-start gap-3">
      <svg className="w-5 h-5 mt-0.5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="text-sm flex-1">{message}</span>
      <button onClick={onClose} className="text-red-300 hover:text-white shrink-0">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
