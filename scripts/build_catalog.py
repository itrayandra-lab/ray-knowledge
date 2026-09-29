"""Build and validate modular brand data for the static RAY Knowledge site."""

from pathlib import Path
import re
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ASSETS = ["data.js", "app.js", "styles.css", "collaborator-data.js", "inovasi-data.js"]
CATALOG_FILES = [ROOT / "_source" / "assets" / "data.js", ROOT / "public" / "assets" / "data.js"]


def remove_legacy_inovasi(path: Path) -> None:
    """Remove the old top-level INOVASI object from data.js, if it exists."""
    text = path.read_text(encoding="utf-8")
    marker = 'slug: "inovasi"'
    marker_at = text.find(marker)
    if marker_at < 0:
        return

    object_start = text.rfind("    {", 0, marker_at)
    if object_start < 0:
        raise RuntimeError(f"Cannot locate INOVASI object start in {path}")

    depth = 0
    in_string = False
    escaped = False
    object_end = None
    for index in range(object_start, len(text)):
        char = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                object_end = index + 1
                break

    if object_end is None:
        raise RuntimeError(f"Cannot locate INOVASI object end in {path}")
    suffix = text[object_end:]
    comma = re.match(r",?\s*", suffix)
    text = text[:object_start] + ("\n" if not text[:object_start].endswith("\n") else "") + suffix[comma.end():]
    path.write_text(text, encoding="utf-8")


def main() -> None:
    subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "update_catalog_from_markdown.py")],
        cwd=ROOT,
        check=True,
    )
    subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "migrate_to_webp.py")],
        cwd=ROOT,
        check=True,
    )
    for asset in SOURCE_ASSETS:
        source = ROOT / "_source" / "assets" / asset
        if not source.is_file():
            raise FileNotFoundError(source)
    for catalog in CATALOG_FILES:
        remove_legacy_inovasi(catalog)
    for asset in SOURCE_ASSETS:
        shutil.copyfile(
            ROOT / "_source" / "assets" / asset,
            ROOT / "public" / "assets" / asset,
        )
    shutil.copyfile(ROOT / "_source" / "index.html", ROOT / "public" / "index.html")
    subprocess.run(
        ["node", str(ROOT / "scripts" / "validate_catalog.js")],
        cwd=ROOT,
        check=True,
    )
    print("Catalog build complete: Markdown sources rebuilt, assets synced, and catalog validated.")


if __name__ == "__main__":
    main()
