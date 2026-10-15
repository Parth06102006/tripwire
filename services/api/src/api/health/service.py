"""Health probing service."""

from contextlib import suppress

from api.config import get_settings
from api.health.schemas import GraphStatus


def probe_falkordb(host: str | None, port: int) -> GraphStatus:
    """Probe FalkorDB with a short timeout and map the result to a status.

    Reports only coarse status values. Never leaks credentials, hosts, ports,
    dataset labels, or exception text.
    """
    if host is None or host.strip() == "":
        return "not_configured"

    client = None
    try:
        from falkordb import FalkorDB

        client = FalkorDB(
            host=host,
            port=port,
            socket_connect_timeout=1.0,
            socket_timeout=1.0,
        )
        client.execute_command("PING")
        return "available"
    except Exception:  # noqa: BLE001
        return "unavailable"
    finally:
        if client is not None:
            with suppress(Exception):
                client.close()


def get_health_status() -> tuple[GraphStatus, str]:
    """Retrieve current health status and version."""
    settings = get_settings()
    status = probe_falkordb(settings.falkordb_host, settings.falkordb_port)
    return status, settings.app_version
