"""Minimal static server for RAY Knowledge clone (threaded, robust)."""

import http.server
import socketserver
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")


class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 32


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # Disable ALL caching
        self.send_header(
            "Cache-Control", "no-cache, no-store, must-revalidate, max-age=0"
        )
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Vary", "*")
        try:
            super().end_headers()
        except (BrokenPipeError, ConnectionAbortedError):
            pass

    def log_message(self, fmt, *args):
        pass


with ThreadedHTTPServer(("0.0.0.0", PORT), Handler) as httpd:
    print(f"RAY Knowledge serving {ROOT} on http://localhost:{PORT}", flush=True)
    httpd.serve_forever()
