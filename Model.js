// Pure helpers for the Forza panel: parsing `upsc` output, status flags,
// formatting. Kept free of QML so it can be tested with node.

// Nerd Font (Material Design) glyphs are above U+FFFF, so build them from the code point.
function glyph(cp) {
  var n = cp - 0x10000
  return String.fromCharCode(0xD800 + (n >> 10), 0xDC00 + (n & 0x3FF))
}

// Same glyph sets as Omarchy's own battery widget, so the two look alike.
var LEVELS = [0xF007A, 0xF007B, 0xF007C, 0xF007D, 0xF007E, 0xF007F, 0xF0080, 0xF0081, 0xF0082, 0xF0079].map(glyph)
var CHARGING = [0xF089C, 0xF0086, 0xF0087, 0xF0088, 0xF089D, 0xF0089, 0xF089E, 0xF008A, 0xF008B, 0xF0085].map(glyph)
var ICON = {
  full: glyph(0xF0079),
  charging: glyph(0xF0085),
  alert: glyph(0xF0083),
  unknown: glyph(0xF0091)
}

function clamp(v, lo, hi) {
  var n = Math.round(Number(v))
  if (!isFinite(n)) n = lo
  return Math.max(lo, Math.min(hi, n))
}

// Parses `upsc ups@host` ("key: value" per line) into {key: value}.
function parseUpsc(text) {
  var out = {}
  var lines = String(text || "").split("\n")
  for (var i = 0; i < lines.length; i++) {
    var at = lines[i].indexOf(":")
    if (at <= 0 || /^Error:/.test(lines[i])) continue
    out[lines[i].slice(0, at).trim()] = lines[i].slice(at + 1).trim()
  }
  return out
}

// Picks the UPS to talk to from `upsc -l`: the configured name, else one
// called forza*, else the first. Returns "" when there is none.
function pickUps(text, wanted) {
  var names = String(text || "").split("\n").map(function(s) { return s.trim() })
      .filter(function(s) { return s !== "" && s.indexOf(" ") < 0 && s.indexOf(":") < 0 })
  if (wanted) return names.indexOf(wanted) >= 0 ? wanted : ""
  for (var i = 0; i < names.length; i++) if (/forza|fx/i.test(names[i])) return names[i]
  return names.length ? names[0] : ""
}

function num(vars, key) {
  var n = parseFloat(vars[key])
  return isFinite(n) ? n : null
}

// ups.status is a space separated list of NUT flags: OL OB LB CHRG DISCHRG RB
// BYPASS OVER TRIM BOOST ALARM FSD OFF.
function parseStatus(text) {
  var flags = String(text || "").trim().split(/\s+/).filter(function(s) { return s !== "" })
  var has = function(f) { return flags.indexOf(f) >= 0 }
  var onBattery = has("OB") || has("DISCHRG")
  var lowBattery = has("LB")
  var level = "ok"
  var label = "LINE MODE"
  if (flags.length === 0) { level = "unknown"; label = "NO STATUS" }
  else if (has("FSD")) { level = "critical"; label = "SHUTTING DOWN" }
  else if (onBattery && lowBattery) { level = "critical"; label = "BATTERY LOW" }
  else if (onBattery) { level = "warn"; label = "BATTERY MODE" }
  else if (has("OVER")) { level = "warn"; label = "OVERLOADED" }
  else if (has("RB")) { level = "warn"; label = "REPLACE BATTERY" }
  else if (has("CHRG")) label = "LINE MODE · CHARGING"
  else if (has("BOOST")) label = "LINE MODE · BOOST"
  else if (has("TRIM")) label = "LINE MODE · TRIM"
  else if (has("BYPASS")) { level = "warn"; label = "BYPASS MODE" }
  else if (has("OFF")) { level = "warn"; label = "OFF" }
  return { flags: flags, onBattery: onBattery, lowBattery: lowBattery, level: level, label: label }
}

// Turns raw upsc variables into the numbers the popup shows (null = not reported).
// ratedWatts is the UPS's real power rating from its label, used when the driver reports none.
function summarize(vars, ratedWatts) {
  var st = parseStatus(vars["ups.status"])
  var load = num(vars, "ups.load")
  var nominal = num(vars, "ups.realpower.nominal")
  if (nominal === null && ratedWatts > 0) nominal = Number(ratedWatts)
  var watts = num(vars, "ups.realpower")
  if (watts === null && load !== null && nominal !== null) watts = Math.round(load * nominal / 100)
  return {
    status: st,
    charge: num(vars, "battery.charge"),
    runtime: num(vars, "battery.runtime"),          // seconds
    load: load,
    watts: watts,
    inputV: num(vars, "input.voltage"),
    outputV: num(vars, "output.voltage"),
    batteryV: num(vars, "battery.voltage"),
    freq: num(vars, "input.frequency") !== null ? num(vars, "input.frequency") : num(vars, "output.frequency"),
    temp: num(vars, "ups.temperature"),
    model: vars["device.model"] || vars["ups.model"] || "",
    driver: vars["driver.name"] || ""
  }
}

function formatRuntime(seconds) {
  if (seconds === null || seconds === undefined || !isFinite(seconds)) return "—"
  var m = Math.floor(seconds / 60)
  if (m >= 60) return Math.floor(m / 60) + " h " + (m % 60) + " min"
  if (m >= 1) return m + " min"
  return Math.round(seconds) + " s"
}

function formatNum(v, unit, digits) {
  if (v === null || v === undefined || !isFinite(v)) return "—"
  return (digits ? v.toFixed(digits) : String(Math.round(v))) + (unit ? " " + unit : "")
}

// Bar icon for the charge and status, one glyph per 10% step.
function iconFor(s) {
  if (!s || s.charge === null) return ICON.unknown
  if (s.status.level === "critical") return ICON.alert
  var step = clamp(Math.floor(s.charge / 10), 0, 9)
  if (s.status.onBattery) return LEVELS[step]
  return s.status.flags.indexOf("CHRG") >= 0 ? CHARGING[step] : (s.charge >= 95 ? ICON.charging : LEVELS[step])
}

if (typeof module !== "undefined") module.exports = { glyph, ICON, LEVELS, CHARGING, clamp, parseUpsc, pickUps, parseStatus,
                                                      summarize, formatRuntime, formatNum, iconFor }
