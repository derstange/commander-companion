# Commander Companion

Lebenszähler und Turnierplaner für Commander (Magic: The Gathering).

## Normal nutzen (ohne Server)

1. Auf dem Handy in Safari öffnen: **https://derstange.github.io/commander-companion/**
2. Teilen → „Zum Home-Bildschirm“ → Hinzufügen.
3. Fertig. Die App funktioniert danach auch offline. Spiel und Turnier werden nur auf dem Gerät gespeichert.

Details und Sicherungen: [INSTALLATION_iPHONE.txt](INSTALLATION_iPHONE.txt)

## Turniertag mit Beamer (mit lokalem Server)

Alle Handys sehen dasselbe Turnier, und der große Bildschirm zeigt die Übersicht live.

**Einmalig einrichten** (auf Laptop oder Raspberry Pi, im Repository-Ordner):
```powershell
python -m venv server\.venv
server\.venv\Scripts\python -m pip install -r server\requirements.txt
```
(Pi/Linux: `python3 -m venv server/.venv` und `server/.venv/bin/pip install -r server/requirements.txt`)

**Am Turniertag:**
1. Laptop/Pi ins selbe WLAN wie die Handys bringen.
2. Server starten:
   - Windows: `server\.venv\Scripts\python server\serve.py`
   - Pi/Linux: `server/.venv/bin/python server/serve.py`
3. Am Laptop `http://localhost:8000/` öffnen → **Turnier** → Turnier anlegen → **⛶ Vollbild**.
4. Spieler scannen den **QR-Code oben rechts** in der Vollbild-Übersicht.
5. Am Handy: Turnier → Tisch starten → spielen → Sieger antippen. Der Beamer aktualisiert sich sofort.
6. Danach den Server im Terminal mit `Strg+C` beenden. Das Turnier bleibt gespeichert.

Hinweise: Über den QR-Code läuft die App als normaler Browser-Tab (nicht offline). Windows beim ersten Start
den Netzwerkzugriff für **private Netzwerke** erlauben. Mehr in [server/README.md](server/README.md).

## Rechtliches

Commander Companion ist inoffizieller Fan-Content gemäß der Fan Content Policy von Wizards of the Coast.
Nicht von Wizards genehmigt oder unterstützt. Teile der verwendeten Materialien sind Eigentum von Wizards of the Coast.
©Wizards of the Coast LLC. Kartendaten und -bilder: [Scryfall](https://scryfall.com).
