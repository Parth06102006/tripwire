"""Graph dependency status probe re-export for backwards compatibility."""

from api.health.schemas import GraphStatus
from api.health.service import probe_falkordb as probe_graph

from typing import Any, Literal

GraphStatus = Literal["available", "unavailable", "not_configured"]


class GraphUnavailable(Exception):
    """Raised when no usable FalkorDB graph handle can be produced."""


def probe_graph(host: str | None, port: int) -> GraphStatus:
    """Probe FalkorDB with a short timeout and map the result to a status."""
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
    except Exception:  # noqa: BLE001 -- any probe failure maps to a coarse status
        return "unavailable"
    finally:
        if client is not None:
            try:
                client.close()
            except Exception:  # noqa: BLE001, S110 -- close failures never escape probes
                pass


def open_graph(host: str | None, port: int, name: str) -> Any:
    """Return the named FalkorDB graph handle or raise GraphUnavailable."""
    if host is None or host.strip() == "":
        raise GraphUnavailable("graph is not configured")
    client = None
    try:
        from falkordb import FalkorDB

        client = FalkorDB(
            host=host,
            port=port,
            socket_connect_timeout=1.0,
            socket_timeout=1.0,
        )
        return client.select_graph(name)
    except GraphUnavailable:
        raise
    except Exception as exc:
        raise GraphUnavailable("graph is unavailable") from exc
