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
}

export function getProvider(dataSourceId: string): QuestionBankProvider {
  if (!PROVIDERS[dataSourceId]) {
    PROVIDERS[dataSourceId] = new DefaultQuestionBankProvider(dataSourceId)
  }
  return PROVIDERS[dataSourceId]
}
