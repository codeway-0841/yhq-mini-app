import { useState } from 'react'
import { Volume2, VolumeX, Play } from 'lucide-react'
import {
  BRILLIANT_SOUNDS,
  BRILLIANT_SOUND_GROUPS,
  playBrilliantSound,
  stopBrilliantSound,
  type BrilliantSoundGroupId,
  type BrilliantSoundId,
} from '../../shared/lib/brilliantSounds'
import { haptics } from '../../platform/haptics'
import { cn } from '../../shared/lib/cn'

interface BrilliantSoundLabProps {
  lang: 'uz' | 'ru'
}

/**
 * Brilliant.org rasmiy 26 ta `.mp3` tovush effektlarini jonli demo rejimida eshitib tekshirish paneli.
 */
export function BrilliantSoundLab({ lang }: BrilliantSoundLabProps) {
  const [activeGroup, setActiveGroup] = useState<BrilliantSoundGroupId | 'all'>('all')
  const [lastPlayed, setLastPlayed] = useState<BrilliantSoundId | null>(null)
  const [expanded, setExpanded] = useState(true)

  const handlePlay = (id: BrilliantSoundId) => {
    setLastPlayed(id)
    haptics.selection()
    void playBrilliantSound(id)
  }

  const visibleSounds =
    activeGroup === 'all'
      ? BRILLIANT_SOUNDS
      : BRILLIANT_SOUNDS.filter((s) => s.group === activeGroup)

  return (
    <section className="bg-pcard rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2.5 text-left min-w-0 cursor-pointer"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#3557ff]/12 text-pprimary">
            <Volume2 size={18} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <h2 className="text-[14px] font-extrabold text-pfg truncate">
              {lang === 'ru'
                ? `Звуки Brilliant 1:1 (${BRILLIANT_SOUNDS.length} .mp3)`
                : `Brilliant 1:1 Tovushlar (${BRILLIANT_SOUNDS.length} ta .mp3)`}
            </h2>
            <p className="text-[11.5px] text-pmuted truncate">
              {lastPlayed
                ? `${lang === 'ru' ? 'Играет' : 'Ijro'}: ${lastPlayed}.mp3`
                : lang === 'ru'
                  ? 'Нажмите любой звук для прослушивания'
                  : 'Istalgan tugmani bosib asl tovushni eshiting'}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          {lastPlayed && (
            <button
              type="button"
              onClick={() => {
                stopBrilliantSound()
                setLastPlayed(null)
              }}
              aria-label={lang === 'ru' ? 'Остановить' : 'To‘xtatish'}
              className="flex size-8 items-center justify-center rounded-full bg-psurface text-pmuted shadow-xs hover:text-pfg cursor-pointer active:scale-95"
            >
              <VolumeX size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-full bg-psurface px-2.5 py-1 text-[11px] font-bold text-pfg shadow-xs cursor-pointer"
          >
            {expanded
              ? lang === 'ru' ? 'Скрыть' : 'Yopish'
              : lang === 'ru' ? 'Открыть' : 'Ochish'}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            <button
              type="button"
              onClick={() => setActiveGroup('all')}
              className={cn(
                'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold cursor-pointer',
                activeGroup === 'all'
                  ? 'border-pfg bg-pfg text-pcanvas'
                  : 'border-plineStrong bg-psurface text-pmuted',
              )}
            >
              {lang === 'ru' ? `Все (${BRILLIANT_SOUNDS.length})` : `Barchasi (${BRILLIANT_SOUNDS.length})`}
            </button>
            {BRILLIANT_SOUND_GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setActiveGroup(g.id)}
                className={cn(
                  'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold cursor-pointer',
                  activeGroup === g.id
                    ? 'border-pfg bg-pfg text-pcanvas'
                    : 'border-plineStrong bg-psurface text-pmuted',
                )}
              >
                {lang === 'ru' ? g.titleRu : g.titleUz}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {visibleSounds.map((s) => {
              const isActive = lastPlayed === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handlePlay(s.id)}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-all cursor-pointer active:scale-[0.985]',
                    isActive
                      ? 'border-pprimary bg-[#3557ff]/10'
                      : 'border-pline bg-psurface hover:border-plineStrong',
                  )}
                >
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-bold text-pfg truncate">
                      {lang === 'ru' ? s.labelRu : s.labelUz}
                    </div>
                    <div className="text-[10.5px] text-pmuted truncate">
                      {lang === 'ru' ? s.triggerRu : s.triggerUz} · <span className="font-mono">{s.id}</span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full',
                      isActive ? 'bg-[#3557ff] text-white' : 'bg-pcard text-pmuted',
                    )}
                  >
                    <Play size={12} fill="currentColor" />
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
