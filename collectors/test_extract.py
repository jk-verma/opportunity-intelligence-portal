"""Tests for conservative structured extraction."""
import unittest
from extract import extract,parse_date

class ExtractionTests(unittest.TestCase):
    def test_labeled_fields(self):
        html="<html><body><h1>Faculty recruitment notice</h1><p>Eligibility: PhD in a relevant discipline</p><p>Pay level: Level 12</p><p>Publication date: 15 November 2026</p></body></html>"
        result=extract(html)
        self.assertEqual(result["eligibility"],"PhD in a relevant discipline")
        self.assertEqual(result["pay_details"],"Level 12")
        self.assertEqual(result["published_at"],"2026-11-15")
    def test_deadline_not_invented(self):
        result=extract("<p>Last date to apply: 30 November 2026</p>")
        self.assertNotIn("deadline_at",result)
    def test_ambiguous_date(self):
        self.assertIsNone(parse_date("11/12/2026"))
    def test_ignore_navigation(self):
        self.assertNotIn("eligibility",extract("<nav><p>Eligibility: menu item</p></nav>"))

if __name__=="__main__":
    unittest.main()
