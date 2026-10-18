import type { CSSProperties } from 'react'
import type { DriveCar, DriveCarId, DriveEntry, DriveScenario } from './drive-scenarios'

interface DriveSceneProps {
  scenario: DriveScenario
  sceneLabel: string
  selected: readonly DriveCarId[]
  result: 'correct' | 'wrong' | null
  carLabels: Record<DriveCarId, string>
  onSelect: (id: DriveCarId) => void
}

const CAR_START: Record<DriveEntry, { x: number; y: number; rotation: number }> = {
  north: { x: 136, y: 20, rotation: 90 },
  south: { x: 184, y: 300, rotation: -90 },
  west: { x: 20, y: 184, rotation: 0 },
  east: { x: 300, y: 136, rotation: 180 },
}

const CAR_MOTION: Record<DriveEntry, string> = {
  north: 'drive-move-south',
  south: 'drive-move-north',
  west: 'drive-move-east',
  east: 'drive-move-west',
}

function RoadMarkings() {
  return (
    <g aria-hidden="true" className="drive-road-markings">
      <path d="M146 0V106 M146 214V320 M174 0V106 M174 214V320" />
      <path d="M0 146H106 M214 146H320 M0 174H106 M214 174H320" />
      <path className="drive-lane-dash" d="M160 8V36 M160 52V80 M160 240V268 M160 284V312" />
      <path className="drive-lane-dash" d="M8 160H36 M52 160H80 M240 160H268 M284 160H312" />
      <path className="drive-stop-line" d="M112 116H150 M170 204H208 M116 170V208 M204 112V150" />
    </g>
  )
}

function TrafficLight() {
  return (
    <g className="drive-traffic-light" transform="translate(218 67)" aria-hidden="true">
      <rect x="0" y="0" width="24" height="50" rx="9" />
      <circle className="drive-light-red" cx="12" cy="12" r="5" />
      <circle className="drive-light-amber" cx="12" cy="25" r="5" />
      <circle className="drive-light-green is-on" cx="12" cy="38" r="5" />
    </g>
  )
}

function MainRoadSign() {
  return (
    <g className="drive-main-road-sign" transform="translate(219 72)" aria-hidden="true">
      <path d="M18 0 36 18 18 36 0 18Z" />
      <path d="M18 6 30 18 18 30 6 18Z" />
      <path d="M18 36V55" />
    </g>
  )
}

function CarShape({ car }: { car: DriveCar }) {
  const start = CAR_START[car.entry]
  return (
    <g transform={`rotate(${start.rotation})`}>
      <rect className="drive-car-shadow" x="-23" y="-12" width="46" height="24" rx="8" />
      <rect className="drive-car-body" x="-23" y="-12" width="46" height="24" rx="8" />
      <path className="drive-car-glass" d="M-10-9H8l8 7v4L8 9h-18l-7-7v-4Z" />
      <path className="drive-car-divider" d="M-8-9v18M9-7v14" />
      <circle className="drive-car-light" cx="19" cy="-7" r="2" />
      <circle className="drive-car-light" cx="19" cy="7" r="2" />
    </g>
  )
}

export default function DriveScene({ scenario, sceneLabel, selected, result, carLabels, onSelect }: DriveSceneProps) {
  return (
    <div className="drive-scene-wrap" role="group" aria-label={sceneLabel}>
      <svg
        className="drive-scene"
        viewBox="0 0 320 320"
        aria-hidden="true"
      >
        <defs>
          <pattern id="drive-asphalt" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="4" r="0.65" />
            <circle cx="16" cy="13" r="0.45" />
            <path d="M7 18h2M19 4h1" />
          </pattern>
          <filter id="drive-shadow" x="-30%" y="-40%" width="160%" height="190%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity=".35" />
          </filter>
        </defs>

        <rect className="drive-ground" width="320" height="320" rx="24" />
        <path className="drive-road" d="M108 0H212V108H320V212H212V320H108V212H0V108H108Z" />
        <path className="drive-asphalt-texture" d="M108 0H212V108H320V212H212V320H108V212H0V108H108Z" />
        <RoadMarkings />

        {scenario.signal === 'traffic-light' ? <TrafficLight /> : null}
        {scenario.signal === 'main-road' ? <MainRoadSign /> : null}
        {scenario.signal === 'uncontrolled' ? (
          <g className="drive-uncontrolled-marker" transform="translate(224 82)" aria-hidden="true">
            <circle cx="0" cy="0" r="16" />
            <path d="M-6 0H6M0-6V6" />
          </g>
        ) : null}

        {result === 'wrong' ? (
          <g className="drive-conflict" transform="translate(160 160)" aria-hidden="true">
            <circle r="25" />
            <path d="m-8-8 16 16M8-8-8 8" />
          </g>
        ) : null}

        {scenario.cars.map((car) => {
          const start = CAR_START[car.entry]
          const order = selected.indexOf(car.id)
          const isSelected = order >= 0
          const shouldMove = result === 'correct'
          const style = {
            '--drive-delay': `${scenario.correctOrder.indexOf(car.id) * 0.5}s`,
          } as CSSProperties

          return (
            <g
              key={car.id}
              className={`drive-car drive-car--${car.id}${isSelected ? ' is-selected' : ''}`}
              transform={`translate(${start.x} ${start.y})`}
            >
              <g className={shouldMove ? CAR_MOTION[car.entry] : undefined} style={style}>
                <g filter="url(#drive-shadow)">
                  <CarShape car={car} />
                </g>
              </g>
              {isSelected && !result ? (
                <g className="drive-order-badge" transform="translate(0 -27)" aria-hidden="true">
                  <circle r="11" />
                  <text textAnchor="middle" dominantBaseline="central">{order + 1}</text>
                </g>
              ) : null}
            </g>
          )
        })}

        <g className="drive-compass" transform="translate(28 29)" aria-hidden="true">
          <circle r="15" />
          <path d="M0-9 4 1 0-1-4 1Z" />
          <text y="10" textAnchor="middle">N</text>
        </g>
      </svg>
      {scenario.cars.map((car) => {
        const start = CAR_START[car.entry]
        const isSelected = selected.includes(car.id)
        const hitStyle = {
          '--drive-hit-x': `${(start.x / 320) * 100}%`,
          '--drive-hit-y': `${(start.y / 320) * 100}%`,
        } as CSSProperties
        return (
          <button
            key={car.id}
            type="button"
            className={`drive-car-hit${isSelected ? ' is-selected' : ''}`}
            style={hitStyle}
            aria-label={carLabels[car.id]}
            aria-pressed={isSelected}
            disabled={result !== null}
            onClick={() => onSelect(car.id)}
          />
        )
      })}
    </div>
  )
}
