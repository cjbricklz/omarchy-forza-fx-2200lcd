// Forza FX-2200LCD UPS bar widget + popup: charge, runtime, load and voltages,
// read from a NUT server with `upsc`. Read-only.
// Modeled on the built-in omarchy.monitor panel.
import QtQuick
import QtQuick.Controls
import Quickshell
import Quickshell.Io
import qs.Ui
import qs.Commons
import "Model.js" as Model

Panel {
  id: root
  moduleName: "puck.forza-fx-2200lcd"
  ipcTarget: "puck.forza-fx-2200lcd"

  // "ups" and "host" in shell.json win; otherwise `upsc -l` finds the UPS once.
  readonly property string upsOverride: String(setting("ups", ""))
  readonly property string host: String(setting("host", "localhost"))
  property string detectedUps: ""
  readonly property string ups: detectedUps

  // "detecting" until a UPS name is known, "missing" when the NUT server lists none,
  // then "ready" or "silent" depending on whether the last read answered.
  property string status: "detecting"
  readonly property bool ready: status === "ready"

  property var info: null          // Model.summarize result, null until read
  readonly property string accent: !info ? root.bar.foreground
      : info.status.level === "critical" ? "#e06c75"
      : info.status.level === "warn" ? "#e5c07b" : root.bar.foreground

  function detect() {
    if (lister.running) return
    status = "detecting"
    lister.running = true
  }

  function applyList(text) {
    detectedUps = Model.pickUps(text, upsOverride)
    if (ups === "") { status = "missing"; info = null; return }
    status = "silent"
    refresh()
  }

  function refresh() {
    if (ups === "") detect()
    else if (!reader.running) reader.running = true
  }

  function applyRead(text) {
    var vars = Model.parseUpsc(text)
    if (vars["ups.status"] === undefined) { status = "silent"; return }
    info = Model.summarize(vars)
    status = "ready"
  }

  function stateJson() {
    return JSON.stringify({ status: status, ups: ups, host: host, info: info })
  }

  IpcHandler {
    target: "puck.forza-fx-2200lcd.ups"
    function state(): string { return root.stateJson() }
    function refresh(): void { root.refresh() }
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  Component.onCompleted: detect()
  onOpenedChanged: if (opened) {
    // A missing or silent UPS may have come back (server started), so look again.
    if (status !== "ready") detectedUps = ""
    refresh()
  }

  Timer { interval: 5000; repeat: true; running: root.opened; onTriggered: root.refresh() }
  // Keeps the bar icon current while closed.
  Timer { interval: 30000; repeat: true; running: !root.opened; onTriggered: root.refresh() }

  Process {
    id: lister
    command: ["upsc", "-l", root.host]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.applyList(text)
    }
  }

  Process {
    id: reader
    command: ["upsc", root.ups + "@" + root.host]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.applyRead(text)
    }
  }

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: !root.ready ? Model.ICON.unknown
          : Model.iconFor(root.info) + (root.info.charge !== null ? " " + Math.round(root.info.charge) + "%" : "")
    onPressed: function(b) { root.toggle() }
  }

  KeyboardPanel {
    id: panel
    anchorItem: button
    owner: root
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(340))
    contentHeight: panel.fittedContentHeight(column.implicitHeight, Style.space(640))

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }

      Column {
        id: column
        width: parent.width
        spacing: Style.space(12)

        // ---------- Hero ----------
        Item {
          width: parent.width
          implicitHeight: Math.max(heroIcon.implicitHeight, heroText.implicitHeight)
          Text {
            id: heroIcon
            text: root.ready ? Model.iconFor(root.info) : Model.ICON.unknown
            color: root.accent
            font.family: root.bar.fontFamily
            font.pixelSize: Style.font.display
            anchors.verticalCenter: parent.verticalCenter
          }
          Column {
            id: heroText
            anchors.left: heroIcon.right
            anchors.leftMargin: Style.space(14)
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            spacing: Style.space(2)
            Text {
              text: "Forza FX-2200LCD"
              color: root.bar.foreground
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.title
              font.bold: true
            }
            Text {
              text: ({ detecting: "LOOKING FOR UPS",
                       missing: "NO UPS FOUND ON " + root.host.toUpperCase(),
                       silent: "UPS NOT RESPONDING",
                       ready: root.info ? root.info.status.label : "" })[root.status]
              color: root.accent
              font.family: root.bar.fontFamily
              font.pixelSize: Style.font.caption
              font.bold: true
              font.letterSpacing: 1.2
            }
          }
        }

        Column {
          visible: root.ready
          width: parent.width
          spacing: Style.space(12)

          PanelSeparator { foreground: root.bar.foreground }

          // Battery charge bar.
          Column {
            width: parent.width
            spacing: Style.space(6)
            Item {
              width: parent.width
              implicitHeight: chargeHeader.implicitHeight
              PanelSectionHeader {
                id: chargeHeader
                text: Model.ICON.full + "  BATTERY"
                foreground: root.bar.foreground
                fontFamily: root.bar.fontFamily
                anchors.left: parent.left
                anchors.verticalCenter: parent.verticalCenter
              }
              Text {
                text: root.info ? Model.formatNum(root.info.charge, "%") : ""
                color: Qt.darker(root.bar.foreground, 1.4)
                font.family: root.bar.fontFamily
                font.pixelSize: Style.font.caption
                font.bold: true
                anchors.right: parent.right
                anchors.rightMargin: Style.space(6)
                anchors.verticalCenter: parent.verticalCenter
              }
            }
            Rectangle {
              width: parent.width - Style.space(12)
              x: Style.space(6)
              height: Style.space(8)
              radius: height / 2
              color: Qt.rgba(root.bar.foreground.r, root.bar.foreground.g, root.bar.foreground.b, 0.15)
              Rectangle {
                width: parent.width * Model.clamp(root.info ? root.info.charge : 0, 0, 100) / 100
                height: parent.height
                radius: parent.radius
                color: root.accent
              }
            }
          }

          Stat { visible: root.info && root.info.runtime !== null; label: "RUNTIME"
                 value: root.info ? Model.formatRuntime(root.info.runtime) : "" }
          Stat { label: "LOAD"; value: root.info ? Model.formatNum(root.info.load, "%")
                                                  + (root.info.watts !== null ? " · " + root.info.watts + " W" : "") : "" }

          PanelSeparator { foreground: root.bar.foreground }

          Stat { label: "MAINS IN"; value: root.info ? Model.formatNum(root.info.inputV, "V", 1) : "" }
          Stat { label: "OUTPUT"; value: root.info ? Model.formatNum(root.info.outputV, "V", 1) : "" }
          Stat { label: "BATTERY"; value: root.info ? Model.formatNum(root.info.batteryV, "V", 1) : "" }
          Stat { visible: root.info && root.info.freq !== null; label: "FREQUENCY"
                 value: root.info ? Model.formatNum(root.info.freq, "Hz", 1) : "" }
          Stat { visible: root.info && root.info.temp !== null; label: "TEMPERATURE"
                 value: root.info ? Model.formatNum(root.info.temp, "°C", 1) : "" }
        }

        Text {
          visible: root.status === "missing" || root.status === "silent"
          width: parent.width
          wrapMode: Text.WordWrap
          text: "Start the NUT server for the UPS (see the README), then reopen this popup."
          color: Qt.darker(root.bar.foreground, 1.4)
          font.family: root.bar.fontFamily
          font.pixelSize: Style.font.caption
        }

        Item { width: parent.width; height: Style.space(4) }
      }
    }
  }

  component Stat: Item {
    property string label
    property string value
    width: parent ? parent.width : 0
    implicitHeight: statLabel.implicitHeight
    Text {
      id: statLabel
      text: parent.label
      color: Qt.darker(root.bar.foreground, 1.4)
      font.family: root.bar.fontFamily
      font.pixelSize: Style.font.caption
      font.bold: true
      font.letterSpacing: 1.2
      anchors.left: parent.left
      anchors.leftMargin: Style.space(6)
    }
    Text {
      text: parent.value
      color: root.bar.foreground
      font.family: root.bar.fontFamily
      font.pixelSize: Style.font.body
      anchors.right: parent.right
      anchors.rightMargin: Style.space(6)
      anchors.verticalCenter: statLabel.verticalCenter
    }
  }
}
