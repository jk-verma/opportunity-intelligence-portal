"""Validate official-source registry before scheduled discovery."""
import json
import unittest
from pathlib import Path
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parent
ALLOWED={"academic","government","international","research","consultancy","awards"}

class SourceRegistryTests(unittest.TestCase):
    def test_unique_https_sources(self):
        rows=json.loads((ROOT/"sources.json").read_text())
        self.assertGreaterEqual(len(rows),12)
        self.assertEqual(len({r["id"] for r in rows}),len(rows))
        self.assertEqual(len({r["url"] for r in rows}),len(rows))
        for row in rows:
            self.assertEqual(urlparse(row["url"]).scheme,"https")
            self.assertIn(row["category"],ALLOWED)
            self.assertTrue(row["include"])
    def test_coverage_registry_does_not_claim_automation(self):
        registry=json.loads((ROOT/"institution_registry.json").read_text())
        self.assertEqual(len(registry["institutions"]),21)
        self.assertTrue(all("adapter_status" in i for i in registry["institutions"]))

if __name__=="__main__":
    unittest.main()
