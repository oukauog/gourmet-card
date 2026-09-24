import { useId, type CSSProperties } from 'react'
import { ratingToText, starFills } from '../lib/rating'
import '../styles/stars.css'

interface Props {
  /** Internal rating 1..50. "未評価" is the caller's job (this component only takes 1..50). */
  rating: number
  /** Star size in px. When omitted, CSS var --star-size (default 14px) decides. */
  size?: number
}

// 24x24 five-pointed star; its horizontal extent is STAR_LEFT..STAR_RIGHT.
const STAR_PATH =
  'M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96z'
const STAR_LEFT = 2.48
const STAR_RIGHT = 21.52

/** 5 stars filled in proportion to the rating (3.7 -> 3 full + 70% of the 4th) and the number. */
export function Stars({ rating, size }: Props) {
  const fills = starFills(rating)
  const text = ratingToText(rating)
  // useId may contain characters that break url(#...) references; keep it plain.
  const base = 'st' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const style = size ? ({ '--star-size': `${size}px` } as CSSProperties) : undefined

  return (
    <span className="stars" role="img" aria-label={`評価 ${text}`} style={style}>
      <span className="stars-icons" aria-hidden="true">
        {fills.map((fill, i) => (
          <svg key={i} className="star" viewBox="0 0 24 24" data-fill={fill}>
            <defs>
              <clipPath id={`${base}-${i}`}>
                <rect x="0" y="0" width={STAR_LEFT + fill * (STAR_RIGHT - STAR_LEFT)} height="24" />
              </clipPath>
            </defs>
            <path className="star-empty" d={STAR_PATH} />
            {fill > 0 && <path className="star-fill" d={STAR_PATH} clipPath={`url(#${base}-${i})`} />}
          </svg>
        ))}
      </span>
      <span className="stars-text" aria-hidden="true">
        {text}
      </span>
    </span>
  )
}
