const M = require('../Model.js'), a = require('assert')

const real = `battery.charge: 100
battery.runtime: 1380
battery.voltage: 27.3
device.model: FX-2200LCD
driver.name: blazer_usb
input.frequency: 50.0
input.voltage: 231.4
output.voltage: 231.4
ups.load: 22
ups.status: OL
ups.realpower.nominal: 1200
`
const v = M.parseUpsc(real)
a.strictEqual(v['battery.charge'], '100')
a.strictEqual(v['ups.status'], 'OL')
a.deepStrictEqual(M.parseUpsc('Error: Connection failure: Connection refused\n'), {}, 'error line has no value')
a.deepStrictEqual(M.parseUpsc(undefined), {})

const s = M.summarize(v)
a.strictEqual(s.charge, 100)
a.strictEqual(s.runtime, 1380)
a.strictEqual(s.load, 22)
a.strictEqual(s.watts, 264, 'load% of nominal real power')
a.strictEqual(s.model, 'FX-2200LCD')
a.strictEqual(M.summarize({}).charge, null)
a.strictEqual(M.summarize({ 'ups.load': '10' }).watts, null, 'no nominal, no watts')
a.strictEqual(M.summarize({ 'ups.realpower': '300' }).watts, 300)

a.strictEqual(M.pickUps('forza\nother\n'), 'forza')
a.strictEqual(M.pickUps('apc\nmyfx\n'), 'myfx', 'name hint')
a.strictEqual(M.pickUps('apc\nups2\n'), 'apc', 'first')
a.strictEqual(M.pickUps('apc\nups2\n', 'ups2'), 'ups2', 'configured')
a.strictEqual(M.pickUps('apc\n', 'nope'), '', 'configured but absent')
a.strictEqual(M.pickUps('Error: Connection failure: Connection refused\n'), '', 'server down')
a.strictEqual(M.pickUps(''), '')

a.strictEqual(M.parseStatus('OL').level, 'ok')
a.strictEqual(M.parseStatus('OL CHRG').label, 'LINE MODE · CHARGING')
a.strictEqual(M.parseStatus('OB DISCHRG').label, 'BATTERY MODE')
a.strictEqual(M.parseStatus('OB DISCHRG LB').level, 'critical')
a.strictEqual(M.parseStatus('OL RB').label, 'REPLACE BATTERY')
a.strictEqual(M.parseStatus('OL OVER').label, 'OVERLOADED')
a.strictEqual(M.parseStatus('').level, 'unknown')
a.strictEqual(M.parseStatus('FSD OB LB').label, 'SHUTTING DOWN')

a.strictEqual(M.formatRuntime(1380), '23 min')
a.strictEqual(M.formatRuntime(4000), '1 h 6 min')
a.strictEqual(M.formatRuntime(45), '45 s')
a.strictEqual(M.formatRuntime(null), '—')
a.strictEqual(M.formatNum(231.44, 'V', 1), '231.4 V')
a.strictEqual(M.formatNum(22, '%'), '22 %')
a.strictEqual(M.formatNum(null, 'V'), '—')

a.strictEqual(M.glyph(0xF0079).codePointAt(0), 0xF0079)
a.strictEqual(M.iconFor(s), M.ICON.charging, 'full on mains')
a.strictEqual(M.iconFor(M.summarize({ 'battery.charge': '50', 'ups.status': 'OL CHRG' })), M.CHARGING[5])
a.strictEqual(M.iconFor(M.summarize({ 'battery.charge': '50', 'ups.status': 'OB DISCHRG' })).codePointAt(0), 0xF007F)
a.strictEqual(M.iconFor(M.summarize({ 'battery.charge': '10', 'ups.status': 'OB DISCHRG' })).codePointAt(0), 0xF007B)
a.strictEqual(M.iconFor(M.summarize({ 'battery.charge': '5', 'ups.status': 'OB LB' })), M.ICON.alert)
a.strictEqual(M.iconFor(M.summarize({})), M.ICON.unknown)

const mine = M.summarize(M.parseUpsc(`battery.charge: 100
battery.voltage: 27.41
input.voltage: 120.3
output.frequency: 59.9
output.voltage: 120.3
ups.load: 12
ups.status: OL
`))
a.strictEqual(mine.runtime, null, 'this unit reports no runtime')
a.strictEqual(mine.freq, 59.9, 'falls back to output.frequency')
a.strictEqual(mine.watts, null)
a.strictEqual(mine.status.label, 'LINE MODE')
a.strictEqual(M.summarize({ 'ups.load': '12' }, 1200).watts, 144, 'rated watts from settings')
a.strictEqual(M.summarize({ 'ups.load': '12' }, 0).watts, null)
console.log('ok')
