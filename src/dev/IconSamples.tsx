// DEV ONLY (construction 9 / 9a; removed in construction 10): the "hand of cards" icons (fan and
// offset) as they would look on an iPhone home screen (about 60px, rounded corners, the name
// below), on a light and a dark wallpaper next to other "apps", then at 180px. Lazy, dev only.
import handFan from '../../data-src/icons/hand-fan.svg?raw'
import handOffset from '../../data-src/icons/hand-offset.svg?raw'
import './iconSamples.css'

const DESIGNS = [
  { key: 'fan', label: '扇形', svg: handFan },
  { key: 'offset', label: 'ずらし', svg: handOffset },
]
const OTHERS = ['#34c759', '#0a84ff', '#ff9f0a', '#5e5ce6', '#ff375f', '#64d2ff', '#30d158', '#bf5af2', '#ffd60a']
const url = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

function Wallpaper({ dark }: { dark: boolean }) {
  // 4 columns like a home screen: our 2 designs + other apps around them
  const cells = [
    { other: 0 },
    { design: 0 },
    { other: 1 },
    { other: 2 },
    { other: 3 },
    { other: 4 },
    { design: 1 },
    { other: 5 },
    { other: 6 },
    { other: 7 },
    { other: 8 },
    { other: 0 },
  ]
  return (
    <div className={`icon-wall ${dark ? 'icon-wall-dark' : 'icon-wall-light'}`}>
      {cells.map((c, i) => (
        <div key={i} className="icon-cell">
          {'design' in c ? (
            <img className="icon-app" src={url(DESIGNS[c.design!].svg)} alt={DESIGNS[c.design!].label} />
          ) : (
            <span className="icon-app icon-other" style={{ background: OTHERS[c.other!] }} />
          )}
          <span className="icon-name">{'design' in c ? 'グルメカード' : 'アプリ'}</span>
        </div>
      ))}
    </div>
  )
}

export function IconSamples() {
  return (
    <section className="icon-samples" aria-label="アイコンの見本">
      <h2 className="icon-samples-title">アイコンの見本（開発用）</h2>
      <p className="icon-samples-note">上の段が扇形、2段目がずらし（ホーム画面の実寸 約60px）</p>
      <Wallpaper dark={false} />
      <Wallpaper dark />
      <div className="icon-large-row">
        {DESIGNS.map((d) => (
          <figure key={d.key} className="icon-large">
            <img src={url(d.svg)} alt={d.label} />
            <figcaption>{d.label}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
