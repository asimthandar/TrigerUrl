import importlib.util, os, tempfile, unittest

class FakeResp:
    def __init__(self, status, body=b""):
        self.status = status
        self._body = body
    def read(self, n=-1):
        if n is None or n < 0:
            return self._body
        chunk = self._body[:n]
        self._body = self._body[n:]
        return chunk
    def close(self):
        pass

class FakeConn:
    response = (200, b"{}")
    last_path = ""
    def __init__(self, host, port, timeout):
        pass
    def request(self, method, path, headers=None):
        FakeConn.last_path = path
    def getresponse(self):
        return FakeResp(*self.response)
    def close(self):
        pass

class BulkHealthTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        os.environ["DATA_DIR"] = cls.tmp.name
        os.environ["ADMIN_PASSWORD"] = "test"
        spec = importlib.util.spec_from_file_location("server_under_test", os.path.join(os.path.dirname(__file__), "..", "server.py"))
        cls.mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.mod)
        cls.original = cls.mod.http.client.HTTPSConnection
        cls.mod.http.client.HTTPSConnection = FakeConn

    @classmethod
    def tearDownClass(cls):
        cls.mod.http.client.HTTPSConnection = cls.original
        cls.tmp.cleanup()

    def check(self, status, body):
        FakeConn.response = (status, body)
        return self.mod.check_firebase_reachability("https://example-default-rtdb.firebaseio.com")

    def test_deactivated_status(self):
        for code in (401, 403, 404, 423, 500):
            with self.subTest(code=code):
                self.assertEqual(self.check(code, b'{"error":"x"}')[0], "inactive")

    def test_ghost_null_empty_or_invalid(self):
        for body in (b"null", b"", b"{}", b"[]", b"not-json"):
            with self.subTest(body=body):
                self.assertEqual(self.check(200, body)[0], "invalid_no_data")

    def test_active_requires_nonempty_json(self):
        result = self.check(200, b'{"id1":{"status":"online"}}')
        self.assertEqual(result[0], "active")
        self.assertEqual(result[1], 200)
        self.assertIn("limitToFirst=1", FakeConn.last_path)
        self.assertIn("orderBy=%22%24key%22", FakeConn.last_path)

    def test_large_root_is_bounded_by_probe(self):
        # A huge root should not be downloaded/parsed as the complete dataset.
        huge = b'{' + (b'"x":' + b'"1234567890",' * 8000) + b'"last":"v"}'
        result = self.check(200, huge)
        self.assertEqual(result[0], "response_too_large")
        self.assertEqual(result[1], 200)

if __name__ == "__main__":
    unittest.main()
