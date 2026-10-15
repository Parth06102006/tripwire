"""Asynchronous FalkorDB client executing bounded Cypher queries in worker threads."""

import asyncio
import time
from typing import Any

from api.config import get_settings
from api.exceptions import GraphQueryError, GraphUnavailableError
from api.graph.constants import (
    DEFAULT_HOPS,
    DEFAULT_LIMIT,
    GRAPH_NAME,
    MAX_HOPS,
    MAX_LIMIT,
)
from api.graph.queries import (
    QUERY_DETECT_FLOW_PATTERNS,
    QUERY_INSPECT_COUNTERPARTIES,
    QUERY_TRACE_FUNDS,
)
from api.graph.schemas import GraphPath, GraphQueryResult, TransactionEvidence


class FalkorDBClient:
    """Threadpool-backed FalkorDB client enforcing query boundaries."""

    def __init__(self, host: str | None = None, port: int | None = None) -> None:
        settings = get_settings()
        self.host = host or settings.falkordb_host
        self.port = port or settings.falkordb_port

    def _get_raw_client(self) -> Any:
        if not self.host:
            raise GraphUnavailableError("FalkorDB is not configured.")
        try:
            from falkordb import FalkorDB

            return FalkorDB(
                host=self.host,
                port=self.port,
                socket_connect_timeout=2.0,
                socket_timeout=3.0,
            )
        except Exception as exc:
            raise GraphUnavailableError(f"Cannot connect to FalkorDB: {exc}") from exc

    def _sync_query(
        self, query: str, params: dict[str, Any] | None = None
    ) -> tuple[list[list[Any]], float]:
        start = time.perf_counter()
        client = self._get_raw_client()
        try:
            graph = client.select_graph(GRAPH_NAME)
            result = graph.query(query, params or {})
            duration_ms = (time.perf_counter() - start) * 1000.0
            return result.result_set, duration_ms
        except GraphUnavailableError:
            raise
        except Exception as exc:
            # Check for connection errors vs query errors
            err_msg = str(exc).lower()
            if "connection" in err_msg or "timeout" in err_msg or "refused" in err_msg:
                raise GraphUnavailableError(f"FalkorDB unavailable: {exc}") from exc
            raise GraphQueryError(f"Graph query failed: {exc}") from exc
        finally:
            from contextlib import suppress

            with suppress(Exception):
                client.close()

    async def execute_query(
        self, query: str, params: dict[str, Any] | None = None
    ) -> tuple[list[list[Any]], float]:
        """Run Cypher query in a separate thread to prevent blocking event loop."""
        return await asyncio.to_thread(self._sync_query, query, params)

    async def trace_funds(
        self,
        transaction_id: str,
        max_hops: int = DEFAULT_HOPS,
        time_window_seconds: int | None = None,
        limit: int = DEFAULT_LIMIT,
    ) -> GraphQueryResult:
        """Execute bounded trace_funds Cypher query."""
        bounded_limit = min(max(1, limit), MAX_LIMIT)
        bounded_hops = min(max(1, max_hops), MAX_HOPS)

        params = {
            "transaction_id": transaction_id,
            "max_hops": bounded_hops,
            "time_window_seconds": time_window_seconds,
            "limit": bounded_limit,
        }

        rows, duration_ms = await self.execute_query(QUERY_TRACE_FUNDS, params)

        transactions: dict[str, TransactionEvidence] = {}
        accounts: set[str] = set()
        paths: list[GraphPath] = []

        for row in rows:
            if not row or row[0] is None:
                continue
            tx_id = str(row[0])
            tx_ts = row[1]
            src_key = str(row[2])
            dst_key = str(row[3])
            amount = float(row[4]) if row[4] is not None else None
            currency = str(row[5]) if row[5] is not None else None
            ptype = str(row[6]) if row[6] is not None else None

            accounts.add(src_key)
            accounts.add(dst_key)

            if tx_id not in transactions:
                transactions[tx_id] = TransactionEvidence(
                    transaction_id=tx_id,
                    timestamp=tx_ts,
                    source_account_key=src_key,
                    destination_account_key=dst_key,
                    amount=amount,
                    currency=currency,
                    payment_type=ptype,
                )

            current_nodes = [src_key, tx_id, dst_key]
            current_rels = ["SENT", "RECEIVED"]

            # Next hop if present
            next_tx_id = str(row[7]) if len(row) > 7 and row[7] is not None else None
            if next_tx_id:
                next_ts = row[8]
                next_dst = str(row[9])
                next_amount = float(row[10]) if row[10] is not None else None
                next_curr = str(row[11]) if row[11] is not None else None
                next_ptype = str(row[12]) if row[12] is not None else None

                accounts.add(next_dst)
                if next_tx_id not in transactions:
                    transactions[next_tx_id] = TransactionEvidence(
                        transaction_id=next_tx_id,
                        timestamp=next_ts,
                        source_account_key=dst_key,
                        destination_account_key=next_dst,
                        amount=next_amount,
                        currency=next_curr,
                        payment_type=next_ptype,
                    )
                current_nodes.extend([next_tx_id, next_dst])
                current_rels.extend(["SENT", "RECEIVED"])

            paths.append(GraphPath(nodes=current_nodes, relationships=current_rels))

        return GraphQueryResult(
            transactions=list(transactions.values()),
            accounts=sorted(accounts),
            paths=paths,
            query_duration_ms=round(duration_ms, 2),
        )

    async def inspect_counterparties(
        self,
        entity_id: str,
        limit: int = DEFAULT_LIMIT,
    ) -> GraphQueryResult:
        """Inspect immediate and 2-step counterparties."""
        bounded_limit = min(max(1, limit), MAX_LIMIT)
        params = {"entity_id": entity_id, "limit": bounded_limit}
        rows, duration_ms = await self.execute_query(QUERY_INSPECT_COUNTERPARTIES, params)

        transactions: dict[str, TransactionEvidence] = {}
        accounts: set[str] = set()

        for row in rows:
            if not row or row[0] is None:
                continue
            tx_id = str(row[0])
            tx_ts = row[1]
            src_key = str(row[2])
            dst_key = str(row[3])
            amount = float(row[4]) if row[4] is not None else None
            currency = str(row[5]) if row[5] is not None else None
            ptype = str(row[6]) if row[6] is not None else None

            accounts.add(src_key)
            accounts.add(dst_key)
            transactions[tx_id] = TransactionEvidence(
                transaction_id=tx_id,
                timestamp=tx_ts,
                source_account_key=src_key,
                destination_account_key=dst_key,
                amount=amount,
                currency=currency,
                payment_type=ptype,
            )

        return GraphQueryResult(
            transactions=list(transactions.values()),
            accounts=sorted(accounts),
            paths=[],
            query_duration_ms=round(duration_ms, 2),
        )

    async def detect_flow_patterns(
        self,
        entity_id: str,
        time_window_seconds: int | None = None,
        limit: int = DEFAULT_LIMIT,
    ) -> GraphQueryResult:
        """Detect flow patterns like multi-hop rapid pass-through."""
        bounded_limit = min(max(1, limit), MAX_LIMIT)
        params = {
            "entity_id": entity_id,
            "time_window_seconds": time_window_seconds,
            "limit": bounded_limit,
        }
        rows, duration_ms = await self.execute_query(QUERY_DETECT_FLOW_PATTERNS, params)

        transactions: dict[str, TransactionEvidence] = {}
        accounts: set[str] = set()
        paths: list[GraphPath] = []

        for row in rows:
            if not row or row[0] is None:
                continue
            t1_id = str(row[0])
            t1_ts = row[1]
            a_key = str(row[2])
            b_key = str(row[3])
            t1_amount = float(row[4]) if row[4] is not None else None
            t1_curr = str(row[5]) if row[5] is not None else None
            t1_ptype = str(row[6]) if row[6] is not None else None

            t2_id = str(row[7])
            t2_ts = row[8]
            c_key = str(row[9])
            t2_amount = float(row[10]) if row[10] is not None else None
            t2_curr = str(row[11]) if row[11] is not None else None
            t2_ptype = str(row[12]) if row[12] is not None else None

            accounts.update([a_key, b_key, c_key])
            transactions[t1_id] = TransactionEvidence(
                transaction_id=t1_id,
                timestamp=t1_ts,
                source_account_key=a_key,
                destination_account_key=b_key,
                amount=t1_amount,
                currency=t1_curr,
                payment_type=t1_ptype,
            )
            transactions[t2_id] = TransactionEvidence(
                transaction_id=t2_id,
                timestamp=t2_ts,
                source_account_key=b_key,
                destination_account_key=c_key,
                amount=t2_amount,
                currency=t2_curr,
                payment_type=t2_ptype,
            )

            paths.append(
                GraphPath(
                    nodes=[a_key, t1_id, b_key, t2_id, c_key],
                    relationships=["SENT", "RECEIVED", "SENT", "RECEIVED"],
                )
            )

        return GraphQueryResult(
            transactions=list(transactions.values()),
            accounts=sorted(accounts),
            paths=paths,
            query_duration_ms=round(duration_ms, 2),
        )


_graph_client: FalkorDBClient | None = None


def get_graph_client() -> FalkorDBClient:
    """FastAPI dependency for FalkorDB client."""
    global _graph_client
    if _graph_client is None:
        _graph_client = FalkorDBClient()
    return _graph_client
