from io import StringIO

from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings

from common.testing import client_for


class HealthTests(TestCase):
    def test_health_is_public_and_checks_the_database(self):
        r = client_for().get("/api/health/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data, {"status": "ok", "database": True})


@override_settings(DEBUG=False)
class SeedGuardTests(TestCase):
    def test_seed_refuses_without_debug_unless_forced(self):
        with self.assertRaises(CommandError):
            call_command("seed_data", "--password", "Seedpass!2026", stdout=StringIO())
        call_command("seed_data", "--password", "Seedpass!2026", "--force", stdout=StringIO())
