// Page scroll lock for bottom sheets. iOS Safari ignores `overflow: hidden` on body for touch
// scrolling, so the body is fixed at its current offset and put back on unlock.
// While locked, window.scrollY reads 0; screens that remember their scroll use pageScrollY().

let lockedScrollY: number | undefined

/** Page scroll position, also while a sheet is open. */
export function pageScrollY(): number {
  return lockedScrollY ?? window.scrollY
}

/** Lock the page where it is. Returns the unlock function (restores the position). */
export function lockPageScroll(): () => void {
  const y = window.scrollY
  const body = document.body
  const prev = body.getAttribute('style')
  lockedScrollY = y
  Object.assign(body.style, { position: 'fixed', top: `-${y}px`, left: '0', right: '0' })
  return () => {
    if (prev === null) body.removeAttribute('style')
    else body.setAttribute('style', prev)
    lockedScrollY = undefined
    window.scrollTo(0, y)
  }
}
