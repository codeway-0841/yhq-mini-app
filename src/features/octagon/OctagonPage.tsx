import { useState } from 'react'
import { useAppStore }    from '../../shared/store/useAppStore'
import { useT }           from '../../shared/i18n'
import { useQuestionsStore } from '../../shared/store/useQuestionsStore'
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

  const currentQ = s.currentQuestionId !== null
    ? questions.find((q) => q.id === s.currentQuestionId) ?? null
    : null

  const isLiveMatch = s.phase === 'in_round' || s.phase === 'matched' || s.phase === 'match_end'

  return (
    <div className="flex flex-col min-h-screen bg-canvas relative pb-6">
      <DuelHeader title={tt('octagonTitle')} inRound={s.phase === 'in_round'}
        yourScore={s.yourScore} oppScore={s.oppScore} />

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
        <div className="fixed bottom-5 left-5 z-40">
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
