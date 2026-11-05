# Lokaler Turnier-Server (optional)

Die App läuft normalerweise nur im Browser (GitHub Pages, auf dem iPhone installierbar). Dieser kleine
Python-Server ist **optional**. Für einen Turnierabend auf Laptop oder Raspberry Pi starten:

- Alle Handys im WLAN öffnen die App per QR-Code und sehen **dasselbe Turnier**.
- Die Handys starten Tische („Tisch starten“) und tragen Sieger ein.
- Laptop/Beamer zeigt die Vollbild-Übersicht (`⛶ Vollbild`). Sie aktualisiert sich live und zeigt oben rechts den QR-Code.

Der Lebenszähler bleibt auf jedem Gerät für sich. Ohne Server verhält sich die App genau wie bisher.

## Checkliste Turniertag (Raspberry Pi)

1. **IP des Pi notieren** (steht im QR-Code), im Router möglichst als feste IP eintragen.
   Damit bleibt die Adresse für Handys, PC und SSH den ganzen Tag gleich.
2. **Turnier am großen PC anlegen**: `http://<Pi-IP>:8000/` öffnen → Turnier → Spieler, Runden, Commander.
   Die Enthüllung mit Animation läuft auf dem Gerät, auf dem getippt wird.
3. **Vor dem Start prüfen** (per SSH): `vcgencmd get_throttled` sollte `throttled=0x0` zeigen
   (sonst Netzteil zu schwach). Temperatur: `vcgencmd measure_temp`, unter 80 °C ist alles gut.
4. **HDMI einstecken**, mit der Maus Turnier → `⛶ Vollbild`. Bleibt der Bildschirm schwarz:
   `sudo systemctl restart kiosk` (Turnier bleibt erhalten).
5. **Handys** scannen den QR-Code oben rechts. Android lädt nicht? Dem Browser **„Geräte in der Nähe“** erlauben.
6. **Pi hängt?** `sudo reboot` per SSH. Alle Eingaben liegen in `server/data/` und überstehen den Neustart.
7. **Am Ende** `sudo poweroff` und warten, bis die grüne LED aus ist. Nicht einfach den Stecker ziehen.

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

Getestet mit Raspberry Pi OS Lite (64-bit, Trixie) auf einem Pi 3B+ mit Benutzer `pi`. Der Pi startet ohne
Desktop direkt in Chromium (Kiosk) und zeigt die App per HDMI. Mit angeschlossener Maus Turnier → `⛶ Vollbild` öffnen.
Vorher den Server wie oben als Dienst `commander` einrichten.

**1. Pakete** (Emoji-Schrift für die Symbole auf den Buttons, sonst bleiben sie leer)
```bash
sudo apt install -y cage chromium curl fonts-noto-color-emoji fonts-noto-core fonts-dejavu-core
```

**2. Startskript `~/kiosk.sh`**
```bash
cat > ~/kiosk.sh <<'EOF'
#!/bin/sh
# Keine "Seiten wiederherstellen?"-Leiste nach Stromausfall.
P="$HOME/.config/chromium/Default/Preferences"
[ -f "$P" ] && sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]*"/"exit_type":"Normal"/' "$P"
exec cage -s -- chromium --kiosk --no-first-run --noerrdialogs \
  --disable-translate --disable-features=Translate --password-store=basic \
  --check-for-update-interval=31536000 http://localhost:8000/
EOF
chmod +x ~/kiosk.sh
```

**3. Dienst `/etc/systemd/system/kiosk.service`** (startet auf dem HDMI-Bildschirm, sobald der Server antwortet)
```bash
sudo tee /etc/systemd/system/kiosk.service >/dev/null <<'EOF'
[Unit]
Description=Commander kiosk (cage + Chromium on HDMI)
After=commander.service systemd-user-sessions.service
Wants=commander.service
Conflicts=getty@tty1.service

[Service]
User=pi
PAMName=login
TTYPath=/dev/tty1
TTYReset=yes
TTYVHangup=yes
StandardInput=tty
StandardOutput=journal
StandardError=journal
UtmpIdentifier=tty1
UtmpMode=user
ExecStartPre=/bin/sh -c 'until curl -s -o /dev/null http://localhost:8000/api/status; do sleep 1; done'
ExecStart=/home/pi/kiosk.sh
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now kiosk
```
Keine Konsolen-Autoanmeldung nötig (raspi-config: Boot → Console, mit Login). Fehler stehen in `journalctl -u kiosk -b`.
`status=127` dort heißt: `cage` oder `chromium` fehlt.

**4. Bluetooth-Maus** (der Pi 3B+ hat Bluetooth eingebaut; eine Maus mit USB-Empfänger einfach einstecken)
```bash
sudo apt install -y bluez && sudo systemctl enable --now bluetooth
bluetoothctl   # dann: power on · agent on · default-agent · scan on
               # Maus in Kopplungsmodus, Adresse ablesen, dann:
               # scan off · pair <MAC> · trust <MAC> · connect <MAC> · quit
```
`trust` sorgt dafür, dass die Maus nach Neustart oder Ruhezustand von selbst wieder verbindet.

**5. Auflösung 720p** (empfohlen auf dem Pi 3, deutlich flüssiger)

Ohne Vorgabe nimmt der Pi die bevorzugte Auflösung des Bildschirms (Pi 3: höchstens etwa 1920×1200).
Chromium zeichnet dort meist ohne Grafikchip-Hilfe, jedes Pixel kostet Rechenzeit. 1280×720 kann praktisch
jeder Fernseher und Monitor, die Übersicht passt (sie braucht mindestens 901 px Breite).
```bash
sudo cp /boot/firmware/cmdline.txt /boot/firmware/cmdline.txt.bak
sudo sed -i '1 s/$/ video=HDMI-A-1:1280x720@60/' /boot/firmware/cmdline.txt
cat /boot/firmware/cmdline.txt   # muss EINE Zeile sein, endet auf video=HDMI-A-1:1280x720@60
sudo reboot
```
Aktuellen Modus prüfen: `sudo apt install -y kms++-utils && kmsprint`. Schärfer, aber langsamer:
`1920x1080@60` statt `1280x720@60`. Rückgängig:
`sudo cp /boot/firmware/cmdline.txt.bak /boot/firmware/cmdline.txt && sudo reboot`.

**Bedienung und Pflege**
- Kiosk verlassen am Pi: `Strg+Alt+F2` (Text-Login), zurück mit `Strg+Alt+F1`. Per SSH geht alles wie gewohnt.
- Update: `cd ~/commander-companion && git pull && sudo systemctl restart commander kiosk`
- Netzwerkkabel ist am Pi 3 stabiler als WLAN. Eine feste IP in der FritzBox hält den QR-Code gleich
  (Heimnetz → Netzwerk → Gerät → „Diesem Netzwerkgerät immer die gleiche IPv4-Adresse zuweisen“).
- Wird das Kabel erst nach dem Start eingesteckt, zeigt der QR-Code noch die WLAN-Adresse:
  `sudo systemctl restart commander`.
- Bild am Rand abgeschnitten: `disable_overscan=1` in `/boot/firmware/config.txt`.

**Immer noch zu langsam?** (zuerst 720p einstellen, siehe Schritt 5)
- In `~/kiosk.sh` probeweise `--ignore-gpu-blocklist --enable-gpu-rasterization` ergänzen
  (bei Bildfehlern wieder entfernen) und/oder `--force-prefers-reduced-motion` (weniger Animationen).
- `free -h` bei offener Seite: unter ~100 MB „available“ wird es zäh.
