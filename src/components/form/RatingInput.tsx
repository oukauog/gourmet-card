import { ratingToText } from '../../lib/rating'
import { ratingFromSlider, RATING_MAX, RATING_MIN, stepRating, UNRATED_START } from '../../lib/ratingInput'
import { Stars } from '../Stars'

interface Props {
  /** 1..50 or undefined (not rated). */
  value: number | undefined
  onChange: (value: number | undefined) => void
}

/**
 * Rating (spec 4.2.1): big number + proportional stars, a slider 1..50 and "-0.1" / "+0.1".
 * Not rated: "未評価" and a faded slider; touching the slider or a button gives a rating
 * (the buttons start from 3.0). "未評価に戻す" clears it.
 */
export function RatingInput({ value, onChange }: Props) {
  const rated = value !== undefined
  return (
    <div className="rating-input" data-rated={rated}>
      <div className="rating-head">
        {rated ? (
          <>
            <span className="rating-value" data-testid="rating-value">
              {ratingToText(value)}
            </span>
            <Stars rating={value} size={24} />
            <button type="button" className="rating-clear" onClick={() => onChange(undefined)}>
              未評価に戻す
            </button>
          </>
        ) : (
          <span className="rating-none" data-testid="rating-value">
            未評価
          </span>
        )}
      </div>
      <div className="rating-row">
        <button type="button" className="rating-step" onClick={() => onChange(stepRating(value, -1))}>
          −0.1
        </button>
        <input
          type="range"
          className="rating-slider"
          aria-label="評価"
          min={RATING_MIN}
          max={RATING_MAX}
          step={1}
          value={value ?? UNRATED_START}
          // touching the faded slider rates the shop even without moving it
          onPointerDown={() => {
            if (!rated) onChange(UNRATED_START)
          }}
          onChange={(e) => onChange(ratingFromSlider(e.target.value))}
        />
        <button type="button" className="rating-step" onClick={() => onChange(stepRating(value, +1))}>
          ＋0.1
        </button>
      </div>
    </div>
  )
}
