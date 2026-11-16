"""Regression tests for conservative advertisement-link filtering."""
import unittest
from collect import candidate_link

SOURCE = {
    "id": "worldbank-jobs",
    "url": "https://www.worldbank.org/en/about/careers",
    "category": "international",
    "include": ["jobs", "vacancies", "career", "consultant", "recruitment"],
}
ACADEMIC = {
    "id": "iima-faculty",
    "url": "https://www.iima.ac.in/faculty-research/faculty-recruitment",
    "category": "academic",
    "include": ["faculty", "professor", "recruitment", "application"],
}

class CandidateLinkTests(unittest.TestCase):
    def test_reject_generic_careers(self):
        self.assertIsNone(candidate_link("/ext/en/careers", "World Bank Careers and Jobs", SOURCE))
        self.assertIsNone(candidate_link("/ext/en/careers/world-bank-group-values", "World Bank Careers and Values", SOURCE))
        self.assertIsNone(candidate_link("/content/dam/chatbot", "Recruitment chatbot assistant", SOURCE))
    def test_reject_external_site(self):
        self.assertIsNone(candidate_link("https://example.com/advt123.pdf", "Faculty recruitment notification 123", ACADEMIC))
    def test_specific_academic_advertisement(self):
        item = candidate_link("/files/faculty-advertisement-12.pdf", "Faculty Recruitment Advertisement No. 12/2026", ACADEMIC)
        self.assertIsNotNone(item)
        self.assertEqual(item["status"], "pending")
        self.assertEqual(item["category"], "academic")
    def test_no_invented_dates(self):
        item = candidate_link("/files/faculty-notice.pdf", "Faculty recruitment notification 2026", ACADEMIC)
        self.assertNotIn("deadline_at", item)
        self.assertNotIn("published_at", item)

if __name__ == "__main__":
    unittest.main()
