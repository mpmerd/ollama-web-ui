export default function Layout({ children }) {
  return (
    <div className="h-screen flex overflow-hidden bg-surface-900">
      {children}
    </div>
  )
}
