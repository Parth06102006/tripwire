"""FalkorDB configuration helper."""

from api.config import get_settings


class GraphConfig:
    """FalkorDB connection and query timeout configuration."""

    @property
    def host(self) -> str | None:
        return get_settings().falkordb_host

    @property
    def port(self) -> int:
        return get_settings().falkordb_port

    @property
    def is_configured(self) -> bool:
        return self.host is not None and self.host.strip() != ""
