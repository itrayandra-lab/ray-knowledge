"""Canonicalize brand, product, and collaborator asset references to WebP."""

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
TEXT_ROOTS = [ROOT / "public", ROOT / "_source"]
TEXT_SUFFIXES = {".js", ".css", ".html", ".json"}
SCOPED_ASSET = re.compile(
    r"((?:/)?assets/(?:brands|products|collaborators)/[^\"'\r\n]+?)\.(?:jpe?g|png)",
    re.IGNORECASE,
)

# Old collaborator filenames that were replaced by the canonical brand-named files.
RENAMED_COLLABORATORS = {
    "/assets/collaborators/mommylatory-yogi": "/assets/collaborators/MOMMYLATORY",
    "/assets/collaborators/baby-frecillia": "/assets/collaborators/BABY-LATORY",
    "/assets/collaborators/sam-frecillia": "/assets/collaborators/SAM SUN AND MOON",
    "/assets/collaborators/dermalink-novy": "/assets/collaborators/DERMALINK",
}
BARE_INOVASI_IMAGE = re.compile(
    r"((?:image|sourceImagePath):\s*[\"'][^\"'\r\n]+?)\.(?:jpe?g|png)",
    re.IGNORECASE,
)


def migrate_text(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    original = text
    for old, new in RENAMED_COLLABORATORS.items():
        text = re.sub(re.escape(old) + r"\.(?:jpe?g|png)", new + ".webp", text, flags=re.I)
    text = SCOPED_ASSET.sub(r"\1.webp", text)
    if path.name == "inovasi-data.js":
        text = BARE_INOVASI_IMAGE.sub(r"\1.webp", text)
    if text != original:
        path.write_text(text, encoding="utf-8")
        return 1
    return 0


def main() -> None:
    changed = 0
    for root in TEXT_ROOTS:
        for path in root.rglob("*"):
            if path.is_file() and path.suffix.lower() in TEXT_SUFFIXES:
                changed += migrate_text(path)
    print(f"WebP migration updated {changed} text files.")


if __name__ == "__main__":
    main()
