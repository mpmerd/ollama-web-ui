import useStore from '../store/useStore'

export default function SettingsPanel() {
  const {
    settings, updateSettings, toggleSettings, stats,
  } = useStore()

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={toggleSettings}
      />

      {/* Panel */}
      <div className="relative z-10 bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37 2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </h2>
          <button
            onClick={toggleSettings}
            className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-surface-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5">
          {/* Temperature */}
          <SettingSlider
            label="Temperature"
            value={settings.temperature}
            min={0}
            max={2}
            step={0.1}
            help="Controls randomness. Lower = deterministic, higher = creative."
            onChange={(v) => updateSettings({ temperature: v })}
          />

          {/* Max Tokens */}
          <SettingSlider
            label={`Max Tokens (model context: ${(settings._contextLength || 8192).toLocaleString()})`}
            value={settings.maxTokens}
            min={64}
            max={settings._contextLength || 8192}
            step={64}
            help="Maximum length of the generated response. Capped to the model's context length."
            onChange={(v) => updateSettings({ maxTokens: v })}
          />

          {/* Model Timeout */}
          <SettingSlider
            label="Auto-unload timeout (minutes)"
            value={settings.modelTimeout}
            min={1}
            max={120}
            step={1}
            help="Minutes of inactivity before a model is unloaded from memory."
            onChange={(v) => updateSettings({ modelTimeout: v })}
          />

          {/* Max loaded models */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">Max loaded models</label>
              <span className="text-xs font-mono text-indigo-400 bg-indigo-900/40 px-2 py-0.5 rounded">
                {settings.maxLoadedModels || 2}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={1}
              value={settings.maxLoadedModels || 2}
              onChange={(e) => updateSettings({ maxLoadedModels: parseInt(e.target.value) })}
              className="w-full mt-1 accent-indigo-500 cursor-pointer"
            />
            <p className="text-xs text-gray-500 mt-0.5">
              How many models can stay loaded at once. Oldest inactive model is evicted when full.
            </p>
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              System Prompt
            </label>
            <textarea
              value={settings.systemPrompt}
              onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
              placeholder="You are a helpful assistant..."
              rows={3}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Instructions that set the behavior of the model.
            </p>
          </div>

          {/* System Info */}
          <div className="border-t border-surface-700 pt-4 mt-4">
            <h3 className="text-sm font-medium text-gray-400 mb-2">System Info</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-surface-700 rounded-lg px-3 py-2">
                <span className="text-gray-500">Timeout</span>
                <p className="text-gray-200 font-mono">{stats?.model_timeout_minutes ?? '?'} min</p>
              </div>
              <div className="bg-surface-700 rounded-lg px-3 py-2">
                <span className="text-gray-500">Keep Alive</span>
                <p className="text-gray-200 font-mono">{stats?.ollama_keep_alive ?? '?'}</p>
              </div>
            </div>
            {stats?.memory && (
              <div className="mt-2 bg-surface-700 rounded-lg px-3 py-2 text-xs">
                <span className="text-gray-500">RAM</span>
                <p className="text-gray-200 font-mono">
                  {stats.memory.available || 'N/A'} available
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingSlider({ label, value, min, max, step, help, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-300">{label}</label>
        <span className="text-xs font-mono text-indigo-400 bg-indigo-900/40 px-2 py-0.5 rounded">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full mt-1 accent-indigo-500 cursor-pointer"
      />
      {help && <p className="text-xs text-gray-500 mt-0.5">{help}</p>}
    </div>
  )
}
