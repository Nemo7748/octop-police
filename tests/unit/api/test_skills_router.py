"""Unit tests for skills router pure helpers (summary / home_entry parsing)."""

from __future__ import annotations

from typing import Any

import pytest

from octop.api.routers.skills import _home_entry, _summary_dict
from octop.infra.agents.builtin_skills.catalog import get_builtin_skill_catalog
from octop.infra.utils.frontmatter import parse_frontmatter

POLICE_SKILLS = (
    "police-ppt-generation",
    "police-document-organizing",
    "police-official-drafting",
    "police-legal-regulation-search",
    "police-case-management-webapp",
    "police-dossier-review",
)
OFFICE_SKILLS = ("pptx", "docx", "xlsx", "pdf")

VALID_HOME = {
    "order": 3,
    "prompt": {"zh": "中文提示", "en": "English prompt"},
    "color": "#0891b2",
    "icon_name": "briefcase",
}


def _meta(home: Any) -> dict[str, Any]:
    return {"name": "s", "description": "d", "metadata": {"octop": {"home": home}}}


def test_home_entry_valid() -> None:
    assert _home_entry(_meta(VALID_HOME)) == {
        "order": 3,
        "prompt": {"zh": "中文提示", "en": "English prompt"},
        "color": "#0891b2",
        "icon_name": "briefcase",
    }


def test_home_entry_absent_without_metadata() -> None:
    assert _home_entry({"name": "s"}) is None
    assert _home_entry({"name": "s", "metadata": {}}) is None
    assert _home_entry({"name": "s", "metadata": {"octop": {}}}) is None


@pytest.mark.parametrize(
    "home",
    [
        {**VALID_HOME, "order": 0},
        {**VALID_HOME, "order": True},
        {**VALID_HOME, "order": "3"},
        {**VALID_HOME, "prompt": {"zh": "只有中文"}},
        {**VALID_HOME, "prompt": {"zh": " ", "en": "en"}},
        {**VALID_HOME, "color": ""},
        {**VALID_HOME, "icon_name": None},
        {"order": 1},
    ],
)
def test_home_entry_malformed_returns_none(home: Any) -> None:
    assert _home_entry(_meta(home)) is None


def test_summary_dict_includes_home_entry_when_valid() -> None:
    summary = _summary_dict("my-skill", _meta(VALID_HOME), enabled=True, kind="builtin")
    assert summary["home_entry"] == {
        "order": 3,
        "prompt": {"zh": "中文提示", "en": "English prompt"},
        "color": "#0891b2",
        "icon_name": "briefcase",
    }


def test_summary_dict_omits_home_entry_when_absent() -> None:
    summary = _summary_dict(
        "plain",
        {"name": "plain", "description": "x"},
        enabled=True,
        kind="workspace",
    )
    assert "home_entry" not in summary


def test_builtin_police_skills_expose_home_entry() -> None:
    catalog = get_builtin_skill_catalog()
    for slug in POLICE_SKILLS:
        entry = catalog.get(slug)
        assert entry is not None
        meta, _ = parse_frontmatter(entry.skill_md)
        summary = _summary_dict(slug, meta, enabled=True, kind="builtin")
        home = summary.get("home_entry")
        assert home is not None, slug
        assert home["order"] >= 1
        assert home["prompt"]["zh"].strip() and home["prompt"]["en"].strip()


def test_office_skills_have_no_home_entry() -> None:
    catalog = get_builtin_skill_catalog()
    for slug in OFFICE_SKILLS:
        entry = catalog.get(slug)
        assert entry is not None
        meta, _ = parse_frontmatter(entry.skill_md)
        summary = _summary_dict(slug, meta, enabled=True, kind="builtin")
        assert "home_entry" not in summary, slug
