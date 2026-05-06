#!/usr/bin/env python3
"""
Development server for NASA Earth Gallery.
Serves static files and proxies /proxy/ -> https://epic.gsfc.nasa.gov/
to bypass CORS restrictions when loading EPIC images in the 3D viewer.

Usage:
    python dev-server.py [PORT]

Then open http://localhost:8080/earth3d.html
"""

import http.server
import socketserver
import urllib.request
import sys
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
REPO_ROOT = Path(__file__).parent.resolve()

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(REPO_ROOT), **kwargs)

    def end_headers(self):
        # Enable CORS for local dev
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def log_message(self, format, *args):
        # Custom logging to show proxy requests clearly
        msg = format % args
        if self.path.startswith('/proxy/'):
            print(f'[PROXY] {msg}')
        else:
            print(f'[STATIC] {msg}')

    def do_GET(self):
        if self.path.startswith('/proxy/'):
            target = 'https://epic.gsfc.nasa.gov/' + self.path[7:]
            try:
                req = urllib.request.Request(
                    target,
                    headers={
                        'User-Agent': (
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                            'AppleWebKit/537.36 (KHTML, like Gecko) '
                            'Chrome/120.0.0.0 Safari/537.36'
                        )
                    }
                )
                with urllib.request.urlopen(req, timeout=25) as response:
                    self.send_response(response.status)
                    for header, value in response.headers.items():
                        h = header.lower()
                        if h not in ('transfer-encoding', 'content-encoding', 'connection'):
                            self.send_header(header, value)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(response.read())
            except urllib.error.HTTPError as e:
                self.send_error(e.code, e.reason)
            except Exception as e:
                self.send_error(502, str(e))
        else:
            super().do_GET()

if __name__ == '__main__':
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"NASA Earth Gallery dev server running at http://localhost:{PORT}")
        print(f"Open http://localhost:{PORT}/earth3d.html for the 3D viewer")
        print("Press Ctrl+C to stop")
        httpd.serve_forever()
