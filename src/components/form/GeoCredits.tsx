/** Data sources of the station / municipality masters (spec 3.5). Shown at the bottom of the form. */
export function GeoCredits() {
  return (
    <footer className="geo-credits" aria-label="出典">
      <p>
        駅データ：駅データ.jp（
        <a href="https://ekidata.jp/" target="_blank" rel="noopener noreferrer">
          https://ekidata.jp/
        </a>
        ）
      </p>
      <p>
        市区町村：「全国地方公共団体コード」（総務省）（
        <a href="https://www.soumu.go.jp/denshijiti/code.html" target="_blank" rel="noopener noreferrer">
          https://www.soumu.go.jp/denshijiti/code.html
        </a>
        ）を加工して作成
      </p>
    </footer>
  )
}
