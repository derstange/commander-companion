#!/usr/bin/env python3
"""Optional local server for Commander Companion.

Serves the app to every device on the local network and keeps ONE shared
tournament, so phones can start tables / pick winners while a laptop or
projector shows the fullscreen board. The life counter stays on each device.

Without this server (e.g. on GitHub Pages) the app works exactly as before:
it finds no /api/status and keeps everything in the browser.

    python server/serve.py            # http://<your-ip>:8000/
    python server/serve.py --port 8080
"""
import argparse
import io
import json
import os
import re
import socket
import sys
import tempfile
import threading
import time
import uuid
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

try:
    import segno  # QR codes (pure Python), see requirements.txt
except ImportError:  # the app still works, the board just shows the address without a QR code
    segno = None

APP_ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = Path(__file__).resolve().parent / "data" / "tournament.json"
SAVES_DIR = Path(__file__).resolve().parent / "data" / "saves"
MAX_SAVES = 100
NAME_MAX = 60
MAX_BODY = 2 * 1024 * 1024
# Only the app itself is public; repository internals stay hidden from the network.
BLOCKED = ("/server", "/tests", "/.git", "/gilden_wappen")
KEEPALIVE_S = 15
CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://cards.scryfall.io; "
       "connect-src 'self' https://api.scryfall.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'")


class Store:
    """The shared tournament plus a revision counter. rev changes on every write."""

    def __init__(self, path):
        self.path = path
        self.cond = threading.Condition()
        self.rev = 0
        self.tournament = None
        try:
            saved = json.loads(path.read_text(encoding="utf-8"))
            self.rev = int(saved.get("rev", 0))
            self.tournament = saved.get("tournament")
        except FileNotFoundError:
            pass
        except (ValueError, OSError) as exc:
            print(f"Warnung: {path} konnte nicht gelesen werden ({exc}); starte leer.", file=sys.stderr)

    def snapshot(self):
        with self.cond:
            return {"rev": self.rev, "tournament": self.tournament}

    def put(self, base_rev, tournament):
        """Writes when the client saw the latest revision; otherwise returns the newer copy (conflict)."""
        with self.cond:
            if base_rev != self.rev:
                return False, {"rev": self.rev, "tournament": self.tournament}
            self.rev += 1
            self.tournament = tournament
            self._save()
            self.cond.notify_all()
            return True, {"rev": self.rev}

    def wait_change(self, seen_rev, timeout):
        with self.cond:
            self.cond.wait_for(lambda: self.rev != seen_rev, timeout=timeout)
            return self.rev

    def _save(self):
        write_json(self.path, {"rev": self.rev, "tournament": self.tournament})


def write_json(path, data):
    """Atomic write: a crash never leaves a half-written file behind."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, path)


class Saves:
    """Named tournament saves, one file per save in server/data/saves/<id>.json.

    The file name is always a random hex id generated here; the user's tournament name only lives
    inside the JSON. So no name can ever point outside the saves folder (path traversal).
    A tournament that carries a known saveId is written back on every change (autosave).
    """

    ID = re.compile(r"[0-9a-f]{32}")

    def __init__(self, folder):
        self.folder = folder
        self.lock = threading.Lock()

    def _path(self, save_id):
        if not isinstance(save_id, str) or not self.ID.fullmatch(save_id):
            return None
        path = (self.folder / f"{save_id}.json").resolve()
        return path if path.parent == self.folder.resolve() else None

    def _read(self, path):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) and isinstance(data.get("tournament"), dict) else None
        except (OSError, ValueError):
            return None

    def list(self):
        out = []
        with self.lock:
            for path in self.folder.glob("*.json"):
                data = self._read(path) if self.ID.fullmatch(path.stem) else None
                if not data:
                    continue
                t = data["tournament"]
                players = t.get("players")
                out.append({"id": path.stem, "name": str(data.get("name", "")), "saved": str(data.get("saved", "")),
                            "players": len(players) if isinstance(players, list) else 0,
                            "rounds": t.get("rounds") if isinstance(t.get("rounds"), int) else 0})
        out.sort(key=lambda s: s["saved"], reverse=True)
        return out

    def get(self, save_id):
        path = self._path(save_id)
        if not path:
            return None
        with self.lock:
            data = self._read(path)
        return {"id": save_id, "name": str(data.get("name", "")), "saved": str(data.get("saved", "")),
                "tournament": data["tournament"]} if data else None

    def put(self, name, tournament, save_id=None):
        """Creates a save (save_id None) or overwrites an existing one. Returns the id, or None if full / unknown."""
        with self.lock:
            if save_id is None:
                if sum(1 for _ in self.folder.glob("*.json")) >= MAX_SAVES:
                    return None
                save_id = uuid.uuid4().hex
                path = self._path(save_id)
            else:
                path = self._path(save_id)
                if not path or not path.exists():
                    return None
            tournament = {**tournament, "name": name, "saveId": save_id}
            write_json(path, {"name": name, "saved": time.strftime("%Y-%m-%dT%H:%M:%S"), "tournament": tournament})
            return save_id

    def autosave(self, tournament):
        """Keeps the named save in step with the shared tournament. Never creates new files."""
        if not isinstance(tournament, dict):
            return
        path = self._path(tournament.get("saveId"))
        if path and path.exists():
            self.put(clean_name(tournament.get("name")) or "Turnier", tournament, tournament["saveId"])


def clean_name(value):
    """Tournament names: plain text, no control characters, at most NAME_MAX characters."""
    if not isinstance(value, str):
        return ""
    return "".join(ch for ch in value if ch.isprintable()).strip()[:NAME_MAX]


def lan_ip():
    """IP address other devices on the network can reach (no packet is actually sent)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


class Handler(SimpleHTTPRequestHandler):
    store = None
    saves = None
    public_url = ""
    qr_svg = None

    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".webmanifest": "application/manifest+json", ".webp": "image/webp", ".js": "text/javascript"}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(APP_ROOT), **kwargs)

    def log_message(self, fmt, *args):  # keep the terminal readable: only tournament writes and errors
        if getattr(self, "command", None) == "PUT":
            super().log_message(fmt, *args)

    def log_error(self, fmt, *args):
        super().log_message(fmt, *args)

    def end_headers(self):
        # Always revalidate, so phones pick up a new app version right away.
        self.send_header("Cache-Control", "no-cache")
        # Safety net against injected markup (e.g. a crafted player name): no foreign or inline scripts run.
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        super().end_headers()

    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _route(self):
        path = urlsplit(self.path).path
        return path[len("/api/"):] if path.startswith("/api/") else None, path

    def do_GET(self):
        api, path = self._route()
        if api is None:
            if path.startswith(BLOCKED):
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            super().do_GET()
        elif api == "status":
            self._json(200, {"server": True, "url": self.public_url, "rev": self.store.snapshot()["rev"],
                             "qr": self.qr_svg is not None})
        elif api == "tournament":
            self._json(200, self.store.snapshot())
        elif api == "qr.svg" and self.qr_svg:
            self.send_response(200)
            self.send_header("Content-Type", "image/svg+xml")
            self.send_header("Content-Length", str(len(self.qr_svg)))
            self.end_headers()
            self.wfile.write(self.qr_svg)
        elif api == "events":
            self._events()
        elif api == "saves":
            self._json(200, {"saves": self.saves.list()})
        elif api.startswith("saves/"):
            save = self.saves.get(api[len("saves/"):])
            if save:
                self._json(200, save)
            else:
                self._json(404, {"error": "not found"})
        else:
            self.send_error(HTTPStatus.NOT_FOUND)

    def do_HEAD(self):
        api, path = self._route()
        if api is not None or path.startswith(BLOCKED):
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        super().do_HEAD()

    def _body(self):
        """The request body as JSON (dict), or None when it is missing, too large or not JSON."""
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                return None
            data = json.loads(self.rfile.read(length))
            return data if isinstance(data, dict) else None
        except (ValueError, TypeError):
            return None

    def do_PUT(self):
        api, _ = self._route()
        if api != "tournament":
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        data = self._body()
        base_rev, tournament = (data or {}).get("baseRev"), (data or {}).get("tournament", False)
        if not isinstance(base_rev, int) or not (tournament is None or isinstance(tournament, dict)):
            self._json(400, {"error": "invalid request"})
            return
        ok, payload = self.store.put(base_rev, tournament)
        if ok:
            self.saves.autosave(tournament)
        self._json(200 if ok else 409, payload)

    def do_POST(self):
        """POST /api/saves {name, tournament, id?}: stores the tournament under a name (new save, or overwrites id)."""
        api, _ = self._route()
        if api != "saves":
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        data = self._body() or {}
        name, tournament, save_id = clean_name(data.get("name")), data.get("tournament"), data.get("id")
        if not name or not isinstance(tournament, dict) or not (save_id is None or isinstance(save_id, str)):
            self._json(400, {"error": "invalid request"})
            return
        new_id = self.saves.put(name, tournament, save_id)
        if new_id:
            self._json(200, {"id": new_id, "name": name})
        else:
            self._json(409 if save_id is None else 404,
                       {"error": f"Maximal {MAX_SAVES} Spielstände" if save_id is None else "not found"})

    def _events(self):
        """Server-Sent Events: pushes the revision on every change; clients then GET the tournament."""
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        rev = self.store.snapshot()["rev"]
        try:
            self.wfile.write(f"data: {rev}\n\n".encode())
            self.wfile.flush()
            while True:
                new = self.store.wait_change(rev, KEEPALIVE_S)
                if new != rev:
                    rev = new
                    self.wfile.write(f"data: {rev}\n\n".encode())
                else:
                    self.wfile.write(b": ping\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
            pass  # client went away


def main():
    parser = argparse.ArgumentParser(description="Commander Companion – lokaler Turnier-Server")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--bind", default="0.0.0.0", help="Adresse zum Lauschen (Standard: alle)")
    parser.add_argument("--host", help="Adresse im QR-Code (Standard: automatisch erkannte LAN-IP)")
    args = parser.parse_args()

    url = f"http://{args.host or lan_ip()}:{args.port}/"
    Handler.store = Store(DATA_FILE)
    Handler.saves = Saves(SAVES_DIR)
    Handler.public_url = url
    if segno:
        qr = segno.make(url, error="m")
        buf = io.BytesIO()
        qr.save(buf, kind="svg", scale=8, border=2, dark="#111111", light="#ffffff", xmldecl=False)
        Handler.qr_svg = buf.getvalue()

    server = ThreadingHTTPServer((args.bind, args.port), Handler)
    server.daemon_threads = True
    print("\nCommander Companion läuft.")
    print(f"  Auf diesem Rechner:  http://localhost:{args.port}/")
    print(f"  Im WLAN (Handys):    {url}")
    if segno:
        segno.make(url, error="m").terminal(compact=True)
    else:
        print("  (Kein QR-Code: 'pip install -r server/requirements.txt' ausführen.)")
    print(f"  Turnier gespeichert in {DATA_FILE}")
    print(f"  Benannte Spielstände in {SAVES_DIR}")
    print("Beenden mit Strg+C.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer beendet.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
