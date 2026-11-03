// Builds the site into _site/: the static files (the app site association,
// 404.html, index.html) plus one page per spot at the address the app shares,
// /spot/<code>/<slug>/, so links preview in Messages with the spot's name,
// description and photo. People with the app never see these pages; the link
// opens the app.
//
//   node scripts/build-spot-pages.js            # downloads the map's KML
//   node scripts/build-spot-pages.js map.kml    # or reads a saved export
//
// Codes and slugs follow the iOS app's rules (Spot.shortCode and Spot.slug in
// Packages/Models/Sources/Models/Spot.swift); keep them matching, or links
// shared from the app land on the generic page. No dependencies: Node 18+.
const fs = require("fs")
const path = require("path")
const crypto = require("crypto")

const MAP_ID = "16gC7wi4LEptziD05ONmbiPyn0DWwjn0"
const KML_URL = `https://www.google.com/maps/d/kml?mid=${MAP_ID}&forcekml=1`
const SITE = "https://map.sidewalkjoy.com"
const CLIP_BUNDLE_ID = "com.sidewalkjoyllc.sidewalkjoy.Clip"
const APP_STORE_ID = "6824644823" // App Store Connect -> App Information -> Apple ID
const ROOT = path.join(__dirname, "..")
const OUT = path.join(ROOT, "_site")
const STATIC = [".well-known", "404.html", "index.html", ".nojekyll"]

// ---- The app's rules ----------------------------------------------------------

// SHA-256 of the lowercased UUID; its first 8 bytes (big-endian) written as
// base-27 digits, least significant first.
const CODE_ALPHABET = "23456789bcdfghjkmnpqrstvwxz"
function shortCode(id) {
  let n = crypto.createHash("sha256").update(id.toLowerCase()).digest().readBigUInt64BE(0)
  let code = ""
  for (let i = 0; i < 7; i++) { code += CODE_ALPHABET[Number(n % 27n)]; n /= 27n }
  return code
}

const LETTERS = { "ß": "ss", "æ": "ae", "œ": "oe", "ø": "o", "đ": "d", "ð": "d", "þ": "th", "ł": "l", "ı": "i" }
function slugify(name) {
  let s = String(name || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
  s = s.replace(/[ßæœøđðþłı]/g, (c) => LETTERS[c]).replace(/&/g, " and ").replace(/['’‘`]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  if (s.length > 60) {
    s = s.slice(0, 61)
    const cut = s.lastIndexOf("-")
    s = (cut > 20 ? s.slice(0, cut) : s.slice(0, 60)).replace(/-+$/, "")
  }
  return s || "spot"
}

const CLOSED_PREFIXES = ["CURRENTLY CLOSED: ", "*CLOSED* ", "CLOSED: "]

// ---- KML ------------------------------------------------------------------------

const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
const unwrap = (s) => { const m = s.match(/^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/); return m ? m[1] : decode(s) }
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`)); return m ? unwrap(m[1]) : "" }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function spots(xml) {
  const out = []
  for (const folder of xml.match(/<Folder>[\s\S]*?<\/Folder>/g) || []) {
    const layer = tag(folder.split("<Placemark")[0], "name").trim()
    for (const pm of folder.match(/<Placemark>[\s\S]*?<\/Placemark>/g) || []) {
      if (!/<Point>/.test(pm)) continue
      const values = [...pm.matchAll(/<Data name="([^"]*)">\s*<value>([\s\S]*?)<\/value>/g)]
        .map((m) => ({ name: m[1], value: unwrap(m[2]).trim() }))
      const id = (values.find((v) => UUID.test(v.value)) || {}).value
      if (!id) continue // the app skips spots without an id
      let name = tag(pm, "name")
      for (const p of CLOSED_PREFIXES) if (name.startsWith(p)) { name = name.slice(p.length); break }
      const photos = values.filter((v) => v.value && v.value.split(/\s+/).every((w) => /^https?:\/\//i.test(w)))
        .flatMap((v) => v.value.split(/\s+/)).map((u) => u.replace(/\*/g, "%2A"))
      const column = values.find((v) => v.name === "description")
      const text = column ? column.value : tag(pm, "description").replace(/<img[^>]*>/g, "").replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, "")
      out.push({ id: id.toLowerCase(), name, layer, photo: photos[0] || "", ...summarize(text) })
    }
  }
  return out
}

// The description for previews: no Location line, column labels, or handle lines.
const HANDLE_LINE = /^\s*(@|(ig|insta|instagram|fb|facebook|tik\s?tok|tt|youtube|yt|bluesky|snapchat)\b)/i
function summarize(text) {
  const lines = decode(text).split("\n").map((l) => l.replace(/ /g, " ").trim()).filter(Boolean)
  const location = lines.find((l) => /^location\s*:/i.test(l))
  const body = lines.filter((l) => !/^location\s*:/i.test(l) && !/^id:\s*/i.test(l) && !HANDLE_LINE.test(l))
    .map((l) => l.replace(/^description:\s*/i, "")).filter(Boolean).join(" ")
  return { address: location ? location.replace(/^location\s*:\s*/i, "") : "", summary: body.replace(/\s+/g, " ").trim() }
}

// ---- Pages ------------------------------------------------------------------------

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const short = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…")
// My Maps photo addresses end in "fife=s<N>" (the longest side); a 1,200 px
// JPEG ("-rj": ~200 KB, where the PNG is over 1 MB) arrives fast enough for a
// link preview.
const sized = (url) => (/[?&]fife=s\d+/.test(url) ? url.replace(/([?&]fife=)s\d+/, "$1s1200-rj") : url)
const appStoreURL = APP_STORE_ID ? `https://apps.apple.com/app/id${APP_STORE_ID}`
  : "https://apps.apple.com/us/search?term=Sidewalk%20Joy"

function page(spot, url) {
  const description = short(spot.summary || [spot.layer, spot.address].filter(Boolean).join(" · "), 200)
  const image = spot.photo ? sized(spot.photo) : ""
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-itunes-app" content="${APP_STORE_ID ? `app-id=${APP_STORE_ID}, ` : ""}app-clip-bundle-id=${CLIP_BUNDLE_ID}, app-clip-display=card">
<title>${esc(spot.name)} · Sidewalk Joy</title>
<meta name="description" content="${esc(description)}">
<meta property="og:site_name" content="Sidewalk Joy">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(spot.name)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<link rel="canonical" href="${esc(url)}">
${image ? `<meta property="og:image" content="${esc(image)}">\n<meta name="twitter:card" content="summary_large_image">\n` : ""}<link rel="stylesheet" href="/landing.css">
</head>
<body>
<main>
<p class="brand"><a href="https://www.sidewalkjoy.com/">Sidewalk Joy</a></p>
<p class="spot">${esc(spot.name)}</p>
<h1>Download the Sidewalk Joy app from the App Store</h1>
<a class="button" href="${esc(appStoreURL)}">Get Sidewalk Joy on the App Store</a>
</main>
</body>
</html>
`
}

async function main() {
  const source = process.argv[2]
  const xml = source ? fs.readFileSync(source, "utf8") : await (await fetch(KML_URL)).text()
  const all = spots(xml)
  if (all.length < 100) throw new Error(`only ${all.length} spots in the KML; not publishing`)

  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(OUT, { recursive: true })
  for (const f of STATIC.concat("landing.css")) {
    if (fs.existsSync(path.join(ROOT, f))) fs.cpSync(path.join(ROOT, f), path.join(OUT, f), { recursive: true })
  }

  const seen = new Set()
  for (const spot of all) {
    const code = shortCode(spot.id)
    if (seen.has(code)) continue // a reused id: the app shows one of them
    seen.add(code)
    const slug = slugify(spot.name)
    const html = page(spot, `${SITE}/spot/${code}/${slug}`)
    // /spot/<code>/<slug> is what the app shares. Pages serves <slug>.html
    // there directly; a <slug>/index.html would cost a redirect to add a "/".
    // /spot/<code> also works (after a redirect to /spot/<code>/).
    fs.mkdirSync(path.join(OUT, "spot", code), { recursive: true })
    fs.writeFileSync(path.join(OUT, "spot", code, slug + ".html"), html)
    fs.writeFileSync(path.join(OUT, "spot", code, "index.html"), html)
  }
  console.log(`${seen.size} spot pages -> ${path.relative(process.cwd(), OUT) || "."}`)
}

main().catch((e) => { console.error(e.message); process.exit(1) })
