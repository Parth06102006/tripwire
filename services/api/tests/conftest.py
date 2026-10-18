"""Test defaults: sign-in is off unless a test turns it on.

``api.app`` builds its application at import, so the default has to be in the
environment before any test module is collected, not only inside a fixture.
"""

from __future__ import annotations

import os

import pytest

os.environ.setdefault("TRACEAML_AUTH_MODE", "off")


@pytest.fixture(autouse=True)
def _auth_off_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TRACEAML_AUTH_MODE", "off")
