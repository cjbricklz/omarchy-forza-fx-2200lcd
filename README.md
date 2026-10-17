# Forza FX-2200LCD UPS for Omarchy

An Omarchy bar widget that shows the state of a Forza FX-2200LCD (2200 VA) UPS. The bar icon shows the battery level and charge. Click it to open a popup.

- **Status**: on mains, charging, on battery, battery low, overloaded, replace battery.
- **Battery** charge bar, estimated **runtime** and **load** (with watts, when the UPS reports its real power rating).
- **Mains in**, **output** and **battery** voltage, plus input frequency and temperature when reported.

It is read-only. It does not change UPS settings or trigger tests.

## Requirements

- Omarchy 4.
- [NUT](https://networkupstools.org/) (`nut`, which provides `upsc`) with a running server that has your UPS configured. `omarchy pkg add nut` installs it.

The widget only talks to NUT. It does not open the USB device itself.

## Set up NUT for the UPS

The FX-2200LCD connects over USB. Many Forza units show up in `lsusb` as `0665:5161 Cypress Semiconductor USB to Serial`, which NUT drives with `nutdrv_qx` (older name `blazer_usb`). Check yours first:

```sh
lsusb
```

Then, as root, a minimal setup:

```ini
# /etc/nut/nut.conf
MODE=standalone

# /etc/nut/ups.conf
[forza]
  driver = nutdrv_qx
  port = auto
  vendorid = 0665
  productid = 5161
  subdriver = cypress
  protocol = voltronic-qs-hex
  desc = "Forza FX-2200LCD"
```

```sh
sudo systemctl enable --now nut-driver-enumerator.service nut-driver@forza.service nut-server.service
upsc forza@localhost
```

If `upsc` prints `battery.charge` and `ups.status`, the widget will work. If your unit has a different USB ID or reports nothing, check the [NUT hardware compatibility list](https://networkupstools.org/stable-hcl.html) and adjust `driver` and `protocol` there. This is the configuration used while developing the plugin.

## Install

```sh
omarchy plugin add https://github.com/cjbricklz/omarchy-forza-fx-2200lcd --enable
```

To update it to the latest version:

```sh
omarchy plugin update puck.forza-fx-2200lcd
```

To remove it:

```sh
omarchy plugin remove puck.forza-fx-2200lcd
```

## Pick the UPS

The widget asks `localhost` for its UPS list and uses the one named like `forza`/`fx`, otherwise the first. To pick one, or to read from another machine's NUT server, add settings to the widget's entry in `~/.config/omarchy/shell.json`:

```json
{ "id": "puck.forza-fx-2200lcd", "ups": "forza", "host": "localhost" }
```

## Notes

- The bar icon refreshes every 30 s while the popup is closed, every 5 s while it is open.
- This unit's driver reports no `battery.runtime` (NUT: "runtimecal not set"), so the runtime row is hidden. Setting `runtimecal` in `ups.conf` makes NUT estimate it.
- Which values appear depends on what the NUT driver reports for the unit. Missing ones show as "—" or are hidden.
- This unit's driver reports no real power rating, so watts are hidden until you set one. Add `"watts"` (the W figure on the UPS label, not the 2200 VA one) to the widget's entry in `shell.json`, e.g. `{ "id": "puck.forza-fx-2200lcd", "watts": 1200 }`. The result is an estimate of what the connected devices draw (output only), so it reads lower than a wall meter, which also counts the UPS's own consumption. It is also approximate because `ups.load` is a percentage that may be based on VA rather than watts.
- Watts are `ups.load` × `ups.realpower.nominal`, or `ups.realpower` if the driver provides it.

## Tests

```sh
node tests/model.test.js
```

## License

MIT. See [LICENSE](LICENSE).
