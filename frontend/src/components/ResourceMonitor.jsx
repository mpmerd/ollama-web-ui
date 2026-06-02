import { useEffect, useState } from 'react'
import useStore from '../store/useStore'
import * as api from '../api'

export default function ResourceMonitor() {
  const { stats, modelStatus, models } = useStore()
  const [ram, setRam] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      try { setRam(await api.fetchRamStatus()) } catch {}
    }
    fetch()
    const i = setInterval(fetch, 15000)
    return () => clearInterval(i)
  }, [])

  const loadedCount = models.filter((m) => modelStatus[m.name]?.loaded).length

  return (
    <div className="border-t border-surface-700 pt-2 mt-1 space-y-1.5">
      {/* Model slots */}
      <div className="flex items-center justify-between text-[10px] text-gray-500 px-1">
        <span>Models loaded</span>
        <span className="font-mono">
          {loadedCount}/{stats?.max_loaded_models ?? '?'}
        </span>
      </div>

      {/* Model slot indicators */}
      <div className="flex gap-1 px-1">
        {Array.from({ length: stats?.max_loaded_models || 2 }).map((_, i) => (
          <div key={i} className={`flex-1 h-1 rounded-full ${
            i < loadedCount ? 'bg-indigo-500' : 'bg-surface-700'
          }`} />
        ))}
      </div>

      {/* RAM bar */}
      {ram && ram.available && (
        <div className="space-y-0.5 px-1 mt-1">
          <div className="flex justify-between text-[10px]">
            <span className={`font-mono ${ram.warning ? 'text-amber-400' : 'text-gray-500'}`}>
              RAM {ram.percent}%
            </span>
            <span className="text-gray-600">{ram.available_mb}MB free</span>
          </div>
          <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                ram.critical ? 'bg-red-500' : ram.warning ? 'bg-amber-500' : 'bg-indigo-500/50'
              }`}
              style={{ width: `${Math.min(ram.percent, 100)}%` }}
            />
          </div>
          {ram.warning && (
            <p className="text-[9px] text-amber-400/80 leading-tight">
              ⚠️ High RAM usage ({ram.percent}%). Close idle conversations.
            </p>
          )}
        </div>
      )}

      {/* GPU info */}
      {stats?.gpu?.nvidia && stats.gpu.nvidia.length > 0 && (
        <div className="space-y-0.5">
          {stats.gpu.nvidia.map((gpu) => (
            <div key={gpu.index} className="flex items-center gap-1 text-[10px] text-gray-500 px-1">
              <span className="shrink-0">{gpu.name?.split(' ').slice(0, 2).join(' ')}</span>
              <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500/50 rounded-full transition-all"
                  style={{ width: `${((gpu.memory_used_mib / gpu.memory_total_mib) * 100).toFixed(1)}%` }} />
              </div>
              <span className="shrink-0 font-mono">
                {((gpu.memory_used_mib / gpu.memory_total_mib) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
