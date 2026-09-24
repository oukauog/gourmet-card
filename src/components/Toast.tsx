import { useEffect } from 'react'

interface Props {
  message: string
  onDone: () => void
  /** Default 2000 ms. */
  durationMs?: number
}

/** Short message at the bottom that disappears by itself. */
export function Toast({ message, onDone, durationMs = 2000 }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDone, durationMs)
    return () => clearTimeout(timer)
  }, [onDone, durationMs])

  return (
    <div className="toast" role="status">
      {message}
    </div>
  )
}
