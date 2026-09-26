import type { SortOrder } from '../../db/types'

export const SORT_LABELS: Record<SortOrder, string> = { newest: '新しい順', rating: '評価の高い順', name: '名前順' }
export const SORT_ORDER_CHOICES: readonly SortOrder[] = ['newest', 'rating', 'name']
