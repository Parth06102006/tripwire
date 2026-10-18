"""Sign-in for the API: verify the JWT the web app's Better Auth issues.

The web app owns accounts, OAuth and sessions. After sign-in the browser asks
it for a short-lived JWT and sends that as ``Authorization: Bearer``. The API
trusts nothing but a valid signature from the web app's published keys, plus
the expected issuer, audience and expiry. It keeps no password, no session and
no secret: verifying needs only public keys.

Failure modes are explicit. A missing, malformed, expired or wrongly signed
token is a 401. A key server that cannot be reached is a 503, never a pass.
``TRACEAML_AUTH_MODE=off`` (local development only) skips all of this.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Annotated

import jwt
from fastapi import Depends, Request
from jwt import PyJWKClient
from jwt.exceptions import (
    InvalidTokenError,
    PyJWKClientConnectionError,
    PyJWKClientError,
)

from api.dependencies import SettingsDep
from api.exceptions import ServiceUnavailableError, UnauthorizedError
from api.settings import Settings

logger = logging.getLogger("api")

# Better Auth signs with EdDSA by default; ES256 and RS256 cover a changed key
# type. Never include ``none`` or any HMAC algorithm: the keys are public.
ALLOWED_ALGORITHMS = ("EdDSA", "ES256", "RS256")
# Clock drift tolerated between the web host and this one.
LEEWAY_SECONDS = 10
JWKS_CACHE_SECONDS = 300
JWKS_TIMEOUT_SECONDS = 5
CHALLENGE = {"WWW-Authenticate": "Bearer"}


@dataclass(frozen=True)
class AuthenticatedUser:
    """The signed-in person a request acts for."""

    subject: str
    email: str | None = None
    name: str | None = None


class TokenVerifier:
    """Verifies bearer tokens against the web app's published keys."""

    def __init__(self, settings: Settings) -> None:
        if not settings.auth_configured:
            raise RuntimeError(
                "TRACEAML_AUTH_JWKS_URL, TRACEAML_AUTH_ISSUER and TRACEAML_AUTH_AUDIENCE "
                "must all be set when TRACEAML_AUTH_MODE is jwt"
            )
        assert settings.auth_jwks_url and settings.auth_issuer and settings.auth_audience
        self._issuer = settings.auth_issuer
        self._audience = settings.auth_audience
        # Keys are cached; an unknown key id triggers one refresh, which is how
        # a key rotation on the web app reaches the API.
        self._keys = PyJWKClient(
            settings.auth_jwks_url,
            cache_keys=True,
            lifespan=JWKS_CACHE_SECONDS,
            timeout=JWKS_TIMEOUT_SECONDS,
        )

    def verify(self, token: str) -> AuthenticatedUser:
        try:
            signing_key = self._keys.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=list(ALLOWED_ALGORITHMS),
                issuer=self._issuer,
                audience=self._audience,
                leeway=LEEWAY_SECONDS,
                options={"require": ["exp", "iat", "sub"]},
            )
        except PyJWKClientConnectionError as exc:
            logger.warning("key server unreachable: %s", type(exc).__name__)
            raise ServiceUnavailableError("authentication service unavailable") from exc
        except (InvalidTokenError, PyJWKClientError) as exc:
            # Includes expired, wrong issuer or audience, bad signature, and an
            # unknown key id. The reason is logged, never returned.
            logger.info("token rejected: %s", type(exc).__name__)
            raise UnauthorizedError(headers=CHALLENGE) from exc

        subject = claims.get("sub")
        if not isinstance(subject, str) or not subject.strip():
            raise UnauthorizedError(headers=CHALLENGE)
        email = claims.get("email")
        name = claims.get("name")
        return AuthenticatedUser(
            subject=subject,
            email=email if isinstance(email, str) else None,
            name=name if isinstance(name, str) else None,
        )


def get_token_verifier(request: Request) -> TokenVerifier | None:
    """The verifier built at startup, or None when sign-in is off."""
    verifier: TokenVerifier | None = request.app.state.token_verifier
    return verifier


def bearer_token(request: Request) -> str | None:
    header = request.headers.get("authorization", "")
    scheme, _, value = header.partition(" ")
    token = value.strip()
    return token if scheme.lower() == "bearer" and token else None


def get_current_user(
    request: Request,
    settings: SettingsDep,
    verifier: Annotated[TokenVerifier | None, Depends(get_token_verifier)],
) -> AuthenticatedUser | None:
    """The signed-in user, or None only when sign-in is switched off.

    A plain function: key fetching is blocking IO, which FastAPI runs in its
    worker thread pool.
    """
    if settings.auth_mode == "off":
        return None
    if verifier is None:
        raise ServiceUnavailableError("authentication not configured")
    token = bearer_token(request)
    if token is None:
        raise UnauthorizedError(headers=CHALLENGE)
    return verifier.verify(token)


CurrentUser = Annotated[AuthenticatedUser | None, Depends(get_current_user)]
