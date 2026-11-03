"""Tests for ExpertCatalog workspace discovery and lazy file reads."""

from __future__ import annotations

import json
from pathlib import Path


def _write_manifest(expert_dir: Path, *, extra: dict | None = None) -> None:
    payload: dict = {
        "id": expert_dir.name,
        "label": {"zh": "测试", "en": "Test"},
        "description": {"zh": "desc", "en": "desc"},
    }
    if extra:
        payload.update(extra)
    (expert_dir / "manifest.json").write_text(
        json.dumps(payload, ensure_ascii=False),
        encoding="utf-8",
    )


def test_expert_discovers_seed_paths(tmp_path: Path) -> None:
    from octop.infra.agents.experts.catalog import ExpertCatalog

    expert_dir = tmp_path / "my-expert"
    expert_dir.mkdir()
    _write_manifest(expert_dir)
    (expert_dir / "SOUL.md").write_text("# Soul\nhello", encoding="utf-8")
    skill = expert_dir / "skills" / "my-skill" / "SKILL.md"
    skill.parent.mkdir(parents=True)
    skill.write_text("# Skill", encoding="utf-8")

    catalog = ExpertCatalog(tmp_path)
    catalog.refresh()

    expert = catalog.get("my-expert")
    assert expert is not None
    assert "SOUL.md" in expert.files
    assert "skills/my-skill/SKILL.md" in expert.files
    assert expert.prompt_files == []


def test_expert_catalog_reads_extra_roots(tmp_path: Path) -> None:
    from octop.infra.agents.experts.catalog import ExpertCatalog

    bundled_root = tmp_path / "bundled"
    market_root = tmp_path / "market"
    bundled_dir = bundled_root / "bundled-expert"
    market_dir = market_root / "market-expert"
    bundled_dir.mkdir(parents=True)
    market_dir.mkdir(parents=True)
    _write_manifest(bundled_dir)
    _write_manifest(market_dir)
    (market_dir / "SOUL.md").write_text("# Market soul", encoding="utf-8")

    catalog = ExpertCatalog(bundled_root, extra_roots=[market_root])
    catalog.refresh()

    assert catalog.get("bundled-expert") is not None
    market = catalog.get("market-expert")
    assert market is not None
    assert catalog.expert_dir("market-expert") == market_dir
    assert "SOUL.md" in market.files


def test_expert_lazy_read_file_contents(tmp_path: Path) -> None:
    from octop.infra.agents.experts.catalog import ExpertCatalog

    expert_dir = tmp_path / "my-expert"
    expert_dir.mkdir()
    _write_manifest(expert_dir, extra={"prompt_files": ["SOUL.md"]})
    (expert_dir / "SOUL.md").write_text("# Soul\nhello", encoding="utf-8")
    (expert_dir / "extra.md").write_text("also copied", encoding="utf-8")

    catalog = ExpertCatalog(tmp_path)
    catalog.refresh()

    expert = catalog.get("my-expert")
    assert expert is not None
    assert expert.prompt_files == ["SOUL.md"]
    contents = {item["name"]: item["content"] for item in catalog.read_file_contents("my-expert")}
    assert contents["SOUL.md"] == "# Soul\nhello"
    assert contents["extra.md"] == "also copied"
    assert "manifest.json" not in expert.files


def test_preview_file_paths_limits_dashboard_preview(tmp_path: Path) -> None:
    from octop.infra.agents.experts.catalog import ExpertCatalog, preview_file_paths

    expert_dir = tmp_path / "my-expert"
    expert_dir.mkdir()
    _write_manifest(expert_dir, extra={"prompt_files": ["SOUL.md"]})
    (expert_dir / "SOUL.md").write_text("# Soul\nhello", encoding="utf-8")
    (expert_dir / "BOOTSTRAP.md").write_text("bootstrap", encoding="utf-8")
    (expert_dir / "references" / "cron-presets.json").parent.mkdir(parents=True)
    (expert_dir / "references" / "cron-presets.json").write_text("{}", encoding="utf-8")
    skill = expert_dir / "skills" / "my-skill" / "SKILL.md"
    skill.parent.mkdir(parents=True)
    skill.write_text("# Skill", encoding="utf-8")

    catalog = ExpertCatalog(tmp_path)
    catalog.refresh()

    expert = catalog.get("my-expert")
    assert expert is not None
    preview = preview_file_paths(expert)
    assert preview == ["SOUL.md", "skills/my-skill/SKILL.md"]
    names = {item["name"] for item in catalog.read_file_contents("my-expert", paths=preview)}
    assert names == {"SOUL.md", "skills/my-skill/SKILL.md"}


def test_expert_prompt_files_metadata_only(tmp_path: Path) -> None:
    from octop.infra.agents.experts.catalog import ExpertCatalog

    expert_dir = tmp_path / "my-expert"
    expert_dir.mkdir()
    _write_manifest(expert_dir, extra={"prompt_files": ["SOUL.md"]})
    (expert_dir / "SOUL.md").write_text("# Soul\nhello", encoding="utf-8")
    skill = expert_dir / "skills" / "my-skill" / "SKILL.md"
    skill.parent.mkdir(parents=True)
    skill.write_text("# Skill\n" + ("x" * 5000), encoding="utf-8")

    catalog = ExpertCatalog(tmp_path)
    catalog.refresh()

    expert = catalog.get("my-expert")
    assert expert is not None
    assert expert.prompt_files == ["SOUL.md"]
    skill_body = next(
        item["content"]
        for item in catalog.read_file_contents("my-expert")
        if item["name"] == "skills/my-skill/SKILL.md"
    )
    assert skill_body.startswith("# Skill")


def test_bundled_office_automation_discovers_skills() -> None:
    from octop.infra.agents.experts.catalog import ExpertCatalog, default_library_root

    catalog = ExpertCatalog(default_library_root())
    catalog.refresh()
    expert = catalog.get("office-automation")
    assert expert is not None
    assert expert.prompt_files
    assert len(expert.files) > 50
    names = {item["name"] for item in catalog.read_file_contents("office-automation")}
    assert "skills/docx/SKILL.md" in names
    docx_skill = next(
        item["content"]
        for item in catalog.read_file_contents("office-automation")
        if item["name"] == "skills/docx/SKILL.md"
    )
    assert "DOCX" in docx_skill


def test_expert_quick_prompts_from_manifest(tmp_path: Path) -> None:
    from octop.infra.agents.experts.catalog import ExpertCatalog

    expert_dir = tmp_path / "my-expert"
    expert_dir.mkdir()
    _write_manifest(
        expert_dir,
        extra={
            "prompt_files": ["SOUL.md"],
            "quick_prompts": [
                {
                    "title": {"zh": "标题", "en": "Title"},
                    "description": {"zh": "说明", "en": "Desc"},
                    "prompt": {"zh": "你好", "en": "Hello"},
                    "color": "#abcdef",
                    "icon_name": "zap",
                }
            ],
        },
    )
    (expert_dir / "SOUL.md").write_text("soul", encoding="utf-8")

    catalog = ExpertCatalog(tmp_path)
    catalog.refresh()

    expert = catalog.get("my-expert")
    assert expert is not None
    assert len(expert.quick_prompts) == 1
    assert expert.quick_prompts[0].title_zh == "标题"
    assert expert.quick_prompts[0].prompt_en == "Hello"


def _visible_manifest(expert_dir: Path, *, group: str, order: int) -> None:
    _write_manifest(
        expert_dir,
        extra={"catalog_visible": True, "group": group, "order": order},
    )


def test_catalog_visibility_defaults_hidden(tmp_path: Path) -> None:
    from octop.infra.agents.experts.catalog import ExpertCatalog

    expert_dir = tmp_path / "my-expert"
    expert_dir.mkdir()
    _write_manifest(expert_dir)

    catalog = ExpertCatalog(tmp_path)
    catalog.refresh()

    expert = catalog.get("my-expert")
    assert expert is not None
    assert expert.summary.catalog_visible is False
    assert expert.summary.group is None
    assert expert.summary.order is None
    assert catalog.list_summaries() == []


def test_catalog_visible_requires_group_and_order(tmp_path: Path) -> None:
    from octop.infra.agents.experts.catalog import ExpertCatalog

    no_meta = tmp_path / "no-meta"
    no_meta.mkdir()
    _write_manifest(no_meta, extra={"catalog_visible": True})
    bad_group = tmp_path / "bad-group"
    bad_group.mkdir()
    _write_manifest(bad_group, extra={"catalog_visible": True, "group": "other", "order": 1})
    bad_order = tmp_path / "bad-order"
    bad_order.mkdir()
    _write_manifest(
        bad_order,
        extra={"catalog_visible": True, "group": "web-workbench", "order": "first"},
    )
    zero_order = tmp_path / "zero-order"
    zero_order.mkdir()
    _write_manifest(
        zero_order, extra={"catalog_visible": True, "group": "web-workbench", "order": 0}
    )

    catalog = ExpertCatalog(tmp_path)
    catalog.refresh()

    assert catalog.list_summaries() == []
    for expert_id in ("no-meta", "bad-group", "bad-order", "zero-order"):
        assert catalog.get(expert_id) is not None


def test_catalog_list_sorted_by_group_and_order(tmp_path: Path) -> None:
    from octop.infra.agents.experts.catalog import ExpertCatalog

    for name, group, order in [
        ("web-b", "web-workbench", 2),
        ("dev-a", "police-development", 1),
        ("web-a", "web-workbench", 1),
        ("dev-b", "police-development", 2),
    ]:
        expert_dir = tmp_path / name
        expert_dir.mkdir()
        _visible_manifest(expert_dir, group=group, order=order)
        (expert_dir / "SOUL.md").write_text("soul", encoding="utf-8")

    catalog = ExpertCatalog(tmp_path)
    catalog.refresh()

    ids = [s.id for s in catalog.list_summaries()]
    assert ids == ["dev-a", "dev-b", "web-a", "web-b"]


def test_catalog_duplicate_order_skips_later_entry(tmp_path: Path) -> None:
    from octop.infra.agents.experts.catalog import ExpertCatalog

    first = tmp_path / "first"
    first.mkdir()
    _visible_manifest(first, group="police-development", order=1)
    second = tmp_path / "second"
    second.mkdir()
    _visible_manifest(second, group="police-development", order=1)

    catalog = ExpertCatalog(tmp_path)
    catalog.refresh()

    summaries = catalog.list_summaries()
    assert [s.id for s in summaries] == ["first"]
    second_expert = catalog.get("second")
    assert second_expert is not None
    assert second_expert.summary.catalog_visible is False


def test_catalog_hidden_entry_still_gettable(tmp_path: Path) -> None:
    from octop.infra.agents.experts.catalog import ExpertCatalog

    hidden = tmp_path / "hidden"
    hidden.mkdir()
    _write_manifest(hidden, extra={"catalog_visible": False})
    (hidden / "SOUL.md").write_text("soul", encoding="utf-8")

    catalog = ExpertCatalog(tmp_path)
    catalog.refresh()

    assert catalog.list_summaries() == []
    expert = catalog.get("hidden")
    assert expert is not None
    assert "SOUL.md" in expert.files


def test_catalog_malformed_entry_does_not_break_others(tmp_path: Path) -> None:
    from octop.infra.agents.experts.catalog import ExpertCatalog

    broken = tmp_path / "broken"
    broken.mkdir()
    (broken / "manifest.json").write_text("{not json", encoding="utf-8")
    good = tmp_path / "good"
    good.mkdir()
    _visible_manifest(good, group="web-workbench", order=1)

    catalog = ExpertCatalog(tmp_path)
    catalog.refresh()

    assert [s.id for s in catalog.list_summaries()] == ["good"]


def test_summary_dict_outputs_catalog_meta() -> None:
    from octop.api.routers.experts import _summary_dict
    from octop.infra.agents.experts.catalog import ExpertSummary

    visible = _summary_dict(
        ExpertSummary(
            id="police-x",
            label_zh="甲",
            label_en="A",
            description_zh="",
            description_en="",
            catalog_visible=True,
            group="web-workbench",
            order=3,
        )
    )
    assert visible["group"] == "web-workbench"
    assert visible["order"] == 3

    legacy = _summary_dict(
        ExpertSummary(id="old", label_zh="乙", label_en="B", description_zh="", description_en="")
    )
    assert legacy["group"] is None
    assert legacy["order"] is None
