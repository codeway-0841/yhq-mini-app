import type { QuestionBankProvider } from './QuestionBankProvider'
import { DefaultQuestionBankProvider } from './default.provider'
import { RussianQuestionBankProvider } from './russian.provider'
import { PhysicsQuestionBankProvider } from './physics.provider'

/**
 * dataSourceId → provider instance map.
 * YANGI BAZA QO'SHGANDA: yangi provider'ni shu map'ga qo'shing.
 */
const PROVIDERS: Record<string, QuestionBankProvider> = {
  traffic_rules_db: new DefaultQuestionBankProvider('traffic_rules_db'),
  russian_db:       new RussianQuestionBankProvider(),
  physics_db:       new PhysicsQuestionBankProvider(),
  math_db:          new DefaultQuestionBankProvider('math_db'),
  biology_db:       new DefaultQuestionBankProvider('biology_db'),
  history_db:       new DefaultQuestionBankProvider('history_db'),
  chemistry_db:     new DefaultQuestionBankProvider('chemistry_db'),
  geography_db:     new DefaultQuestionBankProvider('geography_db'),
  onatili_db:       new DefaultQuestionBankProvider('onatili_db'),
  adabiyot_db:      new DefaultQuestionBankProvider('adabiyot_db'),
}

export function getProvider(dataSourceId: string): QuestionBankProvider {
  if (!PROVIDERS[dataSourceId]) {
    PROVIDERS[dataSourceId] = new DefaultQuestionBankProvider(dataSourceId)
  }
  return PROVIDERS[dataSourceId]
}
