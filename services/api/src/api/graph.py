"""Graph dependency status probe.

Reports only coarse status values. Never returns hosts, ports, credentials,
dataset labels, or exception text.
"""

from typing import Literal

GraphStatus = Literal["available", "unavailable", "not_configured"]


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
    except Exception:
        return "unavailable"
    finally:
        if client is not None:
            try:
                client.close()
            except Exception:
                pass
