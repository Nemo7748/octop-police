"""Builtin skill catalog — packaged police / Office skills synced to agent workspaces.

Skill packages live under ``library/<slug>/SKILL.md`` (plus any supporting
files) and are copied into an agent workspace at ``_builtin_skills/<slug>/``
when the agent starts. Workspace skills override builtin entries of the same
slug at read time (see ``api/routers/skills.py``), so user ``skills/`` content
and ``skills_disabled`` are never touched by the sync.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from harness_agent.backends.workspace import DEFAULT_BUILTIN_SKILLS_DIR, BackendWorkspace

from octop.infra.utils.frontmatter import parse_frontmatter

logger = logging.getLogger(__name__)

SKILL_MANIFEST = "SKILL.md"

_TEXT_SUFFIXES = {".md", ".json", ".txt", ".sh", ".py", ".html", ".css", ".js"}


def _package_bytes(fpath: Path) -> bytes:
    """Read a package file; text files are LF-normalized so sync is checkout-independent."""
    data = fpath.read_bytes()
    if fpath.suffix.lower() in _TEXT_SUFFIXES:
        data = data.replace(b"\r\n", b"\n")
    return data


@dataclass(frozen=True)
class BuiltinSkillEntry:
    """One validated package under ``library/<slug>/``."""

    slug: str
    name: str
    description: str
    version: str
    """``metadata.builtin_skill_version`` — bump to force a workspace refresh."""
    body: str
    skill_md: str
    """Full ``SKILL.md`` text; content equality is the sync idempotency key."""
    files: tuple[tuple[str, bytes], ...]
    """All package files as ``(workspace-relative posix path, content)``."""


@dataclass
class SkillSyncResult:
    synced: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)
    invalid_slugs: list[str] = field(default_factory=list)


class BuiltinSkillCatalog:
    """Scans the packaged skill library once; syncs entries into workspaces."""

    def __init__(self, library_root: Path | None = None) -> None:
        self._root = library_root or default_library_root()
        self._entries: dict[str, BuiltinSkillEntry] = {}
        self._invalid: dict[str, str] = {}
        self._scan()

    @property
    def invalid_slugs(self) -> dict[str, str]:
        return dict(self._invalid)

    def entries(self) -> list[BuiltinSkillEntry]:
        return [self._entries[slug] for slug in sorted(self._entries)]

    def get(self, slug: str) -> BuiltinSkillEntry | None:
        return self._entries.get(slug)

    async def sync_to_workspace(self, workspace: BackendWorkspace) -> SkillSyncResult:
        """Copy every valid package into ``_builtin_skills/<slug>/``.

        Idempotent: a package whose ``SKILL.md`` is already byte-identical in
        the workspace is skipped; changed packages are overwritten wholesale.
        Only ``_builtin_skills/`` is written — user ``skills/`` and
        ``skills_disabled`` are untouched, and a user skill of the same slug
        keeps overriding the builtin at read time.
        """
        result = SkillSyncResult()
        for slug, entry in sorted(self._entries.items()):
            manifest_target = f"{DEFAULT_BUILTIN_SKILLS_DIR}/{slug}/{SKILL_MANIFEST}"
            existing = await workspace.aread_text(manifest_target)
            if existing is not None and existing == entry.skill_md:
                result.skipped.append(slug)
                continue
            pairs = [
                (f"{DEFAULT_BUILTIN_SKILLS_DIR}/{slug}/{rel}", data) for rel, data in entry.files
            ]
            await workspace.aupload_many(pairs)
            result.synced.append(slug)
        result.invalid_slugs = sorted(self._invalid)
        logger.info(
            "builtin skill sync: %d synced, %d skipped, %d invalid",
            len(result.synced),
            len(result.skipped),
            len(result.invalid_slugs),
        )
        return result

    # --- scanning ---

    def _scan(self) -> None:
        if not self._root.is_dir():
            logger.warning("builtin skill library root missing: %s", self._root)
            return
        for entry_dir in sorted(self._root.iterdir()):
            if not entry_dir.is_dir() or entry_dir.name.startswith(("__", ".")):
                continue
            slug = entry_dir.name
            reason = self._validate(entry_dir)
            if reason is not None:
                self._invalid[slug] = reason
                logger.warning("builtin skill %s skipped: %s", slug, reason)
                continue
            self._entries[slug] = self._load(entry_dir)
        logger.info("builtin skill catalog loaded: %d skills", len(self._entries))

    def _validate(self, entry_dir: Path) -> str | None:
        """Return a skip reason when the package is malformed, else ``None``."""
        manifest = entry_dir / SKILL_MANIFEST
        if not manifest.is_file():
            return f"missing {SKILL_MANIFEST}"
        try:
            text = manifest.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            return f"unreadable {SKILL_MANIFEST}: {exc}"
        meta, _body = parse_frontmatter(text)
        if not meta:
            return "missing or malformed frontmatter"
        name = meta.get("name")
        if not isinstance(name, str) or not name.strip():
            return "frontmatter name missing or empty"
        description = meta.get("description")
        if not isinstance(description, str) or not description.strip():
            return "frontmatter description missing or empty"
        metadata = meta.get("metadata")
        version = metadata.get("builtin_skill_version") if isinstance(metadata, dict) else None
        if not isinstance(version, str) or not version.strip():
            return "metadata.builtin_skill_version missing or empty"
        return None

    def _load(self, entry_dir: Path) -> BuiltinSkillEntry:
        slug = entry_dir.name
        skill_md = (entry_dir / SKILL_MANIFEST).read_text(encoding="utf-8")
        meta, body = parse_frontmatter(skill_md)
        files: list[tuple[str, bytes]] = []
        for fpath in sorted(entry_dir.rglob("*")):
            if not fpath.is_file():
                continue
            files.append((fpath.relative_to(entry_dir).as_posix(), _package_bytes(fpath)))
        metadata: Any = meta.get("metadata") or {}
        return BuiltinSkillEntry(
            slug=slug,
            name=str(meta.get("name") or slug),
            description=str(meta.get("description") or ""),
            version=str(metadata.get("builtin_skill_version") or ""),
            body=body,
            skill_md=skill_md,
            files=tuple(files),
        )


def default_library_root() -> Path:
    """Return the in-package library directory."""
    return Path(__file__).parent / "library"


_catalog: BuiltinSkillCatalog | None = None


def get_builtin_skill_catalog() -> BuiltinSkillCatalog:
    """Process-wide catalog singleton (package content is static at runtime)."""
    global _catalog
    if _catalog is None:
        _catalog = BuiltinSkillCatalog()
    return _catalog
