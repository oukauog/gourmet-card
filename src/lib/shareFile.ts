// Hand a file to the share sheet (Web Share API) or download it (construction 8, spec 4.5.2).
// iPhone Safari allows navigator.share only right after a tap, so the caller prepares the file
// first and calls shareFile from a SECOND tap.

export function makeFile(blob: Blob, name: string, mime: string): File {
  return new File([blob], name, { type: mime })
}

/** True when this browser can share this file (navigator.canShare says so). */
export function canShareFile(file: File): boolean {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && typeof navigator.share === 'function' && navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

export type ShareOutcome = 'shared' | 'cancelled'

/** Open the share sheet. Closing it is 'cancelled' (AbortError); other errors are thrown. */
export async function shareFile(file: File): Promise<ShareOutcome> {
  try {
    await navigator.share({ files: [file] })
    return 'shared'
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return 'cancelled'
    throw e
  }
}

/** Save the file with <a download> (call it inside the tap). The object URL is freed afterwards. */
export function downloadFile(file: Blob, name: string): void {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // some browsers start the download after click() returns: free the URL a little later
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/** "1.8MB" / "320KB". */
export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  return `${Math.max(1, Math.round(bytes / 1024))}KB`
}
