// Build the station / municipality masters (spec 3.5, construction 7) from the raw data in data-src/.
//   npm run geo-data                     -> src/data/cities.json, src/data/stations.json
//   npm run geo-data -- --report <file>  -> also writes the details (unmatched, extras, same names) as JSON
// Same input -> same output (byte for byte). Console output is ASCII only (Japanese Windows).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import readXlsxFile from 'read-excel-file/node'
import { PREFECTURES } from '../src/lib/prefectures.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(root, 'data-src')
const OUT = path.join(root, 'src', 'data')
const SOUMU_XLSX = path.join(SRC, 'soumu', '000925835.xlsx')
const EXTRA_CSV = path.join(SRC, 'extra-stations.csv')

// The six Northern Territories villages (色丹村 ... 蘂取村) are listed in the MIC table but are not
// counted in the 1,718 municipalities; 泊村 would also appear twice in 北海道.
const EXCLUDED_CODES = new Set(['016951', '016969', '016977', '016985', '016993', '017001'])

function fail(message) {
  console.error(`ERROR: ${message}`)
  process.exit(1)
}

/** RFC 4180 CSV (quotes, "" escapes, CRLF / LF). BOM is removed. */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  const s = text.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

function readCsvObjects(file, required) {
  const [head, ...body] = parseCsv(fs.readFileSync(file, 'utf8'))
  for (const col of required) {
    const names = Array.isArray(col) ? col : [col]
    if (!names.some((n) => head.includes(n))) fail(`${path.basename(file)}: column ${names.join(' or ')} not found`)
  }
  return body.map((cells, n) => {
    if (cells.length !== head.length) fail(`${path.basename(file)}: line ${n + 2} has ${cells.length} fields (header has ${head.length})`)
    return Object.fromEntries(head.map((h, i) => [h, cells[i]]))
  })
}

// ---------- municipalities ----------

async function buildCities() {
  if (!fs.existsSync(SOUMU_XLSX)) fail('data-src/soumu/000925835.xlsx not found')
  const sheets = await readXlsxFile(SOUMU_XLSX)
  const [head, ...body] = sheets[0].data // sheet 1: prefectures and municipalities (not the ward sheet)
  if (String(head[0]).trim() !== '団体コード') fail('xlsx: first column of sheet 1 is not the municipality code')
  const cities = PREFECTURES.map(() => [])
  let excluded = 0
  const rows = body
    .filter((r) => r[2] !== null && String(r[2]).trim() !== '') // prefecture rows have no municipality name
    .map((r) => ({ code: String(r[0]).trim(), pref: String(r[1]).trim(), name: String(r[2]).trim() }))
    .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
  for (const r of rows) {
    if (EXCLUDED_CODES.has(r.code)) {
      excluded++
      continue
    }
    const p = PREFECTURES.indexOf(r.pref)
    if (p < 0) fail(`xlsx: unknown prefecture in row ${r.code}`)
    if (cities[p].includes(r.name)) fail(`xlsx: duplicate municipality in one prefecture (${r.code})`)
    cities[p].push(r.name)
  }
  return { cities, excluded }
}

// ---------- stations ----------

/** City of an address: longest municipality name at the start; if none, drop ONE leading "XX郡" and retry. */
function cityOfAddress(prefName, address, prefCities) {
  let a = address.normalize('NFKC').replace(/\s/g, '')
  if (a.startsWith(prefName)) a = a.slice(prefName.length)
  const longest = (s) => {
    let best
    for (const c of prefCities) if (s.startsWith(c) && (!best || c.length > best.length)) best = c
    return best
  }
  // never drop the 郡 first: that would break 郡山市 / 蒲郡市 / 大和郡山市 ...
  const direct = longest(a)
  if (direct) return direct
  const m = /^[^郡]+郡(.+)$/.exec(a)
  return m ? longest(m[1]) : undefined
}

const byNumber = (a, b) => Number(a) - Number(b)

/**
 * For "is this another name?" only (construction 7a): NFKC, no white space, ヶ = ケ, 〈〉 = (),
 * no trailing 駅. 押上（スカイツリー前）/ 押上〈スカイツリー前〉 and 富山駅 / 富山 are the same.
 */
function nameKey(name) {
  return name
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/ヶ/g, 'ケ')
    .replace(/[〈\u2329]/g, '(')
    .replace(/[〉\u232a]/g, ')')
    .replace(/駅$/, '')
}

function buildStations(cities) {
  const csvs = fs.existsSync(path.join(SRC, 'ekidata'))
    ? fs.readdirSync(path.join(SRC, 'ekidata')).filter((f) => /^station.*\.csv$/i.test(f))
    : []
  if (csvs.length !== 1) fail(`data-src/ekidata/ must hold exactly one station*.csv (found ${csvs.length})`)
  const csvName = csvs[0]
  const rows = readCsvObjects(path.join(SRC, 'ekidata', csvName), [
    'station_cd',
    'station_g_cd',
    'station_name',
    'pref_cd',
    ['address', 'add'],
    'e_status',
  ])
  const addrKey = rows.length > 0 && 'address' in rows[0] ? 'address' : 'add'
  const active = rows.filter((r) => r.e_status === '0')

  const groups = new Map()
  for (const r of active) {
    if (!groups.has(r.station_g_cd)) groups.set(r.station_g_cd, [])
    groups.get(r.station_g_cd).push(r)
  }

  const order = (a, b) => byNumber(a.e_sort ?? a.station_cd, b.e_sort ?? b.station_cd) || byNumber(a.station_cd, b.station_cd)
  const unmatched = []
  const multiName = []
  const stations = []
  const aliases = []
  const keptNames = []
  const pending = [] // other names, added after every representative is known (construction 7b)
  const skippedAliases = []
  for (const [gcd, list] of [...groups].sort((a, b) => byNumber(a[0], b[0]))) {
    list.sort(order)
    // The row of the group code itself (the representative station) when it is in service;
    // otherwise the shortest name (ties by e_sort). e_sort alone would pick 新魚津 for 魚津 and
    // 北鉄金沢 for 金沢 (their groups mix several lines' names).
    const rep = list.find((r) => r.station_cd === gcd) ?? [...list].sort((a, b) => a.station_name.length - b.station_name.length || order(a, b))[0]
    const p = Number(rep.pref_cd) - 1
    if (!(p >= 0 && p < PREFECTURES.length)) fail(`station ${rep.station_cd}: pref_cd out of range`)
    const city = cityOfAddress(PREFECTURES[p], rep[addrKey], cities[p])
    if (!city) unmatched.push({ id: gcd, name: rep.station_name, prefecture: PREFECTURES[p], address: rep[addrKey] })
    const names = [...new Set(list.map((r) => r.station_name))]
    if (names.length > 1) multiName.push({ id: gcd, chosen: rep.station_name, names })
    stations.push({ id: gcd, name: rep.station_name, p, city })

    // Construction 7a: a group also holds nearby stations of other names (御茶ノ水 + 淡路町 +
    // 小川町 ...). Each other name becomes its own station; the representative is unchanged.
    // id = the smallest station_cd of that name (station codes and group codes share one
    // numbering; checked for clashes below).
    const repKey = nameKey(rep.station_name)
    const others = new Map()
    for (const r of list) {
      const k = nameKey(r.station_name)
      if (k === repKey) {
        if (r.station_name !== rep.station_name && !keptNames.some((x) => x.name === r.station_name && x.id === gcd))
          keptNames.push({ id: gcd, name: r.station_name, representative: rep.station_name })
        continue
      }
      const cur = others.get(k)
      if (!cur || byNumber(r.station_cd, cur.station_cd) < 0) others.set(k, r)
    }
    for (const r of others.values()) pending.push({ r, gcd, representative: rep.station_name })
  }

  // Construction 7b: an other name is NOT added when its prefecture already has a station of the
  // same name (by nameKey) - a representative, or another other name with a smaller station_cd.
  const placeKey = (p, name) => `${p}\t${nameKey(name)}`
  const taken = new Map(stations.map((s) => [placeKey(s.p, s.name), { id: s.id, kind: 'representative' }]))
  for (const { r, gcd, representative } of pending.sort((a, b) => byNumber(a.r.station_cd, b.r.station_cd))) {
    const ap = Number(r.pref_cd) - 1
    if (!(ap >= 0 && ap < PREFECTURES.length)) fail(`station ${r.station_cd}: pref_cd out of range`)
    const aCity = cityOfAddress(PREFECTURES[ap], r[addrKey], cities[ap])
    const k = placeKey(ap, r.station_name)
    const existing = taken.get(k)
    if (existing) {
      skippedAliases.push({ id: r.station_cd, name: r.station_name, prefecture: PREFECTURES[ap], city: aCity ?? null, groupId: gcd, representative, existingId: existing.id, existingKind: existing.kind })
      continue
    }
    taken.set(k, { id: r.station_cd, kind: 'other name' })
    if (!aCity) unmatched.push({ id: r.station_cd, name: r.station_name, prefecture: PREFECTURES[ap], address: r[addrKey] })
    stations.push({ id: r.station_cd, name: r.station_name, p: ap, city: aCity })
    aliases.push({ id: r.station_cd, name: r.station_name, prefecture: PREFECTURES[ap], city: aCity ?? null, groupId: gcd, representative })
  }
  return { csvName, rowCount: rows.length, activeCount: active.length, groupCount: groups.size, stations, unmatched, multiName, aliases, keptNames, skippedAliases }
}

function addExtras(stations, cities) {
  const extras = readCsvObjects(EXTRA_CSV, ['id', 'name', 'prefecture', 'city'])
  const result = []
  for (const x of extras) {
    const p = PREFECTURES.indexOf(x.prefecture)
    if (p < 0) fail(`extra-stations.csv: unknown prefecture (${x.id})`)
    if (!cities[p].includes(x.city)) fail(`extra-stations.csv: city not in the municipality master (${x.id})`)
    if (!/^x\d+$/.test(x.id)) fail(`extra-stations.csv: id must be x01, x02, ... (${x.id})`)
    const existing = stations.find((s) => s.p === p && s.name === x.name)
    if (existing) {
      result.push({ ...x, added: false, existingId: existing.id })
      continue
    }
    stations.push({ id: x.id, name: x.name, p, city: x.city })
    result.push({ ...x, added: true })
  }
  return result
}

// ---------- output ----------

// cities.json:   [ [city, ...] x 47 ]  (prefecture order of src/lib/prefectures.ts, municipality code order)
// stations.json: [ [ [id, name, cityIndex], ... ] x 47 ]  (cityIndex into cities[pref], -1 = unknown)
// One station per line so a data update gives a readable diff (the build minifies JSON anyway).
function writeJson(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text, { encoding: 'utf8' })
}

const idOrder = (a, b) => {
  const xa = a.id.startsWith('x')
  const xb = b.id.startsWith('x')
  if (xa !== xb) return xa ? 1 : -1
  return xa ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : byNumber(a.id, b.id)
}

const { cities, excluded } = await buildCities()
const built = buildStations(cities)
const extras = addExtras(built.stations, cities)
{
  const seen = new Set()
  for (const s of built.stations) {
    if (seen.has(s.id)) fail(`duplicate station id ${s.id}`)
    seen.add(s.id)
  }
}

const perPref = PREFECTURES.map(() => [])
for (const s of built.stations) perPref[s.p].push(s)
const stationLines = perPref.map((list) =>
  list
    .sort(idOrder)
    .map((s) => JSON.stringify([s.id, s.name, s.city === undefined ? -1 : cities[s.p].indexOf(s.city)]))
    .join(',\n'),
)
writeJson(path.join(OUT, 'stations.json'), `[\n${stationLines.map((l) => `[\n${l}\n]`).join(',\n')}\n]\n`)
writeJson(path.join(OUT, 'cities.json'), `[\n${cities.map((c) => JSON.stringify(c)).join(',\n')}\n]\n`)

// same names (for the report)
const byName = new Map()
for (const s of built.stations) {
  if (!byName.has(s.name)) byName.set(s.name, [])
  byName.get(s.name).push(s)
}
const sameName = [...byName].filter(([, l]) => l.length > 1)
const crossPref = sameName.filter(([, l]) => new Set(l.map((s) => s.p)).size > 1)
const samePref = sameName.filter(([, l]) => new Set(l.map((s) => s.p)).size < l.length)

const cityCount = cities.reduce((n, c) => n + c.length, 0)
console.log(`municipalities: ${cityCount} (excluded ${excluded} Northern Territories villages)`)
console.log(`station csv: ${built.csvName}`)
console.log(`stations: rows ${built.rowCount} -> in service ${built.activeCount} -> grouped ${built.groupCount} -> other names +${built.aliases.length} (skipped ${built.skippedAliases.length}: same name in the prefecture) -> with extras ${built.stations.length}`)
console.log(`extras: added ${extras.filter((x) => x.added).length}, already present ${extras.filter((x) => !x.added).length}`)
console.log(`no city from address: ${built.unmatched.length}`)
console.log(`same names: ${sameName.length} (in several prefectures ${crossPref.length}, twice in one prefecture ${samePref.length})`)
console.log('wrote src/data/cities.json, src/data/stations.json')

const reportAt = process.argv.indexOf('--report')
if (reportAt > 0 && process.argv[reportAt + 1]) {
  const nameOf = (s) => ({ id: s.id, prefecture: PREFECTURES[s.p], city: s.city ?? null })
  const report = {
    csv: built.csvName,
    counts: { rows: built.rowCount, active: built.activeCount, groups: built.groupCount, total: built.stations.length, cities: cityCount },
    citiesPerPrefecture: Object.fromEntries(PREFECTURES.map((p, i) => [p, cities[i].length])),
    unmatched: built.unmatched,
    extras,
    multiName: built.multiName,
    aliases: built.aliases,
    keptNames: built.keptNames,
    skippedAliases: built.skippedAliases,
    crossPref: crossPref.map(([n, l]) => ({ name: n, stations: l.map(nameOf) })),
    samePref: samePref.map(([n, l]) => ({ name: n, stations: l.map(nameOf) })),
  }
  fs.writeFileSync(process.argv[reportAt + 1], JSON.stringify(report, null, 1), { encoding: 'utf8' })
  console.log(`report: ${process.argv[reportAt + 1]}`)
}
