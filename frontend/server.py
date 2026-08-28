from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


class FrontendHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        route = urlsplit(path).path.rstrip("/")
        if route.startswith("/role/") and route.count("/") == 2:
            return str(Path.cwd() / "index.html")
        return super().translate_path(path)


ThreadingHTTPServer(("0.0.0.0", 15000), FrontendHandler).serve_forever()