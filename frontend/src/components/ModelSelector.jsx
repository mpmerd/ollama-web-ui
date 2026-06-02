import useStore from '../store/useStore'

export default function ModelSelector() {
  const {
    models, selectedModel, selectModel,
    modelStatus, forceUnloadModel, loadModel,
    isStreaming,
  } = useStore()

  const selected = models.find((m) => m.name === selectedModel)
  const status = modelStatus[selectedModel] || {}

  const handleChange = async (e) => {
    const name = e.target.value
    if (!name) return
    selectModel(name)
    // If we switched to a model, try to load it
    if (!status.loaded) {
      await loadModel(name)
    }
  }

  const handleUnload = async (e) => {
    e.stopPropagation()
    await forceUnloadModel(selectedModel)
  }

  const handleLoad = async (e) => {
    e.stopPropagation()
    await loadModel(selectedModel)
  }

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
        Active Model
      </label>

      <select
        value={selectedModel || ''}
        onChange={handleChange}
        disabled={isStreaming}
        className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        <option value="" disabled>
          {models.length === 0 ? 'No models found' : 'Select a model...'}
        </option>
        {models.map((m) => (
          <option key={m.name} value={m.name}>
            {m.name} ({m.size_human})
          </option>
        ))}
      </select>

      {/* Model status badge */}
      {selected && (
        <div className="flex items-center gap-2 px-1 pt-1">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              status.loaded ? 'bg-green-500' : 'bg-gray-600'
            }`}
          />
          <span className="text-xs text-gray-400">
            {status.loaded ? 'Loaded' : 'Unloaded'}
          </span>
          {status.remaining_seconds > 0 && (
            <span className="text-xs text-gray-500">
              · {status.remaining_minutes}m remaining
            </span>
          )}
          {status.active_conversations > 0 && (
            <span className="text-xs text-indigo-400">
              · {status.active_conversations} active
            </span>
          )}

          {/* Action buttons */}
          {status.loaded ? (
            <button
              onClick={handleUnload}
              className="ml-auto text-xs text-red-400 hover:text-red-300 transition-colors"
              title="Force unload model from memory"
            >
              Unload
            </button>
          ) : (
            <button
              onClick={handleLoad}
              className="ml-auto text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              title="Load model into memory"
            >
              Load
            </button>
          )}
        </div>
      )}

      {/* Show model details */}
      {selected && (
        <details className="px-1 pt-0.5">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
            Details
          </summary>
          <div className="mt-1 space-y-0.5 text-xs text-gray-500">
            <div>Size: {selected.size_human}</div>
            {selected.details?.parameter_size && (
              <div>Parameters: {selected.details.parameter_size}</div>
            )}
            {selected.details?.quantization_level && (
              <div>Quantization: {selected.details.quantization_level}</div>
            )}
            {selected.details?.families && (
              <div>Family: {selected.details.families?.join(', ')}</div>
            )}
          </div>
        </details>
      )}
    </div>
  )
}
