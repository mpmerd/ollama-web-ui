import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

export default function MessageBubble({ message, isStreaming }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end max-w-3xl ml-auto">
        <div className="bg-indigo-700/60 text-gray-100 rounded-2xl rounded-br-sm px-5 py-3 max-w-[80%] shadow-sm">
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        </div>
      </div>
    )
  }

  // Assistant message
  return (
    <div className="flex items-start gap-3 max-w-3xl">
      <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 mt-1">
        <span className="text-xs">🤖</span>
      </div>
      <div className={`flex-1 min-w-0 ${isStreaming ? 'opacity-90' : ''}`}>
        <div className="prose prose-sm text-gray-200 max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '')
                const codeStr = String(children).replace(/\n$/, '')
                if (match) {
                  return (
                    <CodeBlock
                      language={match[1]}
                      code={codeStr}
                      isStreaming={isStreaming}
                    />
                  )
                }
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                )
              },
              pre({ children }) {
                return <>{children}</>
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

function CodeBlock({ language, code, isStreaming }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group my-3">
      <div className="flex items-center justify-between px-4 py-1.5 bg-surface-700 rounded-t-lg border-b border-surface-600">
        <span className="text-xs text-gray-400">{language}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-500 hover:text-white transition-colors px-2 py-0.5 rounded"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: '0.5rem',
          borderBottomRightRadius: '0.5rem',
          fontSize: '0.8rem',
          background: '#1e293b',
        }}
        wrapLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}
