# Lokaler Turnier-Server (optional)

Die App läuft normalerweise nur im Browser (GitHub Pages, auf dem iPhone installierbar). Dieser kleine
Python-Server ist **optional**. Für einen Turnierabend auf Laptop oder Raspberry Pi starten:

- Alle Handys im WLAN öffnen die App per QR-Code und sehen **dasselbe Turnier**.
- Die Handys starten Tische („Tisch starten“) und tragen Sieger ein.
- Laptop/Beamer zeigt die Vollbild-Übersicht (`⛶ Vollbild`). Sie aktualisiert sich live und zeigt oben rechts den QR-Code.

Der Lebenszähler bleibt auf jedem Gerät für sich. Ohne Server verhält sich die App genau wie bisher.

## Einrichten (einmalig)

Python 3.8 oder neuer. Im Repository-Ordner ausführen:

**Windows (PowerShell)**
```powershell
python -m venv server\.venv
server\.venv\Scripts\python -m pip install -r server\requirements.txt
```

**Raspberry Pi / Linux / macOS**
```bash
python3 -m venv server/.venv
server/.venv/bin/pip install -r server/requirements.txt
```

## Starten

```powershell
server\.venv\Scripts\python server\serve.py          # Windows
```
```bash
server/.venv/bin/python server/serve.py              # Pi / Linux / macOS
```

Im Terminal erscheinen die Adresse (z.B. `http://192.168.1.20:8000/`) und ein QR-Code.

- **Großer Bildschirm:** auf dem Server-Rechner `http://localhost:8000/` öffnen → Turnier → `⛶ Vollbild`.
- **Handys:** QR-Code oben rechts in der Vollbild-Übersicht scannen (öffnet in Safari/Chrome).
- Auf der Turnierseite zeigt `● Live über …` die Verbindung an.
- **Android lädt die Seite nicht?** Dem Browser die Berechtigung **„Geräte in der Nähe“** erlauben
  (App lange drücken → App-Info → Berechtigungen). Ohne sie erreicht der Browser nur das Internet,
  aber kein Gerät im WLAN, nicht einmal die FritzBox.

Optionen: `--port 8080`, `--host 192.168.1.20` (Adresse im QR-Code, falls die automatisch erkannte nicht passt).
Windows fragt beim ersten Start evtl., ob Python ins Netzwerk darf: **private Netzwerke** erlauben.

Das Turnier liegt in `server/data/tournament.json` (nicht in git) und übersteht einen Neustart.
„Neues Turnier“ in der App löscht es für alle.

## Turniere mit Namen speichern (nur Laptop/Pi)

Am Laptop oder Pi (nicht am Handy) öffnen **💾 Turnier sichern** und **📂 Turnier laden** einen Dialog:

- **Sichern:** Namen eingeben → **🖥 Auf Server speichern** oder wie bisher **💾 JSON herunterladen**.
  Ein auf dem Server gespeichertes Turnier wird danach bei jeder Änderung (auch vom Handy) automatisch aktualisiert.
- **Laden:** einen gespeicherten Stand aus der Liste wählen oder **📂 Datei auswählen …**.

Die Stände liegen in `server/data/saves/` (höchstens 100). Zum Löschen die Datei dort entfernen.
Dateinamen sind zufällige IDs; der Turniername steht nur in der Datei. Eine geladene JSON-Datei ist nie
mit einem Server-Stand verknüpft, überschreibt ihn also nicht.

## Gut zu wissen

- Über die lokale Adresse (`http://…`) läuft die App als normaler Browser-Tab, nicht installierbar und nicht offline.
  Dafür weiterhin die GitHub-Adresse nutzen. Die von GitHub installierte App erreicht den lokalen Server nicht.
- Auf Android-Handys schaltet der Lebenszähler beim Start einer Partie in den Browser-Vollbildmodus (ohne Adressleiste).
  Wieder hinein: Schlachtmenü → **⛶ Vollbild**. Auf dem iPhone gibt es das in Safari nicht; dort
  „Teilen → Zum Home-Bildschirm“ verwenden, dann öffnet die Seite ohne Adressleiste.
- Über `http://` gibt es kein automatisches Wachhalten des Bildschirms. Für den Abend die Displaysperre am Handy verlängern.
- Lokale Adresse und GitHub-App haben getrennte Daten. Ein Turnier überträgst du mit „Turnier sichern“ auf
  dem einen und „Turnier laden“ auf dem anderen Gerät. Hat ein Gerät schon ein Turnier und der Server noch keins,
  fragt die App, ob es geteilt werden soll.
- Speichern zwei Handys gleichzeitig, bleiben beide Änderungen erhalten (z.B. Sieger an verschiedenen Tischen).
- Der Server liefert nur die App-Dateien aus, nicht `server/`, `tests/` oder `.git`. Er hat kein Passwort:
  nur in einem vertrauenswürdigen WLAN betreiben.

## Raspberry Pi: automatisch starten (optional)

`/etc/systemd/system/commander.service` (Pfad und Benutzer anpassen):
```ini
[Unit]
Description=Commander Companion
After=network-online.target

[Service]
User=pi
WorkingDirectory=/home/pi/commander-companion
ExecStart=/home/pi/commander-companion/server/.venv/bin/python server/serve.py
Restart=on-failure

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl enable --now commander
```

## Raspberry Pi als Anzeige am Fernseher (optional)

Getestet mit Raspberry Pi OS Lite (64-bit) auf einem Pi 3B+. Der Pi zeigt die App per HDMI; mit angeschlossener Maus
Turnier → `⛶ Vollbild` öffnen.
Server wie oben als Dienst einrichten, dann:

```bash
sudo apt install -y cage chromium curl
sudo raspi-config   # System Options → Boot / Auto Login → Console Autologin
cat >> ~/.bash_profile <<'EOF'
if [ "$(tty)" = /dev/tty1 ]; then
  until curl -s localhost:8000/api/status >/dev/null; do sleep 1; done
  exec cage -- chromium --kiosk --noerrdialogs --disable-translate \
    --disable-features=Translate --check-for-update-interval=31536000 \
    "http://localhost:8000/"
fi
EOF
sudo reboot
```

- Pi 3: Netzwerkkabel ist stabiler als WLAN. Eine feste IP in der FritzBox hält den QR-Code gleich
  (Heimnetz → Netzwerk → Gerät → „Diesem Netzwerkgerät immer die gleiche IPv4-Adresse zuweisen“).
- Wird das Kabel erst nach dem Start eingesteckt, zeigt der QR-Code noch die WLAN-Adresse:
  `sudo systemctl restart commander`.
