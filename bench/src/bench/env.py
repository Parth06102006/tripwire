"""Run environment capture: hardware, OS, git, input hashes, FalkorDB state.

Also provides resource meters used by the cost model: process-tree CPU time
and peak resident memory, and FalkorDB server CPU/memory counters read from
``INFO``. FalkorDB counters are server-wide; when other clients use the same
server during a run they are included, and ``foreign_activity`` reports it.
"""

from __future__ import annotations

import hashlib
import os
import platform
import subprocess
import threading
import time
from pathlib import Path
from typing import Any, Self

import psutil


def sha256_file(path: Path, chunk: int = 1 << 22) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while block := handle.read(chunk):
            digest.update(block)
    return digest.hexdigest()


def _git(repo: Path, *args: str) -> str:
    try:
        return subprocess.run(
            ["git", *args], cwd=repo, capture_output=True, text=True, check=True
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def git_info(repo: Path) -> dict[str, Any]:
    status = _git(repo, "status", "--porcelain")
    return {
        "commit": _git(repo, "rev-parse", "HEAD"),
        "branch": _git(repo, "rev-parse", "--abbrev-ref", "HEAD"),
        "dirty": bool(status) and status != "unknown",
    }


def _cpu_name() -> str:
    if platform.system() == "Windows":
        try:
            import winreg

            key = winreg.OpenKey(
                winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\CentralProcessor\0"
            )
            return str(winreg.QueryValueEx(key, "ProcessorNameString")[0]).strip()
        except OSError:
            pass
    return platform.processor() or "unknown"


def hardware_info() -> dict[str, Any]:
    memory = psutil.virtual_memory()
    return {
        "cpu": _cpu_name(),
        "physical_cores": psutil.cpu_count(logical=False),
        "logical_threads": psutil.cpu_count(logical=True),
        "memory_total_gib": round(memory.total / 2**30, 2),
        "os": f"{platform.system()} {platform.release()} ({platform.version()})",
        "python": platform.python_version(),
        "machine": platform.machine(),
    }


def package_versions(*names: str) -> dict[str, str]:
    from importlib.metadata import PackageNotFoundError, version

    found: dict[str, str] = {}
    for name in names:
        try:
            found[name] = version(name)
        except PackageNotFoundError:
            found[name] = "absent"
    return found


class FalkorMeter:
    """Server-wide FalkorDB counters over a plain Redis connection."""

    def __init__(self, host: str, port: int) -> None:
        import redis

        self._redis = redis.Redis(host=host, port=port, socket_timeout=30)

    def config(self) -> dict[str, Any]:
        raw = self._redis.execute_command("GRAPH.CONFIG", "GET", "*")
        config: dict[str, Any] = {}
        for item in raw:
            key, value = item[0], item[1]
            key = key.decode() if isinstance(key, bytes) else str(key)
            config[key] = value.decode() if isinstance(value, bytes) else value
        return config

    def server(self) -> dict[str, Any]:
        info = self._redis.info("server")
        modules = self._redis.execute_command("MODULE", "LIST")
        graph_version = None
        for module in modules:
            entries = (
                module
                if isinstance(module, dict)
                else dict(zip(module[::2], module[1::2], strict=False))
            )
            name = entries.get(b"name", entries.get("name"))
            if name in (b"graph", "graph"):
                graph_version = entries.get(b"ver", entries.get("ver"))
        return {
            "redis_version": info.get("redis_version"),
            "falkordb_module_version": graph_version,
            "os": info.get("os"),
        }

    def cpu_seconds(self) -> float:
        info = self._redis.info("cpu")
        return float(info["used_cpu_user"]) + float(info["used_cpu_sys"])

    def used_memory(self) -> int:
        return int(self._redis.info("memory")["used_memory"])

    def graph_query_calls(self) -> int:
        stats = self._redis.info("commandstats")
        total = 0
        for key, value in stats.items():
            if key.lower().startswith("cmdstat_graph.") and "query" in key.lower():
                total += int(value["calls"])
        return total

    def graph_memory_mb(self, graph_name: str) -> float | None:
        try:
            raw = self._redis.execute_command("GRAPH.MEMORY", "USAGE", graph_name)
        except Exception:  # noqa: BLE001 -- command absent on older servers
            return None
        entries = raw if isinstance(raw, dict) else dict(zip(raw[::2], raw[1::2], strict=False))
        for key, value in entries.items():
            name = key.decode() if isinstance(key, bytes) else str(key)
            if name == "total_graph_sz_mb":
                return float(value)
        return None

    def blocked_clients(self) -> int:
        """Clients waiting on a running graph query (FalkorDB blocks them)."""
        return int(self._redis.info("clients").get("blocked_clients", 0))

    def activity(self, seconds: float) -> dict[str, float]:
        """Server activity over ``seconds`` while this suite is idle."""
        calls = self.graph_query_calls()
        cpu = self.cpu_seconds()
        blocked = 0
        deadline = time.perf_counter() + seconds
        while time.perf_counter() < deadline:
            blocked = max(blocked, self.blocked_clients())
            time.sleep(0.2)
        return {
            "graph_query_calls": self.graph_query_calls() - calls,
            "cpu_cores_busy": (self.cpu_seconds() - cpu) / seconds,
            "max_blocked_clients": blocked,
        }

    def wait_for_quiet(
        self, max_wait_seconds: float, *, probe_seconds: float = 3.0, cpu_cores: float = 0.15
    ) -> dict[str, Any]:
        """Wait until no other client is running graph queries.

        Quiet means one probe window with no graph query calls, no blocked
        clients, and server CPU below ``cpu_cores``. Returns how long the
        wait took and whether quiet was reached; the run continues either
        way, and results are flagged when it was not.
        """
        started = time.perf_counter()
        last: dict[str, float] = {}
        while True:
            last = self.activity(probe_seconds)
            quiet = (
                last["graph_query_calls"] == 0
                and last["max_blocked_clients"] == 0
                and last["cpu_cores_busy"] < cpu_cores
            )
            waited = time.perf_counter() - started
            if quiet or waited >= max_wait_seconds:
                return {"quiet": quiet, "waited_seconds": waited, "last_probe": last}

    def list_graphs(self) -> list[str]:
        return [
            item.decode() if isinstance(item, bytes) else str(item)
            for item in self._redis.execute_command("GRAPH.LIST")
        ]

    def close(self) -> None:
        self._redis.close()


def tree_processes(root: psutil.Process) -> list[psutil.Process]:
    try:
        return [root, *root.children(recursive=True)]
    except psutil.Error:
        return [root]


def tree_cpu_seconds(root: psutil.Process) -> float:
    total = 0.0
    for proc in tree_processes(root):
        try:
            times = proc.cpu_times()
            total += times.user + times.system
        except psutil.Error:
            continue
    return total


def tree_rss_bytes(root: psutil.Process) -> int:
    total = 0
    for proc in tree_processes(root):
        try:
            total += proc.memory_info().rss
        except psutil.Error:
            continue
    return total


class ResourceWindow:
    """Measure CPU time and peak memory of a process tree (and FalkorDB) over a window.

    A sampler thread polls resident memory every ``interval`` seconds. Use
    as a context manager; ``result()`` returns a JSON-ready dict.
    """

    def __init__(
        self,
        root: psutil.Process,
        falkor: FalkorMeter | None = None,
        interval: float = 0.1,
    ) -> None:
        self._root = root
        self._falkor = falkor
        self._interval = interval
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._sample, daemon=True)
        self._peak_rss = 0
        self._peak_falkor = 0
        self._peak_blocked = 0
        self._data: dict[str, Any] = {}

    def _sample(self) -> None:
        while not self._stop.is_set():
            self._peak_rss = max(self._peak_rss, tree_rss_bytes(self._root))
            if self._falkor is not None:
                try:
                    self._peak_falkor = max(self._peak_falkor, self._falkor.used_memory())
                    self._peak_blocked = max(self._peak_blocked, self._falkor.blocked_clients())
                except Exception:  # noqa: BLE001, S110 -- sampling is best effort
                    pass
            self._stop.wait(self._interval)

    def __enter__(self) -> Self:
        self._start_rss = tree_rss_bytes(self._root)
        self._start_cpu = tree_cpu_seconds(self._root)
        if self._falkor is not None:
            self._start_falkor_cpu = self._falkor.cpu_seconds()
            self._start_falkor_mem = self._falkor.used_memory()
            self._start_calls = self._falkor.graph_query_calls()
        self._start_wall = time.perf_counter()
        self._thread.start()
        return self

    def __exit__(self, *_exc: object) -> None:
        wall = time.perf_counter() - self._start_wall
        self._stop.set()
        self._thread.join()
        self._data = {
            "wall_seconds": wall,
            "process_cpu_seconds": tree_cpu_seconds(self._root) - self._start_cpu,
            "process_rss_start_mib": self._start_rss / 2**20,
            "process_rss_peak_mib": max(self._peak_rss, self._start_rss) / 2**20,
        }
        if self._falkor is not None:
            self._data.update(
                {
                    "falkordb_cpu_seconds": self._falkor.cpu_seconds() - self._start_falkor_cpu,
                    "falkordb_used_memory_start_mib": self._start_falkor_mem / 2**20,
                    "falkordb_used_memory_peak_mib": max(
                        self._peak_falkor, self._start_falkor_mem
                    )
                    / 2**20,
                    "falkordb_graph_query_calls": self._falkor.graph_query_calls()
                    - self._start_calls,
                    "falkordb_max_blocked_clients": self._peak_blocked,
                }
            )

    def result(self) -> dict[str, Any]:
        return dict(self._data)


def environment_block(repo: Path) -> dict[str, Any]:
    return {
        "hardware": hardware_info(),
        "git": git_info(repo),
        "packages": package_versions(
            "lightgbm", "numpy", "falkordb", "fastapi", "uvicorn", "httpx", "pydantic"
        ),
        "env_overrides": {
            key: value
            for key, value in os.environ.items()
            if key.startswith("TRACEAML_") and "KEY" not in key and "SECRET" not in key
        },
    }
