import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore }    from '../../shared/store/useAppStore'
import { useT }           from '../../shared/i18n'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
import { goBack, registerModal } from '../../shared/lib/navigation'
import { DuelHeader }       from './components/DuelHeader'
import { DuelBanners }      from './components/DuelBanners'
import { IdleScreen }       from './components/IdleScreen'
import { SearchingScreen }  from './components/SearchingScreen'
import { MatchedScreen }    from './components/MatchedScreen'
import { RoundScreen }      from './components/RoundScreen'
import { MatchEndScreen }   from './components/MatchEndScreen'
import { CustomRoomModal }  from './components/CustomRoomModal'
import { FloatingReactionsOverlay } from './components/FloatingReactionsOverlay'
import { DuelReactionPicker } from './components/DuelReactionPicker'
import { useOctagonClock }  from './hooks/useOctagonClock'
import { useDuelConnection } from './hooks/useDuelConnection'
import { cn } from '../../shared/lib/cn'

export default function OctagonPage() {
  const navigate = useNavigate()
  // Selector'li obuna — whole-store EMAS
  const user     = useAppStore((s) => s.user)
  const settings = useAppStore((s) => s.settings)
  const questions = useQuestionsStore((s) => s.questions)
  const tt = useT(settings.language)

  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false)

  const { state: s, conn, duelCode, duelLink,
          onlinePlayers, onlineCount, refreshOnline,
          floatingReactions, opponentPhrase, yourPhrase, isMuted,
          joinQueue, cancelSearch, sendAnswer, sendReaction, toggleMute, retryConnect, exitToIdle } =
    useDuelConnection(user)
  const { timeLeft, roundPct } = useOctagonClock(s.deadline)

  // Qidiruv holatida orqaga bosilsa qidiruvni bekor qilib Duel boshiga qaytish
  useEffect(() => {
    if (s.phase !== 'searching') return
    const id = Symbol('duel-searching')
    const unregister = registerModal(id, () => {
      cancelSearch()
    })
    return () => {
      unregister()
    }
  }, [s.phase, cancelSearch])

  // O'yin tugagan natija ekranida orqaga bosilsa Duel boshiga qaytish
  useEffect(() => {
    if (s.phase !== 'match_end') return
    const id = Symbol('duel-match-end')
    const unregister = registerModal(id, () => {
      exitToIdle()
    })
    return () => {
      unregister()
    }
  }, [s.phase, exitToIdle])

  const currentQ = s.currentQuestionId !== null
    ? questions.find((q) => q.id === s.currentQuestionId) ?? null
    : null

  const isLiveMatch = s.phase === 'in_round' || s.phase === 'matched' || s.phase === 'match_end'

  const handleHeaderBack = () => {
    if (s.phase === 'searching') {
      cancelSearch()
    } else if (s.phase === 'match_end') {
      exitToIdle()
    } else {
      goBack(navigate)
    }
  }

  return (
    <div className="flex flex-col bg-pcanvas text-pfg relative">
      <DuelHeader
        title={tt('octagonTitle')}
        inRound={s.phase === 'in_round'}
        yourScore={s.yourScore}
        oppScore={s.oppScore}
        onBack={handleHeaderBack}
      />

      <DuelBanners toastMsg={s.toastMsg} conn={conn} phase={s.phase}
        oppWait={s.oppWait} onRetry={retryConnect} />

      {/* Floating live reactions and taunts overlay */}
      {isLiveMatch && (
        <FloatingReactionsOverlay
          reactions={floatingReactions}
          opponentPhrase={opponentPhrase}
          yourPhrase={yourPhrase}
        />
      )}

      <div className={cn('flex-1 flex flex-col px-4', s.phase === 'idle' ? 'pt-1' : 'items-center justify-center')}>
        {s.phase === 'idle' && (
          <IdleScreen
            tt={tt}
            user={user}
            language={settings.language}
            connFailed={conn === 'failed'}
            onlinePlayers={onlinePlayers}
            onlineCount={onlineCount}
            onRefreshOnline={refreshOnline}
            onFind={() => joinQueue()}
            onJoinWithPin={(pin) => joinQueue(pin)}
          />
        )}

        {s.phase === 'searching' && (
          <SearchingScreen tt={tt} duelCode={duelCode} duelLink={duelLink} onCancel={cancelSearch} />
        )}

        {s.phase === 'matched' && <MatchedScreen opponentName={s.opponentName} opponentAvatar={s.opponentAvatar} opponentFrame={s.opponentFrame} />}

        {s.phase === 'in_round' && (
          <RoundScreen tt={tt} q={currentQ} deadline={s.deadline}
            roundPct={roundPct} timeLeft={timeLeft}
            roundIndex={s.roundIndex} roundCount={s.roundCount}
            oppAnswered={s.oppAnswered} selected={s.selected}
            ackCorrect={s.ackCorrect} ackCorrectOptionId={s.ackCorrectOptionId}
            onAnswer={sendAnswer} />
        )}

        {s.phase === 'match_end' && (
          <MatchEndScreen tt={tt} result={s.result}
            yourScore={s.yourScore} oppScore={s.oppScore} opponentName={s.opponentName}
            onExit={exitToIdle} onRematch={() => joinQueue()} />
        )}
      </div>

      {/* Floating Reaction Picker in live match */}
      {isLiveMatch && (
        <div className="fixed bottom-[calc(1.25rem+var(--safe-bottom,0px))] left-5 z-40">
          <DuelReactionPicker
            language={settings.language}
            isMuted={isMuted}
            onToggleMute={toggleMute}
            onSendReaction={sendReaction}
          />
        </div>
      )}

      {isRoomModalOpen && (
        <CustomRoomModal
          tt={tt}
          onClose={() => setIsRoomModalOpen(false)}
          onStartRoom={(pin) => joinQueue(pin)}
          onJoinRoom={(pin) => joinQueue(pin)}
        />
      )}
    </div>
  )
}
