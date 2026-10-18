import type { Keys } from '../../shared/i18n'

export type DriveCarId = 'blue' | 'amber'
export type DriveEntry = 'north' | 'south' | 'west' | 'east'
export type DriveSignal = 'traffic-light' | 'main-road' | 'uncontrolled'

export interface DriveCar {
  id: DriveCarId
  labelKey: Keys
  entry: DriveEntry
}

export interface DriveScenario {
  id: string
  titleKey: Keys
  promptKey: Keys
  ruleKey: Keys
  signal: DriveSignal
  cars: readonly DriveCar[]
  correctOrder: readonly DriveCarId[]
}

export const DRIVE_SCENARIOS: readonly DriveScenario[] = [
  {
    id: 'traffic-light',
    titleKey: 'driveLightsTitle',
    promptKey: 'driveLightsPrompt',
    ruleKey: 'driveLightsRule',
    signal: 'traffic-light',
    cars: [
      { id: 'blue', labelKey: 'driveBlueCar', entry: 'north' },
      { id: 'amber', labelKey: 'driveAmberCar', entry: 'west' },
    ],
    correctOrder: ['blue', 'amber'],
  },
  {
    id: 'main-road',
    titleKey: 'driveMainRoadTitle',
    promptKey: 'driveMainRoadPrompt',
    ruleKey: 'driveMainRoadRule',
    signal: 'main-road',
    cars: [
      { id: 'blue', labelKey: 'driveBlueCar', entry: 'south' },
      { id: 'amber', labelKey: 'driveAmberCar', entry: 'west' },
    ],
    correctOrder: ['amber', 'blue'],
  },
  {
    id: 'right-hand',
    titleKey: 'driveRightHandTitle',
    promptKey: 'driveRightHandPrompt',
    ruleKey: 'driveRightHandRule',
    signal: 'uncontrolled',
    cars: [
      { id: 'blue', labelKey: 'driveBlueCar', entry: 'west' },
      { id: 'amber', labelKey: 'driveAmberCar', entry: 'south' },
    ],
    correctOrder: ['amber', 'blue'],
  },
] as const

export function isCorrectDriveOrder(
  selected: readonly DriveCarId[],
  correct: readonly DriveCarId[],
): boolean {
  return selected.length === correct.length && selected.every((id, index) => id === correct[index])
}
