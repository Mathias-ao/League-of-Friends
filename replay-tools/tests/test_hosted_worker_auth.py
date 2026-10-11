"""Cloud Run HTTP POST fails closed when no worker bearer token is injected."""
from __future__ import annotations
from http.server import ThreadingHTTPServer
from http.client import HTTPConnection
from pathlib import Path
from threading import Thread
from unittest import TestCase, main
from unittest.mock import patch
import json
import os
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from upload_worker import Handler


class HostedWorkerAuthTests(TestCase):
    def call(self, route, token=None):
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            connection = HTTPConnection("127.0.0.1", server.server_port, timeout=3)
            headers = {"content-type": "application/json"}
            if token is not None:
                headers["authorization"] = "Bearer " + token
            connection.request("POST", route, json.dumps({}), headers)
            response = connection.getresponse()
            payload = json.loads(response.read())
            connection.close()
            return response.status, payload
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=3)

    def test_hosted_routes_require_a_present_secret(self):
        with patch.dict(os.environ, {"K_SERVICE": "aof-staging-worker",
                                    "AOF_REPLAY_WORKER_AUTH_TOKEN": "",
                                    "AOF_EXPERIMENTAL_NATIVE_REPLAY_ENDPOINT": "1"}):
            for path in ("/process", "/process-native-v1", "/unknown"):
                status, data = self.call(path)
                self.assertEqual(status, 503)
                self.assertEqual(data["error"], "worker_auth_not_configured")

    def test_hosted_secret_denies_anonymous_requests(self):
        with patch.dict(os.environ, {"K_SERVICE": "aof-staging-worker",
                                    "AOF_REPLAY_WORKER_AUTH_TOKEN": "strict-test-token",
                                    "AOF_EXPERIMENTAL_NATIVE_REPLAY_ENDPOINT": "1"}):
            for path in ("/process", "/process-native-v1"):
                self.assertEqual(self.call(path)[0], 401)
                self.assertEqual(self.call(path, "incorrect")[0], 401)
                self.assertEqual(self.call(path, "strict-test-token")[0], 400)  # accepted auth, invalid file

    def test_local_legacy_behavior_unchanged(self):
        with patch.dict(os.environ, {"AOF_REPLAY_WORKER_AUTH_TOKEN": "",
                                    "AOF_EXPERIMENTAL_NATIVE_REPLAY_ENDPOINT": ""},
                        clear=True):
            self.assertEqual(self.call("/process")[0], 400)  # local anonymous legacy path remains
            self.assertEqual(self.call("/process-native-v1")[0], 404)


if __name__ == "__main__":
    main()
