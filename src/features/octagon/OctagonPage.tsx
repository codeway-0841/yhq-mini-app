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
import { useOctagonClock }  from './hooks/useOctagonClock'
import { useDuelConnection } from './hooks/useDuelConnection'

export default function OctagonPage() {
  const { user, settings } = useAppStore()
  const questions = useQuestionsStore((s) => s.questions)
  const tt = useT(settings.language)

  const { state: s, conn, duelCode, duelLink,
          joinQueue, startDuel, cancelSearch, sendAnswer, retryConnect, exitToIdle } =
    useDuelConnection(user)
  const { timeLeft, roundPct } = useOctagonClock(s.deadline)

  const currentQ = s.currentQuestionId !== null
    ? questions.find((q) => q.id === s.currentQuestionId) ?? null
    : null

  return (
    <div className="flex flex-col min-h-screen bg-canvas">
      <DuelHeader title={tt('octagonTitle')} inRound={s.phase === 'in_round'}
        yourScore={s.yourScore} oppScore={s.oppScore} />

      <DuelBanners toastMsg={s.toastMsg} conn={conn} phase={s.phase}
        oppWait={s.oppWait} onRetry={retryConnect} />

      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {s.phase === 'idle' && (
          <IdleScreen tt={tt} connFailed={conn === 'failed'}
            onFind={() => joinQueue()} onDuelWithFriend={startDuel} />
        )}

        {s.phase === 'searching' && (
          <SearchingScreen tt={tt} duelCode={duelCode} duelLink={duelLink} onCancel={cancelSearch} />
        )}

        {s.phase === 'matched' && <MatchedScreen opponentName={s.opponentName} />}

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
    </div>
  )
}
