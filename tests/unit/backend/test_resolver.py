"""Tests for backend resolver helpers."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

from octop.infra.backend.resolver import (
    default_agent_backend_spec,
    ensure_workspace_inside_root,
)


def test_default_agent_backend_spec_posix_uses_host_root(tmp_path: Path) -> None:
    ws = tmp_path / "agents" / "AGT001"
    ws.mkdir(parents=True)
    with patch("octop.infra.backend.resolver.os.name", "posix"):
        spec = default_agent_backend_spec(ws)
    assert spec == {"type": "local_shell", "root_dir": "/", "virtual_mode": True}


def test_default_agent_backend_spec_windows_scopes_to_workspace(tmp_path: Path) -> None:
    ws = tmp_path / "agents" / "AGT001"
    ws.mkdir(parents=True)
    with patch("octop.infra.backend.resolver.os.name", "nt"):
        spec = default_agent_backend_spec(ws)
    assert spec == {
        "type": "local_shell",
        "root_dir": str(ws.resolve()),
        "virtual_mode": True,
    }


def test_ensure_workspace_inside_root_posix_keeps_spec(tmp_path: Path) -> None:
    ws = tmp_path / "agents" / "AGT001"
    ws.mkdir(parents=True)
    spec = {"type": "local_shell", "root_dir": "/somewhere", "virtual_mode": True}
    with patch("octop.infra.backend.resolver.os.name", "posix"):
        assert ensure_workspace_inside_root(spec, ws) is spec


def test_ensure_workspace_inside_root_keeps_containing_root(tmp_path: Path) -> None:
    ws = tmp_path / "agents" / "AGT001"
    ws.mkdir(parents=True)
    spec = {"type": "local_shell", "root_dir": str(tmp_path), "virtual_mode": True}
    with patch("octop.infra.backend.resolver.os.name", "nt"):
        assert ensure_workspace_inside_root(spec, ws) is spec


def test_ensure_workspace_inside_root_falls_back_when_outside(tmp_path: Path) -> None:
    ws = tmp_path / "agents" / "AGT001"
    ws.mkdir(parents=True)
    outside = tmp_path / "elsewhere"
    outside.mkdir()
    spec = {"type": "local_shell", "root_dir": str(outside), "virtual_mode": True}
    with patch("octop.infra.backend.resolver.os.name", "nt"):
        result = ensure_workspace_inside_root(spec, ws)
    assert result == {
        "type": "local_shell",
        "root_dir": str(ws.resolve()),
        "virtual_mode": True,
    }
    assert result is not spec


def test_ensure_workspace_inside_root_handles_composite(tmp_path: Path) -> None:
    ws = tmp_path / "agents" / "AGT001"
    ws.mkdir(parents=True)
    outside = tmp_path / "elsewhere"
    outside.mkdir()
    spec = {
        "type": "composite",
        "default": {"type": "local_shell", "root_dir": str(outside), "virtual_mode": True},
        "routes": {
            "/media": {"type": "local_shell", "root_dir": str(tmp_path), "virtual_mode": True},
        },
    }
    with patch("octop.infra.backend.resolver.os.name", "nt"):
        result = ensure_workspace_inside_root(spec, ws)
    assert result["default"]["root_dir"] == str(ws.resolve())
    assert result["routes"]["/media"]["root_dir"] == str(tmp_path)


def test_ensure_workspace_inside_root_ignores_non_fs_backends(tmp_path: Path) -> None:
    ws = tmp_path / "agents" / "AGT001"
    ws.mkdir(parents=True)
    state_spec = {"type": "state"}
    with patch("octop.infra.backend.resolver.os.name", "nt"):
        assert ensure_workspace_inside_root(state_spec, ws) is state_spec
    physical = {
        "type": "local_shell",
        "root_dir": str(tmp_path / "elsewhere"),
        "virtual_mode": False,
    }
    with patch("octop.infra.backend.resolver.os.name", "nt"):
        assert ensure_workspace_inside_root(physical, ws) is physical
