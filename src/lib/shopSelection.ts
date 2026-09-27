// Selection mode of the list (construction 8b, spec 4.5.3). Pure; ids only.
// The selection is kept across tabs and filters; "shown" = the tiles on screen now.

/** Select or unselect one shop (the order of choosing is kept). */
export function toggleSelection(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
}

/** True when there are shown shops and every one of them is selected. */
export function allShownSelected(selected: readonly string[], shownIds: readonly string[]): boolean {
  if (shownIds.length === 0) return false
  const set = new Set(selected)
  return shownIds.every((id) => set.has(id))
}

/** "表示中をすべて選ぶ": add the shown shops that are not selected yet. */
export function selectShown(selected: readonly string[], shownIds: readonly string[]): string[] {
  const set = new Set(selected)
  return [...selected, ...shownIds.filter((id) => !set.has(id))]
}

/** "表示中をすべて外す": remove the shown shops only (the others stay selected). */
export function unselectShown(selected: readonly string[], shownIds: readonly string[]): string[] {
  const shown = new Set(shownIds)
  return selected.filter((id) => !shown.has(id))
}

/** Selected shops that are not on screen now (another tab / filtered out): "うちN店は今の表示の外". */
export function hiddenSelectedCount(selected: readonly string[], shownIds: readonly string[]): number {
  const shown = new Set(shownIds)
  return selected.filter((id) => !shown.has(id)).length
}

/**
 * The order to send: every shop (both tabs) in the list's current sort order, keeping the
 * selected ones. Ids no longer in the list are dropped.
 */
export function sendOrder(selected: readonly string[], allIdsInSortOrder: readonly string[]): string[] {
  const set = new Set(selected)
  return allIdsInSortOrder.filter((id) => set.has(id))
}

/** Only ids that still exist (e.g. after the list was read again). */
export function existingSelection(selected: readonly string[], allIds: readonly string[]): string[] {
  const all = new Set(allIds)
  return selected.filter((id) => all.has(id))
}
