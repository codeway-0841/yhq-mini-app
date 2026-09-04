import './arena.css'
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

  const [creatingRoom, setCreatingRoom] = useState(false)
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false)

  const { state: s, conn, duelCode, duelLink,
          onlinePlayers, onlineCount, refreshOnline,
          floatingReactions, opponentPhrase, yourPhrase, isMuted,
          joinQueue, startDuel, cancelSearch, sendAnswer, sendReaction, toggleMute, retryConnect, exitToIdle } =
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
    <div className="arena-page flex flex-col flex-1 bg-pcanvas text-pfg relative overscroll-none">
      <DuelHeader
        title={settings.language === 'ru' ? 'Дуэль' : 'Duel'}
        inRound={s.phase === 'in_round'}
        yourScore={s.yourScore}
        oppScore={s.oppScore}
        onBack={handleHeaderBack}
      />

      <DuelBanners toastMsg={s.toastMsg} conn={conn} phase={s.phase}
        oppWait={s.oppWait} onRetry={retryConnect} language={settings.language} />

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
            connection={conn}
            onCreateRoom={() => { setCreatingRoom(true); startDuel() }}
            onlinePlayers={onlinePlayers}
            onlineCount={onlineCount}
            onRefreshOnline={refreshOnline}
            onFind={() => { setCreatingRoom(false); joinQueue('') }}
            onJoinWithPin={(pin) => { setCreatingRoom(false); joinQueue(pin) }}
          />
        )}

        {s.phase === 'searching' && (
          <SearchingScreen language={settings.language} roomPending={creatingRoom && !duelCode} tt={tt} duelCode={duelCode} duelLink={duelLink} onCancel={cancelSearch} />
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
            language={settings.language} onExit={exitToIdle} onRematch={() => { setCreatingRoom(false); joinQueue('') }} />
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
