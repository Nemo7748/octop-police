"""Tests for the builtin skill catalog (packaged library + workspace sync)."""

from __future__ import annotations

from pathlib import Path

import pytest
from tests.support.fakes import FakeHarnessAgent

from octop.infra.agents.builtin_skills.catalog import (
    BuiltinSkillCatalog,
    get_builtin_skill_catalog,
)
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
ALL_SLUGS = tuple(sorted(POLICE_SKILLS + OFFICE_SKILLS))


# --- 5.1 packaged resource assertions ---------------------------------------


def test_default_catalog_loads_all_ten_skills() -> None:
    catalog = get_builtin_skill_catalog()
    assert [e.slug for e in catalog.entries()] == list(ALL_SLUGS)
    assert catalog.invalid_slugs == {}
    for entry in catalog.entries():
        assert entry.name == entry.slug
        assert entry.description.strip()
        assert entry.version.strip()
        assert entry.body.strip()
        assert any(rel == "SKILL.md" for rel, _data in entry.files)


def test_police_skills_have_home_metadata() -> None:
    catalog = get_builtin_skill_catalog()
    seen_orders: set[int] = set()
    for slug in POLICE_SKILLS:
        entry = catalog.get(slug)
        assert entry is not None
        meta, _ = parse_frontmatter(entry.skill_md)
        home = ((meta.get("metadata") or {}).get("octop") or {}).get("home") or {}
        assert isinstance(home.get("order"), int) and home["order"] >= 1, slug
        assert home["order"] not in seen_orders, slug
        seen_orders.add(home["order"])
        prompt = home.get("prompt") or {}
        assert str(prompt.get("zh") or "").strip(), slug
        assert str(prompt.get("en") or "").strip(), slug
        assert str(home.get("color") or "").strip(), slug
        assert str(home.get("icon_name") or "").strip(), slug


def test_office_skills_have_no_home_metadata() -> None:
    catalog = get_builtin_skill_catalog()
    for slug in OFFICE_SKILLS:
        entry = catalog.get(slug)
        assert entry is not None
        meta, _ = parse_frontmatter(entry.skill_md)
        home = ((meta.get("metadata") or {}).get("octop") or {}).get("home")
        assert home is None, slug


def test_police_skill_business_contracts() -> None:
    catalog = get_builtin_skill_catalog()
    legal = catalog.get("police-legal-regulation-search")
    assert legal is not None
    assert "来源" in legal.body
    assert "日期" in legal.body
    for slug in ("police-official-drafting", "police-dossier-review"):
        entry = catalog.get(slug)
        assert entry is not None
        assert "人工复核" in entry.body, slug


# --- 5.2 sync behaviour ------------------------------------------------------


async def test_first_sync_writes_all_skills() -> None:
    catalog = get_builtin_skill_catalog()
    agent = FakeHarnessAgent()
    result = await catalog.sync_to_workspace(agent.workspace)

    assert result.synced == list(ALL_SLUGS)
    assert result.skipped == []
    assert result.invalid_slugs == []
    for slug in ALL_SLUGS:
        stored = await agent.workspace.aread_text(f"_builtin_skills/{slug}/SKILL.md")
        assert stored is not None
        assert stored == catalog.get(slug).skill_md  # type: ignore[union-attr]


async def test_repeat_sync_is_idempotent() -> None:
    catalog = get_builtin_skill_catalog()
    agent = FakeHarnessAgent()
    first = await catalog.sync_to_workspace(agent.workspace)
    second = await catalog.sync_to_workspace(agent.workspace)

    assert first.synced == list(ALL_SLUGS)
    assert second.synced == []
    assert second.skipped == list(ALL_SLUGS)
    assert second.invalid_slugs == []


async def test_changed_skill_md_is_overwritten() -> None:
    catalog = get_builtin_skill_catalog()
    agent = FakeHarnessAgent()
    await catalog.sync_to_workspace(agent.workspace)

    target = "_builtin_skills/police-ppt-generation/SKILL.md"
    await agent.workspace.awrite_text(target, "---\nname: x\ndescription: stale\n---\nstale\n")
    result = await catalog.sync_to_workspace(agent.workspace)

    assert "police-ppt-generation" in result.synced
    stored = await agent.workspace.aread_text(target)
    assert stored == catalog.get("police-ppt-generation").skill_md  # type: ignore[union-attr]


async def test_user_skills_directory_untouched() -> None:
    catalog = get_builtin_skill_catalog()
    agent = FakeHarnessAgent()
    user_skill = "skills/police-ppt-generation/SKILL.md"
    await agent.workspace.awrite_text(user_skill, "---\nname: mine\ndescription: user override\n---\nmine\n")
    before = await agent.workspace.aread_text(user_skill)

    await catalog.sync_to_workspace(agent.workspace)

    assert await agent.workspace.aread_text(user_skill) == before
    # The user override is written to skills/, the builtin to _builtin_skills/;
    # read-time override precedence lives in the skills router, not here.
    assert await agent.workspace.aread_text(
        "_builtin_skills/police-ppt-generation/SKILL.md"
    ) == catalog.get("police-ppt-generation").skill_md  # type: ignore[union-attr]


async def test_sync_against_disk_backed_workspace(tmp_path: Path) -> None:
    catalog = get_builtin_skill_catalog()
    agent = FakeHarnessAgent()
    agent.use_workspace_dir(tmp_path)
    result = await catalog.sync_to_workspace(agent.workspace)

    assert result.synced == list(ALL_SLUGS)
    assert (tmp_path / "_builtin_skills" / "police-dossier-review" / "SKILL.md").is_file()
    again = await catalog.sync_to_workspace(agent.workspace)
    assert again.synced == []
    assert again.skipped == list(ALL_SLUGS)


# --- malformed package isolation ---------------------------------------------


def _write_skill(root: Path, slug: str, skill_md: str) -> None:
    skill_dir = root / slug
    skill_dir.mkdir(parents=True)
    (skill_dir / "SKILL.md").write_text(skill_md, encoding="utf-8")


@pytest.fixture()
def mixed_library(tmp_path: Path) -> Path:
    _write_skill(
        tmp_path,
        "ok-skill",
        "---\nname: ok-skill\ndescription: fine\nmetadata:\n  builtin_skill_version: \"1.0\"\n---\n\nbody\n",
    )
    _write_skill(tmp_path, "no-frontmatter", "# just markdown\n")
    _write_skill(
        tmp_path,
        "missing-version",
        "---\nname: missing-version\ndescription: no version\n---\n\nbody\n",
    )
    _write_skill(
        tmp_path,
        "empty-description",
        "---\nname: empty-description\ndescription: \"\"\nmetadata:\n  builtin_skill_version: \"1.0\"\n---\n\nbody\n",
    )
    (tmp_path / "no-skill-md").mkdir()
    (tmp_path / "__pycache__").mkdir()
    return tmp_path


def test_malformed_packages_are_isolated(mixed_library: Path) -> None:
    catalog = BuiltinSkillCatalog(mixed_library)

    assert [e.slug for e in catalog.entries()] == ["ok-skill"]
    assert sorted(catalog.invalid_slugs) == [
        "empty-description",
        "missing-version",
        "no-frontmatter",
        "no-skill-md",
    ]
    assert catalog.invalid_slugs["no-frontmatter"]
    assert "__pycache__" not in catalog.invalid_slugs


async def test_sync_skips_invalid_but_syncs_valid(mixed_library: Path) -> None:
    catalog = BuiltinSkillCatalog(mixed_library)
    agent = FakeHarnessAgent()
    result = await catalog.sync_to_workspace(agent.workspace)

    assert result.synced == ["ok-skill"]
    assert result.invalid_slugs == ["empty-description", "missing-version", "no-frontmatter", "no-skill-md"]
    stored = await agent.workspace.aread_text("_builtin_skills/ok-skill/SKILL.md")
    assert stored is not None and "body" in stored
    assert await agent.workspace.aread_text("_builtin_skills/no-frontmatter/SKILL.md") is None
