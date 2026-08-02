import type { QuestionBankProvider } from './QuestionBankProvider'
import { DefaultQuestionBankProvider } from './default.provider'

/**
 * dataSourceId → provider instance map.
 * YANGI BAZA QO'SHGANDA: yangi provider'ni shu map'ga qo'shing.
 */
const PROVIDERS: Record<string, QuestionBankProvider> = {
  traffic_rules_db: new DefaultQuestionBankProvider(),
}

export function getProvider(dataSourceId: string): QuestionBankProvider {
  return PROVIDERS[dataSourceId] ?? PROVIDERS['traffic_rules_db']
}
