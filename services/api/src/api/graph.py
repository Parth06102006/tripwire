"""Graph dependency status probe re-export for backwards compatibility."""

from api.health.schemas import GraphStatus
from api.health.service import probe_falkordb as probe_graph

__all__ = ["GraphStatus", "probe_graph"]
