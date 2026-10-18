"""Sign-in and per-user investigation limits, against a real signing key.

The tests sign tokens with an Ed25519 key, the algorithm Better Auth uses, and
serve its public half the way the web app's JWKS endpoint would. Nothing is
mocked in the verification path: signature, issuer, audience and expiry are all
checked by the same code production runs.
"""

from __future__ import annotations

import asyncio
import base64
import json
import time
from collections.abc import Iterator
from pathlib import Path

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi.testclient import TestClient
from helpers import FakeGraphTools, FakeScoreRepository
from sqlalchemy import func, select

from api import auth
from api.app import create_app, get_graph_tools, get_score_repository
from api.database import CaseDatabase
from api.exceptions import RateLimitedError
from api.usage import DAY_SECONDS, HOUR_SECONDS, InvestigationUsage, UsageLimiter

ISSUER = "https://tripwire.example.com"
KID = "test-key-1"
SCORES = {"tx_1": (0.9, "2022-09-01 00:00"), "tx_2": (0.1, "2022-09-01 00:01")}


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


class Keys:
    """An Ed25519 key pair and the JWKS document that publishes its public half."""

    def __init__(self, kid: str = KID) -> None:
        self.kid = kid
        self.private = Ed25519PrivateKey.generate()
        public = self.private.public_key().public_bytes(
            serialization.Encoding.Raw, serialization.PublicFormat.Raw
        )
        self.jwks = {
            "keys": [
                {"kty": "OKP", "crv": "Ed25519", "x": b64url(public), "kid": kid, "alg": "EdDSA"}
            ]
        }

    def token(self, subject: str = "user-a", **overrides: object) -> str:
        now = int(time.time())
        claims: dict[str, object] = {
            "sub": subject,
            "email": f"{subject}@example.com",
            "name": subject.title(),
            "iss": ISSUER,
            "aud": ISSUER,
            "iat": now,
            "exp": now + 900,
        }
        claims.update(overrides)
        return jwt.encode(claims, self.private, algorithm="EdDSA", headers={"kid": self.kid})


@pytest.fixture
def keys(monkeypatch: pytest.MonkeyPatch) -> Keys:
    """Serve the test JWKS instead of fetching it over the network."""
    published = Keys()

    def fetch_data(_self: jwt.PyJWKClient) -> dict[str, object]:
        return published.jwks

    monkeypatch.setattr(jwt.PyJWKClient, "fetch_data", fetch_data)
    return published


@pytest.fixture
def signed_in(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, keys: Keys) -> Iterator[TestClient]:
    config = tmp_path / "baseline_config.json"
    config.write_text(json.dumps({"thresholds": {"lgbm": 0.5}}), encoding="utf-8")
    monkeypatch.setenv("TRACEAML_BASELINE_CONFIG_PATH", str(config))
    monkeypatch.setenv("TRACEAML_CASE_DB_PATH", str(tmp_path / "cases.db"))
    monkeypatch.setenv("TRACEAML_AUTH_MODE", "jwt")
    monkeypatch.setenv("TRACEAML_AUTH_JWKS_URL", f"{ISSUER}/api/auth/jwks")
    monkeypatch.setenv("TRACEAML_AUTH_ISSUER", ISSUER)
    monkeypatch.setenv("TRACEAML_AUTH_AUDIENCE", ISSUER)
    app = create_app()
    app.dependency_overrides[get_score_repository] = lambda: FakeScoreRepository(SCORES)
    app.dependency_overrides[get_graph_tools] = lambda: FakeGraphTools()
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


BODY = {"transaction_id": "tx_1", "max_hops": 2, "time_window_seconds": 3600, "result_limit": 10}


# ---- Sign-in ---------------------------------------------------------------


def test_public_routes_need_no_token(signed_in: TestClient) -> None:
    assert signed_in.get("/api/health").status_code == 200
    assert signed_in.get("/api/benchmarks").status_code in (200, 503)


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/alerts"),
        ("get", "/api/me"),
        ("get", "/api/cases"),
        ("post", "/api/investigations"),
        ("post", "/api/investigations/stream"),
    ],
)
def test_protected_routes_refuse_a_missing_token(
    signed_in: TestClient, method: str, path: str
) -> None:
    response = getattr(signed_in, method)(path, **({"json": BODY} if method == "post" else {}))
    assert response.status_code == 401
    assert response.json() == {"detail": "authentication required"}
    assert response.headers["www-authenticate"] == "Bearer"


def test_a_valid_token_is_accepted(signed_in: TestClient, keys: Keys) -> None:
    response = signed_in.get("/api/alerts", headers=bearer(keys.token()))
    assert response.status_code == 200


@pytest.mark.parametrize(
    "tamper",
    [
        {"exp": int(time.time()) - 3600, "iat": int(time.time()) - 7200},
        {"iss": "https://evil.example.com"},
        {"aud": "https://evil.example.com"},
    ],
    ids=["expired", "wrong-issuer", "wrong-audience"],
)
def test_a_token_with_bad_claims_is_refused(
    signed_in: TestClient, keys: Keys, tamper: dict[str, object]
) -> None:
    response = signed_in.get("/api/alerts", headers=bearer(keys.token(**tamper)))
    assert response.status_code == 401


def test_a_token_signed_by_another_key_is_refused(signed_in: TestClient) -> None:
    stranger = Keys()
    assert signed_in.get("/api/alerts", headers=bearer(stranger.token())).status_code == 401


def test_a_token_without_a_subject_is_refused(signed_in: TestClient, keys: Keys) -> None:
    token = keys.token(sub="")
    assert signed_in.get("/api/alerts", headers=bearer(token)).status_code == 401


def test_the_unsigned_none_algorithm_is_refused(signed_in: TestClient) -> None:
    now = int(time.time())
    forged = jwt.encode(
        {"sub": "attacker", "iss": ISSUER, "aud": ISSUER, "iat": now, "exp": now + 900},
        key=None,
        algorithm="none",
        headers={"kid": KID},
    )
    assert signed_in.get("/api/alerts", headers=bearer(forged)).status_code == 401


def test_a_non_bearer_header_is_refused(signed_in: TestClient, keys: Keys) -> None:
    response = signed_in.get("/api/alerts", headers={"Authorization": f"Basic {keys.token()}"})
    assert response.status_code == 401


def test_an_unreachable_key_server_is_a_503_not_a_pass(
    signed_in: TestClient, keys: Keys, monkeypatch: pytest.MonkeyPatch
) -> None:
    def down(_self: jwt.PyJWKClient) -> dict[str, object]:
        raise jwt.PyJWKClientConnectionError("down")

    monkeypatch.setattr(jwt.PyJWKClient, "fetch_data", down)
    # A fresh client has no cached keys.
    token = keys.token()
    response = signed_in.get("/api/alerts", headers=bearer(token))
    assert response.status_code == 503
    assert response.json() == {"detail": "authentication service unavailable"}


def test_the_service_refuses_to_start_without_keys_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TRACEAML_AUTH_MODE", "jwt")
    monkeypatch.delenv("TRACEAML_AUTH_JWKS_URL", raising=False)
    monkeypatch.delenv("TRACEAML_AUTH_ISSUER", raising=False)
    monkeypatch.delenv("TRACEAML_AUTH_AUDIENCE", raising=False)
    with pytest.raises(RuntimeError, match="TRACEAML_AUTH_JWKS_URL"):
        auth.TokenVerifier(create_app_settings())


def create_app_settings():
    from api.settings import Settings

    return Settings(_env_file=None)


def test_me_reports_the_user_and_their_allowance(signed_in: TestClient, keys: Keys) -> None:
    body = signed_in.get("/api/me", headers=bearer(keys.token("user-a"))).json()
    assert body["auth"] == "jwt"
    assert body["user"] == {"id": "user-a", "email": "user-a@example.com", "name": "User-A"}
    assert body["usage"]["hour"] == {
        "limit": 10,
        "used": 0,
        "remaining": 10,
        "resets_in_seconds": None,
    }
    assert body["usage"]["day"]["limit"] == 20


def test_sign_in_off_reports_no_user_and_does_not_limit(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    config = tmp_path / "baseline_config.json"
    config.write_text(json.dumps({"thresholds": {"lgbm": 0.5}}), encoding="utf-8")
    monkeypatch.setenv("TRACEAML_BASELINE_CONFIG_PATH", str(config))
    monkeypatch.setenv("TRACEAML_CASE_DB_PATH", str(tmp_path / "cases.db"))
    app = create_app()
    app.dependency_overrides[get_score_repository] = lambda: FakeScoreRepository(SCORES)
    app.dependency_overrides[get_graph_tools] = lambda: FakeGraphTools()
    with TestClient(app, raise_server_exceptions=False) as client:
        assert client.get("/api/me").json() == {"auth": "off", "user": None, "usage": None}
        for _ in range(25):
            assert client.post("/api/investigations", json=BODY).status_code == 200


# ---- Limits through the API ------------------------------------------------


def test_the_eleventh_investigation_in_an_hour_is_refused(
    signed_in: TestClient, keys: Keys
) -> None:
    headers = bearer(keys.token("user-a"))
    for _ in range(10):
        assert signed_in.post("/api/investigations", json=BODY, headers=headers).status_code == 200
    refused = signed_in.post("/api/investigations", json=BODY, headers=headers)
    assert refused.status_code == 429
    body = refused.json()
    assert body["window"] == "hour"
    assert body["limit"] == 10
    assert 1 <= body["retry_after_seconds"] <= HOUR_SECONDS
    assert refused.headers["retry-after"] == str(body["retry_after_seconds"])
    assert body["detail"] == "investigation limit reached: 10 per hour"

    me = signed_in.get("/api/me", headers=headers).json()["usage"]
    assert me["hour"]["used"] == 10
    assert me["hour"]["remaining"] == 0
    assert me["day"]["used"] == 10


def test_the_stream_endpoint_shares_the_same_allowance(signed_in: TestClient, keys: Keys) -> None:
    headers = bearer(keys.token("user-a"))
    for _ in range(5):
        assert signed_in.post("/api/investigations", json=BODY, headers=headers).status_code == 200
    for _ in range(5):
        with signed_in.stream(
            "POST", "/api/investigations/stream", json=BODY, headers=headers
        ) as response:
            assert response.status_code == 200
            response.read()
    refused = signed_in.post("/api/investigations/stream", json=BODY, headers=headers)
    assert refused.status_code == 429
    assert refused.headers["content-type"].startswith("application/json")


def test_each_user_has_their_own_allowance(signed_in: TestClient, keys: Keys) -> None:
    a = bearer(keys.token("user-a"))
    b = bearer(keys.token("user-b"))
    for _ in range(10):
        signed_in.post("/api/investigations", json=BODY, headers=a)
    assert signed_in.post("/api/investigations", json=BODY, headers=a).status_code == 429
    assert signed_in.post("/api/investigations", json=BODY, headers=b).status_code == 200


def test_requests_that_do_no_work_are_not_counted(signed_in: TestClient, keys: Keys) -> None:
    headers = bearer(keys.token("user-a"))
    unknown = {**BODY, "transaction_id": "not_scored"}
    for _ in range(15):
        assert (
            signed_in.post("/api/investigations", json=unknown, headers=headers).status_code == 404
        )
    bad_body = {**BODY, "max_hops": 99}
    for _ in range(15):
        assert (
            signed_in.post("/api/investigations", json=bad_body, headers=headers).status_code == 422
        )
    assert signed_in.get("/api/me", headers=headers).json()["usage"]["hour"]["used"] == 0


def test_an_investigation_that_fails_still_counts(signed_in: TestClient, keys: Keys) -> None:
    class Broken(FakeGraphTools):
        def trace_funds(self, *args: object, **kwargs: object) -> object:
            raise RuntimeError("graph exploded")

    signed_in.app.dependency_overrides[get_graph_tools] = lambda: Broken()  # type: ignore[attr-defined]
    headers = bearer(keys.token("user-a"))
    assert signed_in.post("/api/investigations", json=BODY, headers=headers).status_code >= 500
    assert signed_in.get("/api/me", headers=headers).json()["usage"]["hour"]["used"] == 1


# ---- The limiter on its own ------------------------------------------------


class Clock:
    def __init__(self, now: float = 1_000_000.0) -> None:
        self.now = now

    def __call__(self) -> float:
        return self.now


@pytest.fixture
def limiter(tmp_path: Path) -> tuple[UsageLimiter, Clock]:
    clock = Clock()
    database = CaseDatabase(tmp_path / "usage.db")
    return UsageLimiter(database, hour_limit=10, day_limit=20, clock=clock), clock


def test_a_slot_returns_exactly_when_the_oldest_leaves_the_hour(
    limiter: tuple[UsageLimiter, Clock],
) -> None:
    usage, clock = limiter

    async def scenario() -> None:
        for minute in range(10):
            clock.now = 1_000_000.0 + minute * 60
            await usage.claim("u")
        clock.now = 1_000_000.0 + 600
        with pytest.raises(RateLimitedError) as refused:
            await usage.claim("u")
        # The oldest was at t0; it leaves the hour at t0 + 3600.
        assert refused.value.extra["retry_after_seconds"] == HOUR_SECONDS - 600
        assert refused.value.extra["window"] == "hour"

        clock.now = 1_000_000.0 + HOUR_SECONDS + 1
        after = await usage.claim("u")
        assert after.hour.used == 10  # nine earlier ones plus this one

    asyncio.run(scenario())


def test_the_daily_limit_applies_after_the_hourly_one_clears(
    limiter: tuple[UsageLimiter, Clock],
) -> None:
    usage, clock = limiter

    async def scenario() -> None:
        # Two bursts of ten, two hours apart: the day now holds 20.
        for burst_start in (0, 2 * HOUR_SECONDS):
            for index in range(10):
                clock.now = 1_000_000.0 + burst_start + index
                await usage.claim("u")
        clock.now = 1_000_000.0 + 4 * HOUR_SECONDS
        with pytest.raises(RateLimitedError) as refused:
            await usage.claim("u")
        assert refused.value.extra["window"] == "day"
        assert refused.value.extra["limit"] == 20
        assert refused.value.extra["retry_after_seconds"] == DAY_SECONDS - 4 * HOUR_SECONDS

        # The first burst has left the day; the second is still inside.
        clock.now = 1_000_000.0 + DAY_SECONDS + 20
        assert (await usage.claim("u")).day.used == 11

    asyncio.run(scenario())


def test_the_longer_window_decides_the_wait_when_both_are_full(
    limiter: tuple[UsageLimiter, Clock],
) -> None:
    usage, clock = limiter

    async def scenario() -> None:
        for burst_start in (0, 2 * HOUR_SECONDS):
            for index in range(10):
                clock.now = 1_000_000.0 + burst_start + index
                await usage.claim("u")
        # The second burst fills the hour; the day is full as well.
        clock.now = 1_000_000.0 + 2 * HOUR_SECONDS + 30
        with pytest.raises(RateLimitedError) as refused:
            await usage.claim("u")
        assert refused.value.extra["window"] == "day"

    asyncio.run(scenario())


def test_simultaneous_requests_cannot_exceed_the_limit(
    limiter: tuple[UsageLimiter, Clock],
) -> None:
    usage, _ = limiter

    async def scenario() -> None:
        results = await asyncio.gather(
            *(usage.claim("u") for _ in range(40)), return_exceptions=True
        )
        allowed = [r for r in results if not isinstance(r, Exception)]
        refused = [r for r in results if isinstance(r, RateLimitedError)]
        assert len(allowed) == 10
        assert len(refused) == 30
        assert (await usage.usage("u")).hour.used == 10

    asyncio.run(scenario())


def test_old_rows_are_pruned(limiter: tuple[UsageLimiter, Clock]) -> None:
    usage, clock = limiter

    async def scenario() -> None:
        await usage.claim("u")
        clock.now += 3 * DAY_SECONDS
        await usage.claim("u")
        async with usage._database.sessions() as session:
            count = await session.scalar(select(func.count()).select_from(InvestigationUsage))
        assert count == 1

    asyncio.run(scenario())
