"""Tests for the 11 bundled police agent templates and catalog visibility."""

from __future__ import annotations

import json
from pathlib import Path

from octop.infra.agents.experts.catalog import (
    CATALOG_GROUPS,
    ExpertCatalog,
    default_library_root,
)

POLICE_TEMPLATES: dict[str, tuple[str, ...]] = {
    "police-development": (
        "police-data-dashboard",
        "police-field-offline-collection",
        "police-video-geo-location",
        "police-visual-modeling",
        "police-risk-warning",
    ),
    "web-workbench": (
        "police-officer-workbench",
        "police-nl-visualization",
        "police-drag-visual-editor",
        "police-multi-device-preview",
        "police-template-market",
        "police-release-review",
    ),
}

EXPECTED_SLUGS = {slug for slugs in POLICE_TEMPLATES.values() for slug in slugs}

LEGACY_SLUGS = (
    "general-assistant",
    "ops-engineer",
    "default",
    "office-automation",
    "stock-assistant",
    "news-trend",
    "parenting-companion",
    "wechat-ops",
    "cvm-ai-doctor",
    "cvm-cluster-doctor",
)


def _manifest(slug: str) -> dict:
    path = default_library_root() / slug / "manifest.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _bilingual(data: dict, field: str, slug: str) -> None:
    node = data[field]
    assert str(node["zh"]).strip(), f"{slug}.{field}.zh is empty"
    assert str(node["en"]).strip(), f"{slug}.{field}.en is empty"


def test_police_templates_exist_with_expected_structure() -> None:
    assert len(EXPECTED_SLUGS) == 11
    for slug in sorted(EXPECTED_SLUGS):
        data = _manifest(slug)
        assert data["id"] == slug
        assert data["catalog_visible"] is True
        assert data["group"] in CATALOG_GROUPS
        assert isinstance(data["order"], int) and not isinstance(data["order"], bool)
        assert data["order"] > 0
        for field in ("label", "description", "welcome_message"):
            _bilingual(data, field, slug)
        assert data["icon_name"], f"{slug} needs icon_name"
        assert data["color"], f"{slug} needs color"
        assert data["prompt_files"], f"{slug} must declare prompt_files"
        prompts = data["quick_prompts"]
        assert prompts, f"{slug} needs quick_prompts"
        first = prompts[0]
        assert str(first["prompt"]["zh"]).strip(), f"{slug} first prompt zh empty"
        assert str(first["prompt"]["en"]).strip(), f"{slug} first prompt en empty"
        _bilingual(first, "title", slug)
        _bilingual(first, "description", slug)


def test_police_template_group_counts_and_unique_orders() -> None:
    assert len(POLICE_TEMPLATES["police-development"]) == 5
    assert len(POLICE_TEMPLATES["web-workbench"]) == 6
    for group, slugs in POLICE_TEMPLATES.items():
        assert group in CATALOG_GROUPS
        group_orders: list[int] = []
        for slug in slugs:
            data = _manifest(slug)
            assert data["group"] == group, f"{slug} must belong to {group}"
            group_orders.append(data["order"])
        assert len(set(group_orders)) == len(group_orders), (
            f"duplicate order inside {group}"
        )


def test_police_template_prompt_files_exist() -> None:
    root = default_library_root()
    for slug in sorted(EXPECTED_SLUGS):
        data = _manifest(slug)
        for rel in data["prompt_files"]:
            assert (root / slug / rel).is_file(), f"{slug}/{rel} missing"


def test_police_template_soul_declares_output_contract() -> None:
    root = default_library_root()
    for slug in sorted(EXPECTED_SLUGS):
        soul = (root / slug / "SOUL.md").read_text(encoding="utf-8")
        assert "outbound/" in soul, f"{slug}/SOUL.md must declare outbound contract"
        assert "artifact.json" in soul, f"{slug}/SOUL.md must declare artifact.json"
        assert "演示数据" in soul, f"{slug}/SOUL.md must declare demo-data labeling"


def test_police_templates_visible_and_sorted_in_catalog() -> None:
    catalog = ExpertCatalog(default_library_root())
    catalog.refresh()
    summaries = catalog.list_summaries()
    ids = [s.id for s in summaries]
    assert len(ids) == 11, f"catalog should list exactly 11, got {ids}"
    assert set(ids) == EXPECTED_SLUGS
    dev_ids = [s.id for s in summaries if s.group == "police-development"]
    web_ids = [s.id for s in summaries if s.group == "web-workbench"]
    assert len(dev_ids) == 5
    assert len(web_ids) == 6
    assert ids[: len(dev_ids)] == dev_ids, "police-development group must come first"
    assert ids[len(dev_ids) :] == web_ids
    dev_orders = [s.order for s in summaries if s.group == "police-development"]
    web_orders = [s.order for s in summaries if s.group == "web-workbench"]
    assert dev_orders == sorted(dev_orders)
    assert web_orders == sorted(web_orders)


def test_legacy_templates_hidden_but_gettable() -> None:
    catalog = ExpertCatalog(default_library_root())
    catalog.refresh()
    ids = [s.id for s in catalog.list_summaries()]
    for slug in LEGACY_SLUGS:
        assert slug not in ids, f"legacy template {slug} must not be listed"
        assert catalog.get(slug) is not None, f"legacy template {slug} still gettable"


def test_expert_ids_unique_across_library(tmp_path: Path) -> None:
    from octop.infra.agents.experts.catalog import MANIFEST_FILENAME

    root = default_library_root()
    seen: dict[str, str] = {}
    for entry in sorted(root.iterdir()):
        manifest = entry / MANIFEST_FILENAME
        if not entry.is_dir() or not manifest.is_file():
            continue
        data = json.loads(manifest.read_text(encoding="utf-8"))
        slug = str(data.get("id") or entry.name)
        assert slug not in seen, f"duplicate id {slug}: {seen[slug]} vs {entry.name}"
        seen[slug] = entry.name
