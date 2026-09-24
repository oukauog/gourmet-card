import { useEffect, useRef } from 'react'

interface Props {
  blob: Blob
  alt: string
  className?: string
  loading?: 'lazy' | 'eager'
  decoding?: 'async' | 'sync' | 'auto'
}

/**
 * Shows a Blob as an image. The object URL is created in an effect and revoked when the blob
 * changes or on unmount (leaked URLs keep image memory alive on iPhone).
 */
export function BlobImage({ blob, alt, className, loading, decoding }: Props) {
  const ref = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const img = ref.current
    if (!img) return
    const url = URL.createObjectURL(blob)
    img.src = url
    return () => {
      img.removeAttribute('src')
      URL.revokeObjectURL(url)
    }
  }, [blob])

  return <img ref={ref} alt={alt} className={className} loading={loading} decoding={decoding} />
}
