import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, Flag, RotateCcw, Undo2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../shared/components/ui/button'
import { PageHeader } from '../../shared/components/ui/page-header'
import { useAppStore } from '../../shared/store/useAppStore'
import { useT } from '../../shared/i18n'
import { goBack } from '../../shared/lib/navigation'
import { playSound } from '../../shared/lib/sounds'
import { track } from '../../shared/lib/analytics'
import { haptics } from '../../platform/haptics'
import DriveScene from './DriveScene'
import { DRIVE_SCENARIOS, isCorrectDriveOrder, type DriveCarId } from './drive-scenarios'
import './drive.css'

type Result = 'correct' | 'wrong' | null

export default function DrivePage() {
  const navigate = useNavigate()
  const language = useAppStore((state) => state.settings.language)
  const tt = useT(language)
  const [scenarioIndex, setScenarioIndex] = useState(0)
  const [selected, setSelected] = useState<DriveCarId[]>([])
  const [result, setResult] = useState<Result>(null)
  const [completed, setCompleted] = useState(false)
  const scenario = DRIVE_SCENARIOS[scenarioIndex]

  const labels = useMemo<Record<DriveCarId, string>>(() => ({
    blue: tt('driveBlueCar'),
    amber: tt('driveAmberCar'),
  }), [tt])

  useEffect(() => {
    track('drive_open')
  }, [])

  const selectCar = (id: DriveCarId) => {
    if (result) return
    haptics.selection()
    playSound('click')
    setSelected((current) => {
      const existing = current.indexOf(id)
      if (existing >= 0) return current.filter((carId) => carId !== id)
      if (current.length >= scenario.cars.length) return current
      return [...current, id]
    })
  }

  const check = () => {
    if (selected.length !== scenario.cars.length || result) return
    const correct = isCorrectDriveOrder(selected, scenario.correctOrder)
    setResult(correct ? 'correct' : 'wrong')
    playSound(correct ? 'success' : 'error')
    if (correct) haptics.success()
    else haptics.error()
    track('drive_answer', { scenario: scenario.id, correct })
  }

  const retry = () => {
    setSelected([])
    setResult(null)
  }

  const next = () => {
    if (scenarioIndex === DRIVE_SCENARIOS.length - 1) {
      setCompleted(true)
      playSound('win')
      haptics.complete()
      track('drive_complete', { scenarios: DRIVE_SCENARIOS.length })
      return
    }
    setScenarioIndex((current) => current + 1)
    setSelected([])
    setResult(null)
  }

  const replay = () => {
    setScenarioIndex(0)
    setSelected([])
    setResult(null)
    setCompleted(false)
  }

  if (completed) {
    return (
      <main className="drive-page px-4 pb-8">
        <PageHeader title={tt('driveTitle')} size="md" onBack={() => goBack(navigate)} className="-mx-4" />
        <section className="drive-finish animate-premiumIn" aria-labelledby="drive-finish-title">
          <div className="drive-finish-mark"><Flag aria-hidden="true" /></div>
          <p className="drive-kicker">{tt('driveMode')}</p>
          <h1 id="drive-finish-title">{tt('driveCompletedTitle')}</h1>
          <p>{tt('driveCompletedBody')}</p>
          <div className="drive-finish-score" aria-label={`3 / ${DRIVE_SCENARIOS.length}`}>
            <strong>{DRIVE_SCENARIOS.length}</strong>
            <span>/ {DRIVE_SCENARIOS.length}</span>
          </div>
          <Button size="lg" block onClick={replay}>
            <RotateCcw /> {tt('driveReplay')}
          </Button>
        </section>
      </main>
    )
  }

  const allSelected = selected.length === scenario.cars.length

  return (
    <main className="drive-page px-4 pb-8">
      <PageHeader title={tt('driveTitle')} size="md" onBack={() => goBack(navigate)} className="-mx-4" />

      <section className="drive-stage animate-premiumIn" aria-labelledby="drive-scenario-title">
        <header className="drive-stage-head">
          <div>
            <p className="drive-kicker">{tt('driveMode')} · {String(scenarioIndex + 1).padStart(2, '0')}</p>
            <h1 id="drive-scenario-title">{tt(scenario.titleKey)}</h1>
          </div>
          <span className="drive-progress-count">{scenarioIndex + 1} / {DRIVE_SCENARIOS.length}</span>
        </header>

        <div className="drive-progress-track" aria-hidden="true">
          <span style={{ width: `${((scenarioIndex + 1) / DRIVE_SCENARIOS.length) * 100}%` }} />
        </div>

        <DriveScene
          scenario={scenario}
          sceneLabel={tt(scenario.titleKey)}
          selected={selected}
          result={result}
          carLabels={labels}
          onSelect={selectCar}
        />

        <div className="drive-command">
          <div className="drive-command-copy">
            <span>{tt('driveQuestion')}</span>
            <strong>{tt(scenario.promptKey)}</strong>
            {!result ? <p>{tt('driveInstruction')}</p> : null}
          </div>

          {!result ? (
            <div className="drive-order-row" aria-label={tt('driveSelectedOrder')}>
              {scenario.cars.map((_, index) => {
                const carId = selected[index]
                return (
                  <span key={index} className={`drive-order-slot${carId ? ` is-${carId}` : ''}`}>
                    <b>{index + 1}</b>
                    {carId ? labels[carId] : '—'}
                  </span>
                )
              })}
            </div>
          ) : null}

          {result ? (
            <div className={`drive-feedback is-${result}`} role="status">
              <div className="drive-feedback-icon" aria-hidden="true">
                {result === 'correct' ? <Check /> : <X />}
              </div>
              <div>
                <strong>{tt(result === 'correct' ? 'driveCorrectTitle' : 'driveWrongTitle')}</strong>
                <p>{tt(scenario.ruleKey)}</p>
              </div>
            </div>
          ) : null}

          <div className="drive-actions">
            {!result ? (
              <>
                <Button
                  variant="secondary"
                  size="lg"
                  aria-label={tt('driveReset')}
                  disabled={selected.length === 0}
                  onClick={() => setSelected([])}
                >
                  <Undo2 />
                </Button>
                <Button size="lg" block disabled={!allSelected} onClick={check}>
                  {tt('driveCheck')} <ArrowRight />
                </Button>
              </>
            ) : result === 'wrong' ? (
              <Button size="lg" block onClick={retry}>
                <RotateCcw /> {tt('driveRetry')}
              </Button>
            ) : (
              <Button size="lg" block onClick={next}>
                {scenarioIndex === DRIVE_SCENARIOS.length - 1 ? tt('driveFinish') : tt('driveNext')}
                <ArrowRight />
              </Button>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
