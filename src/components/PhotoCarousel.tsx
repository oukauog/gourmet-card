import { useRef, useState } from 'react'
import { slideIndexFromScroll } from '../lib/shopView'
import { BlobImage } from './BlobImage'
import { tileToneIndex } from './tileTone'
import '../styles/carousel.css'

interface Props {
  /** Images in display order (the shop page passes the LARGE ones). */
  photos: Blob[]
  /** Shop name: alt text, and the pale tone of the band when there is no photo. */
  name: string
}

/**
 * Full-width photos, one per swipe. No library and no touch handlers: a horizontal scroller
 * with CSS scroll-snap, so the browser does the inertia. The slide height comes from
 * --photo-ratio (set by the page). Dots only when there are 2+ photos.
 */
export function PhotoCarousel({ photos, name }: Props) {
  const [index, setIndex] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const count = photos.length

  if (count === 0) {
    // same pale tone as the no-photo tile in the list (tileTone.ts)
    return <div className="photo-band" data-tone={tileToneIndex(name)} data-testid="photo-band" aria-hidden="true" />
  }

  const onScroll = () => {
    const el = trackRef.current
    if (el) setIndex(slideIndexFromScroll(el.scrollLeft, el.clientWidth, count))
  }

  return (
    <div className="carousel" data-testid="photo-carousel">
      <div className="carousel-track" ref={trackRef} onScroll={count > 1 ? onScroll : undefined}>
        {photos.map((blob, i) => (
          <div key={i} className="carousel-slide">
            <BlobImage
              blob={blob}
              alt={count === 1 ? name : `${name} 写真${i + 1}/${count}`}
              className="carousel-img"
              decoding="async"
            />
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="carousel-dots" data-testid="carousel-dots" aria-hidden="true">
          {photos.map((_, i) => (
            <span key={i} className="carousel-dot" data-active={i === index} />
          ))}
        </div>
      )}
    </div>
  )
}
