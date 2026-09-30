"""Rebuild the website catalog from the approved product roster and knowledge document.

The roster is authoritative for brand/product membership and naming. The extracted
knowledge file is authoritative for copy, benefits, active ingredients, and net
content. Missing optional data is omitted from the public UI instead of being
replaced with editorial placeholders.
"""

from __future__ import annotations

from collections import Counter, OrderedDict
from dataclasses import dataclass
from difflib import SequenceMatcher
import json
from pathlib import Path
import re
import unicodedata


ROOT = Path(__file__).resolve().parents[1]
ROSTER_PATH = ROOT / "list brand dan produk.md"
KNOWLEDGE_PATH = ROOT / "extracted- product knowledge.md"
ENHANCED_PATH = ROOT / "ai-enhanced-extracted-product-knowledge.md"
PRODUCT_ASSETS = ROOT / "public" / "assets" / "products"
SOURCE_ASSETS = ROOT / "_source" / "assets"

BRAND_SLUGS = {
    "PHYTOSYNC": "phytosync",
    "MOMMYLATORY": "mommylatory",
    "BABYLATORY": "baby-latory",
    "SAM Sun and Moon": "sam-sun-and-moon",
    "VOLUBILIS": "volubilis",
    "DERMOND": "dermond",
    "LUECIELLEDERM": "luecielliderm",
    "EGGSHELLENT": "eggshellent",
    "ANARA": "anara",
    "CORALYST": "coralyst",
    "UPGLOW": "upglow-dai",
    "DERMALINK": "dermalink",
    "ALPHA SHIELD": "alpha-shield",
    "AQUERA": "aquera",
    "SHELUNA": "sheluna",
    "BEAUTYLATORY": "beautylatory",
    "ADHWA": "adhwa",
    "BEAUTYNATURE": "beautynature",
    "BEAUTY SCAPE": "beautyscape",
    "INOVASI": "inovasi",
}

BRAND_IMAGES = {
    brand: (
        "/assets/brands/inovasi/cover.webp"
        if brand == "INOVASI"
        else f"/assets/brands/{slug}.webp"
    )
    for brand, slug in BRAND_SLUGS.items()
}

COLLABORATION_BRANDS = {
    "PHYTOSYNC", "MOMMYLATORY", "BABYLATORY", "SAM Sun and Moon",
    "VOLUBILIS", "DERMOND", "LUECIELLEDERM", "EGGSHELLENT", "ANARA",
    "CORALYST", "UPGLOW", "DERMALINK", "ALPHA SHIELD", "AQUERA",
}
INTERNAL_BRANDS = {"SHELUNA", "BEAUTYLATORY", "ADHWA", "BEAUTYNATURE"}

SOURCE_NAME_ALIASES = {
    ("BEAUTYLATORY", "Hyrdoglow Bi-Phase Serum Spray"):
        "Hydroglow Bi-Phase Serum Spray",
}

ASSET_ALIASES = {
    ("BEAUTYLATORY", "Lumibiome Radiance Duo"):
        "/assets/products/Lumibiome Radiance Duo (BEAUTYLATORY).webp",
    ("INOVASI", "Scalp Care Hair Tonic"):
        "/assets/products/Hair Tonic (INOVASI).webp",
    ("INOVASI", "Phyto PDRN Bubble Serum"):
        "/assets/brands/inovasi/cover.webp",
}

COLOR_BY_CATEGORY = {
    "kolaborasi": "#5579b7",
    "internal": "#9872a8",
    "beautyscape": "#b77f78",
    "inovasi": "#6c5ce7",
}

CATEGORY_OVERRIDES = {
    ("BABYLATORY", "First Touch Gentle Baby Cream"): "Baby Care / Moisturizer",
    ("BABYLATORY", "Tap to Toe Baby Smile Wash"): "Baby Care / Hair & Body Cleanser",
    ("SAM Sun and Moon", "Prebio Hydra Cream"): "Baby & Kids Care / Moisturizer",
    ("SAM Sun and Moon", "Sun Protection Mozziecare"): "Baby & Kids Care / Sun & Outdoor",
    ("BEAUTYLATORY", "Lumibiome Radiance Duo"): "Face Care / Dual System",
    ("UPGLOW", "Luminatech Dual System"): "Face Care / Dual System",
    ("CORALYST", "CORALYST Hair Infusion Serum"): "Hair Care / Serum",
    ("CORALYST", "Hair Root Enhancer Oil"): "Hair & Scalp Care / Oil",
    ("CORALYST", "Perfume Balm"): "Fragrance / Solid Perfume",
    ("DERMOND", "Reboot Cream"): "Intimate Care",
    ("MOMMYLATORY", "Cica Peptide Intensive Stretch Mark Cream"): "Body Care / Treatment Cream",
    ("MOMMYLATORY", "Silskin Renewal Cream"): "Body Care / Treatment Cream",
    ("ADHWA", "Serenity Massage Lotion"): "Body Care / Massage Lotion",
    ("ADHWA", "Serenity Nourishing Moist Balm"): "Body Care / Balm",
    ("ALPHA SHIELD", "Face Camouflage Green Mask"): "Tactical Face Camouflage",
    ("ALPHA SHIELD", "Face Camouflage Black Mask"): "Tactical Face Camouflage",
}

USAGE_OVERRIDES = {
    ("BEAUTYLATORY", "Lumibiome Radiance Duo"): [
        "Dapat dicampur (mix) saat penggunaan dengan rasio yang disesuaikan jenis kulit (Normal, Berminyak/Berjerawat, Kering/Dehidrasi, Kusam/Belang).",
        "Aplikasikan campuran secara merata pada kulit yang sudah dibersihkan, lalu lanjutkan dengan sunscreen pada pagi hari.",
    ],
    ("UPGLOW", "Luminatech Dual System"): [
        "Gunakan HydraBiome Serum dan GlowBiome Cream sesuai urutan serta takaran pada petunjuk kemasan.",
        "Aplikasikan pada kulit yang sudah dibersihkan; untuk pemakaian pagi, lanjutkan dengan sunscreen.",
    ],
    ("ALPHA SHIELD", "Face Camouflage Green Mask"): [
        "Aplikasikan tipis dan merata pada area wajah yang ingin dikamuflasekan.",
        "Bersihkan seluruh lapisan setelah aktivitas selesai dan hentikan penggunaan bila kulit terasa tidak nyaman.",
    ],
    ("ALPHA SHIELD", "Face Camouflage Black Mask"): [
        "Aplikasikan tipis dan merata pada area wajah yang ingin dikamuflasekan.",
        "Bersihkan seluruh lapisan setelah aktivitas selesai dan hentikan penggunaan bila kulit terasa tidak nyaman.",
    ],
    ("ALPHA SHIELD", "Tactical Paper Soap"): [
        "Ambil satu lembar dengan tangan kering, basahi dengan air, lalu gosok hingga berbusa.",
        "Gunakan untuk membersihkan tangan atau kulit, kemudian bilas hingga bersih.",
    ],
    ("CORALYST", "Perfume Balm"): [
        "Ambil sedikit balm dengan jari yang bersih, lalu aplikasikan tipis pada titik nadi seperti pergelangan tangan atau leher.",
        "Ulangi sesuai kebutuhan dan hindari penggunaan pada kulit yang sedang iritasi.",
    ],
}


@dataclass
class SourceProduct:
    brand: str
    name: str
    fields: dict[str, list[str]]


def clean(value: str) -> str:
    value = unicodedata.normalize("NFC", value.replace("\u00a0", " "))
    value = value.replace("*", "").replace("_", "").replace("`", "")
    value = re.sub(r"\s+", " ", value).strip()
    value = re.sub(r"\s+([,.;:!?])", r"\1", value)
    value = value.replace("Cofident", "Confident").replace("mengontol", "mengontrol").replace("hidarasi", "hidrasi")
    value = value.replace("Citus Junos", "Citrus Junos").replace("focus pada", "fokus pada").replace("kulit sensitive", "kulit sensitif")
    value = value.replace("Conmort", "Comfort").replace("terawatt", "terawat").replace("menghidras,", "menghidrasi,")
    value = value.replace("pelembab", "pelembap").replace("tissue", "tisu").replace("kulit rambut bayi", "kulit dan rambut bayi")
    value = value.replace("Convinient", "Convenient").replace("PDRD Ginseng", "PDRN Ginseng")
    value = value.replace("Aloevera", "Aloe Vera").replace("microbioma", "mikrobioma").replace("antioksida,", "antioksidan,")
    value = value.replace("mendukung Kesehatan", "mendukung kesehatan")
    value = value.replace("Formulation Development Direction", "Arah Pengembangan Formula")
    value = value.replace("sesuai keterangan slide", "sesuai konsep produk").replace("sesuai deskripsi slide", "sesuai konsep produk")
    value = value.replace("sesuai karakter comforting pada slide", "sesuai karakter comforting produk")
    value = value.replace("sesuai deskripsi pada slide", "sesuai konsep produk")
    value = value.replace(" sebagai hero active pada product knowledge slide", " sebagai hero active")
    value = value.replace("Menggunakan PDRN Ginseng pada product knowledge", "Menggunakan PDRN Ginseng sebagai hero active")
    value = value.replace(
        "Pada tabel benchmark collection, produk ini tercantum dengan hero active Oliconew 0.5% dan PDRN Ginseng.",
        "",
    )
    value = value.replace("Materi mencantumkan hasil uji klinis penggunaan", "Data uji klinis penggunaan")
    value = value.replace("Dalam materi, penggunaan", "Berdasarkan data bahan, penggunaan")
    value = value.replace("yang dalam materi dijelaskan berasal dari", "yang terdiri dari")
    value = value.replace("berdasarkan pengujian yang dicantumkan", "berdasarkan data pengujian yang tersedia")
    value = value.replace("Materi mencantumkan bahwa zat aktif masih dalam revisi", "Formulasi bahan aktif masih dalam proses revisi")
    source_phrases = (
        " sebagaimana tercantum pada sumber",
        " sebagaimana disebutkan dalam sumber",
        " sebagaimana dijelaskan pada sumber",
        " sebagaimana dijelaskan dalam sumber",
        " sebagaimana tertulis pada sumber",
        " sebagaimana daftar warna sumber",
        " sebagaimana positioning yang tertulis dalam sumber",
        " dijelaskan dalam sumber",
        " dalam sumber",
        " sesuai deskripsi sumber",
        " sesuai petunjuk sumber",
        " sesuai karakter produk dalam sumber",
        " sesuai konsep yang tercantum dalam sumber",
        " sesuai konsep produk pada sumber",
        " sesuai nama produk pada sumber",
        " yang tercantum dalam sumber",
        " yang dicantumkan pada sumber",
        " yang disebutkan dalam sumber",
        " dalam deskripsi sumber",
        " pada sumber",
    )
    for phrase in source_phrases:
        value = value.replace(phrase, "")
    value = value.replace("sesuai konsep brightening formula", "dalam konsep brightening formula")
    value = value.replace("sesuai keterangan dalam materi produk", "sesuai konsep produk")
    value = value.replace("tercantum pada materi produk", "menjadi bagian dari konsep produk")
    value = value.replace("menurut materi masing-masing", "sesuai fungsi masing-masing")
    value = value.replace("dalam materi produk", "dalam konsep produk")
    value = value.replace("Materi awal menempatkan", "Konsep awal menempatkan")
    value = value.replace("Materi awal membahas", "Konsep awal membahas")
    value = value.replace("hingga 24 jam", "sepanjang hari")
    value = value.replace("dalam 14 hari pemakaian teratur", "melalui pemakaian teratur")
    value = value.replace("Meningkatkan kecerahan kulit melalui pemakaian teratur", "Membantu meningkatkan kecerahan kulit melalui pemakaian teratur")
    # Keep public product knowledge factual and cosmetic in tone. The enhanced
    # manuscript also contains internal claim-review notes; these rewrites keep
    # the grounded benefit while avoiding unsupported medical/safety promises.
    public_claim_replacements = (
        (" (Pregnancy & Nursing-Safe Skincare)", ""),
        (" dengan menggunakan bahan-bahan yang aman", ""),
        ("membersihkan kulit dengan aman", "membersihkan kulit dengan lembut"),
        ("Anti Melasma", "Perawatan Tampilan Noda"),
        ("anti melasma", "perawatan tampilan noda"),
        ("Menyembuhkan luka jerawat", "Mendukung pemulihan kondisi kulit berjerawat"),
        ("menyembuhkan luka jerawat", "mendukung pemulihan kondisi kulit berjerawat"),
        ("Membantu penyembuhan kulit lebih cepat", "Mendukung pemulihan kondisi kulit"),
        ("membantu penyembuhan kulit lebih cepat", "mendukung pemulihan kondisi kulit"),
        ("Mempercepat penyembuhan kulit iritasi", "Mendukung pemulihan kondisi kulit yang teriritasi"),
        ("mempercepat penyembuhan kulit iritasi", "mendukung pemulihan kondisi kulit yang teriritasi"),
        ("mempercepat penyembuhan", "mendukung pemulihan kondisi kulit"),
        ("mendukung penyembuhan", "mendukung pemulihan kondisi kulit"),
        ("Penyembuhan & iritasi", "Membantu menenangkan dan merawat kulit yang teriritasi"),
        ("penyembuhan & iritasi", "membantu menenangkan dan merawat kulit yang teriritasi"),
        ("Anti-inflamasi alami", "Membantu menenangkan kulit"),
        ("anti-inflamasi alami", "membantu menenangkan kulit"),
        ("anti inflamasi alami", "membantu menenangkan kulit"),
        ("antiinflamasi", "efek menenangkan"),
        ("anti-inflamasi", "efek menenangkan"),
        ("Mengontrol inflamasi", "Membantu menenangkan kemerahan"),
        ("mengontrol inflamasi", "membantu menenangkan kemerahan"),
        ("mengurangi inflamasi", "membantu menenangkan kemerahan"),
        ("Antibakteri kuat untuk melawan penyebab jerawat", "Membantu merawat kulit rentan berjerawat"),
        ("antibakteri kuat untuk melawan penyebab jerawat", "membantu merawat kulit rentan berjerawat"),
        ("membantu melawan bakteri dan jamur penyebab infeksi serta bau tak sedap", "membantu menjaga keseimbangan mikroflora dan kesegaran area intim"),
        ("Melindungi kulit dari kerusakan akibat blue light dan polusi", "Membantu menjaga kondisi kulit dari dampak paparan blue light dan polusi"),
        ("melindungi kulit dari kerusakan akibat blue light dan polusi", "membantu menjaga kondisi kulit dari dampak paparan blue light dan polusi"),
        ("Melindungi kulit dari kerusakan akibat polusi udara dan cahaya gadget", "Membantu menjaga kondisi kulit dari dampak polusi udara dan cahaya gadget"),
        ("melindungi kulit dari kerusakan akibat polusi udara dan cahaya gadget", "membantu menjaga kondisi kulit dari dampak polusi udara dan cahaya gadget"),
        ("Mencegah penuaan dini", "Membantu menjaga tampilan kulit"),
        ("mencegah penuaan dini", "membantu menjaga tampilan kulit"),
        ("aman untuk kehamilan", "mendukung perawatan kulit selama kehamilan"),
        ("membantu mengatasi masalah jerawat", "membantu merawat kulit rentan berjerawat"),
        ("mengatasi masalah jerawat", "merawat kulit rentan berjerawat"),
        ("sesuai konsep yang tercantum", "melalui pendekatan formula"),
        ("yang tercantum, melengkapi", "yang melengkapi"),
        ("merupakan karakter formula yang tercantum", "merupakan karakter formula"),
        ("secara eksplisit dijelaskan sebagai", "merupakan"),
        ("memberikan efek relaksasi dan melegakan pernapasan melalui aroma esensial", "menghadirkan sensasi relaksasi melalui aroma esensial"),
        ("Memberikan efek relaksasi dan melegakan pernapasan melalui aroma esensial", "Menghadirkan sensasi relaksasi melalui aroma esensial"),
        ("Memberikan perlindungan tambahan dari kerusakan akibat UV melalui antioksidan", "Memberikan dukungan antioksidan bagi kulit yang terpapar sinar matahari"),
        ("Melindungi dari kerusakan akibat UV dan radikal bebas", "Memberikan dukungan antioksidan bagi kulit yang terpapar sinar matahari"),
        ("Membantu memperlambat proses penuaan dini, membantu merawat kulit rentan berjerawat, sunburns, ruam, dan mencerahkan kulit", "Membantu menjaga tampilan kulit, merawat kulit rentan berjerawat, menenangkan kulit setelah paparan matahari, dan mendukung tampilan kulit yang lebih cerah"),
        ("sesuai kebutuhan sesuai kebutuhan", "sesuai kebutuhan"),
        ("Aman digunakan untuk berbagai jenis kulit.", ""),
        ("guna mengatasi masalah kulit kering", "untuk membantu merawat kulit kering"),
        ("Mengatasi Kulit Kering karena Hormon Kehamilan", "Membantu Merawat Kulit Kering selama Kehamilan"),
        ("Rambut Kuat, Bebas Rontok", "Membantu Menjaga Kekuatan Rambut"),
        ("agar bebas dari kerontokan", "untuk membantu menjaga kekuatan rambut"),
        ("tanpa merusak lapisan enamel", "sambil membantu merawat enamel"),
        ("tanpa merusak enamel", "sambil membantu merawat enamel"),
        ("tanpa menimbulkan sensasi ngilu", "dengan perhatian pada kenyamanan gigi"),
        ("secara cepat, praktis, dan aman", "secara praktis"),
        ("menetralisir nuansa kuning pada gigi secara instan", "membantu menyamarkan nuansa kuning pada gigi secara visual"),
        ("Instant Bright Smile sejak penggunaan pertama", "efek visual gigi yang tampak lebih cerah saat digunakan"),
        ("Instant Bright Smile yang memberikan efek visual gigi tampak lebih putih dan bersih sejak penggunaan pertama", "Efek visual gigi yang tampak lebih cerah dan bersih saat digunakan"),
        ("Membantu memberikan efek bright smile secara instan", "Membantu memberikan efek visual gigi yang tampak lebih cerah"),
        ("mencegah bau mulut", "membantu menjaga kesegaran napas"),
        ("melindungi dari risiko gigi berlubang dan masalah gusi", "membantu merawat enamel dan gusi"),
        ("melindungi dari bakteri penyebab masalah gusi", "mendukung kebersihan dan perawatan gusi"),
        ("tanpa iritasi", "dengan pendekatan yang lembut"),
        ("sepanjang hari", "selama beraktivitas"),
        (", Nourish, Protect, Comfort", ""),
        (", Gentle Moisture, Skin Comfort", ""),
        (", Care, Repair, Elasticity", ""),
        (",Renew, Repair, Restore", "."),
        (", pH 4, Flora Balance, Freshness", ""),
    )
    for old, new in public_claim_replacements:
        value = value.replace(old, new)
    value = value.replace("Mendukung konsep perlindungan blue light yang tercantum", "Mendukung konsep perlindungan terhadap blue light")
    value = value.replace("berfokus pada kekuatan rambut untuk membantu menjaga kekuatan rambut", "berfokus membantu menjaga kekuatan rambut")
    value = re.sub(r"\b([A-Za-zÀ-ÿ]{3,})\s+\1\b", r"\1", value, flags=re.I)
    value = re.sub(r"\byg\b", "yang", value, flags=re.I)
    value = re.sub(r"\.{2,}", ".", value)
    value = re.sub(r"\.\s+\.", ".", value)
    return value


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


def natural_join(items: list[str]) -> str:
    values = [item.strip() for item in items if item.strip()]
    if len(values) < 2:
        return "".join(values)
    if len(values) == 2:
        return " dan ".join(values)
    return ", ".join(values[:-1]) + ", dan " + values[-1]


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", value.casefold()))


def parse_roster() -> OrderedDict[str, list[str]]:
    roster: OrderedDict[str, list[str]] = OrderedDict()
    for line in ROSTER_PATH.read_text(encoding="utf-8").splitlines():
        if not line.startswith("|") or "---" in line or "| BRAND" in line:
            continue
        cells = [clean(cell) for cell in line.strip("|").split("|")]
        if len(cells) < 2 or not cells[0] or not cells[1]:
            continue
        roster.setdefault(cells[0], []).append(cells[1])
    if len(roster) != 20 or sum(map(len, roster.values())) != 118:
        raise ValueError("Official roster must contain exactly 20 brands and 118 products")
    if set(roster) != set(BRAND_SLUGS):
        raise ValueError(f"Brand mapping is stale: {set(roster) ^ set(BRAND_SLUGS)}")
    return roster


def heading_name(line: str) -> str:
    value = re.sub(r"^####\s+\d+\.\s+", "", line).strip()
    return clean(re.sub(r"\s*\([^)]*\)\)*\s*$", "", value))


def parse_product_fields(lines: list[str]) -> dict[str, list[str]]:
    fields = {key: [] for key in ("netto", "detail", "unique", "benefits", "ingredients")}
    state = None
    for raw in lines:
        line = raw.strip()
        low = line.casefold()
        if re.match(r"^######\s*netto", low):
            state = "netto"
            continue
        if re.match(r"^######\s*detail produk", low):
            state = "detail"
            continue
        if re.match(r"^######\s*unique value", low):
            state = "unique"
            continue
        if re.match(r"^######\s*key benefits", low):
            state = "benefits"
            continue
        if re.match(r"^#####\s*b\.\s*bahan aktif", low):
            state = "ingredients"
            continue
        if line.startswith("#"):
            if line.startswith("#####"):
                state = None
            continue
        if state is not None and line:
            fields[state].append(line)
    return fields


def parse_source() -> tuple[dict[str, str], dict[str, list[str]], dict[tuple[str, str], SourceProduct]]:
    lines = KNOWLEDGE_PATH.read_text(encoding="utf-8").splitlines()
    brand_overviews: dict[str, str] = {}
    collaborators: dict[str, list[str]] = {}
    products: dict[tuple[str, str], SourceProduct] = {}

    brand_positions: list[tuple[int, str]] = []
    for index, line in enumerate(lines):
        if re.match(r"^##\s+", line):
            brand_positions.append((index, clean(re.sub(r"^##\s+", "", line))))

    for brand_index, (start, brand) in enumerate(brand_positions):
        end = brand_positions[brand_index + 1][0] if brand_index + 1 < len(brand_positions) else len(lines)
        section = lines[start + 1:end]

        overview_start = next(
            (i for i, line in enumerate(section) if re.match(r"^###\s*A\.brand overview", line, re.I)),
            None,
        )
        if overview_start is not None:
            overview_end = next(
                (i for i in range(overview_start + 1, len(section)) if re.match(r"^###\s+", section[i])),
                len(section),
            )
            brand_overviews[brand] = source_prose(section[overview_start + 1:overview_end])
        else:
            brand_overviews[brand] = ""

        collaborator_start = next(
            (i for i, line in enumerate(section) if re.match(r"^###\s*B\.kolaborator", line, re.I)),
            None,
        )
        collaborators[brand] = []
        if collaborator_start is not None:
            collaborator_end = next(
                (i for i in range(collaborator_start + 1, len(section)) if re.match(r"^###\s+", section[i])),
                len(section),
            )
            collaborators[brand] = bullet_items(section[collaborator_start + 1:collaborator_end])

        product_positions = [
            i for i, line in enumerate(section) if re.match(r"^####\s+\d+\.\s+", line)
        ]
        for product_index, position in enumerate(product_positions):
            product_end = (
                product_positions[product_index + 1]
                if product_index + 1 < len(product_positions)
                else len(section)
            )
            name = heading_name(section[position])
            key = (normalize(brand), normalize(name))
            products[key] = SourceProduct(brand, name, parse_product_fields(section[position + 1:product_end]))

    return brand_overviews, collaborators, products


def parse_enhanced_product_fields(lines: list[str]) -> dict[str, list[str]]:
    """Read only publishable core fields and ignore sales/editorial scaffolding."""
    fields = {key: [] for key in ("netto", "detail", "unique", "benefits", "ingredients")}
    state = None
    for raw in lines:
        line = raw.strip()
        low = line.casefold()
        if re.match(r"^######\s*netto", low):
            state = "netto"
            continue
        if re.match(r"^######\s*detail produk", low):
            state = "detail"
            continue
        if re.match(r"^######\s*unique value", low):
            state = "unique"
            continue
        if re.match(r"^######\s*key benefits", low):
            state = "benefits"
            continue
        if re.match(r"^#####\s*b\.\s*bahan aktif", low):
            state = "ingredients"
            continue
        if re.match(r"^#####\s*c\.\s*panduan sales", low):
            state = None
            continue
        if re.match(
            r"^\*\*(?:penjelasan lengkap untuk sales|pembeda yang perlu ditekankan oleh sales|"
            r"penjabaran manfaat untuk kebutuhan konsultasi sales|kaitan formula dan manfaat)\*\*",
            low,
        ):
            state = None
            continue
        if line.startswith("#"):
            state = None
            continue
        if line.startswith("<!--") or "INTERNAL" in line:
            continue
        if state is not None and line:
            fields[state].append(line)
    return fields


def parse_enhanced_source() -> tuple[
    dict[str, str],
    dict[str, list[dict[str, str]]],
    dict[tuple[str, str], SourceProduct],
]:
    lines = ENHANCED_PATH.read_text(encoding="utf-8").splitlines()
    brand_lookup = {normalize(brand): brand for brand in BRAND_SLUGS}
    positions: list[tuple[int, str]] = []
    for index, line in enumerate(lines):
        match = re.match(r"^##\s+(.+)$", line)
        if match and normalize(clean(match.group(1))) in brand_lookup:
            brand = brand_lookup[normalize(clean(match.group(1)))]
            positions.append((index, brand))

    overviews: dict[str, str] = {}
    faqs: dict[str, list[dict[str, str]]] = {}
    products: dict[tuple[str, str], SourceProduct] = {}
    for brand_index, (start, brand) in enumerate(positions):
        end = positions[brand_index + 1][0] if brand_index + 1 < len(positions) else len(lines)
        section = lines[start + 1:end]
        overview_start = next(
            (i for i, line in enumerate(section) if re.match(r"^###\s*A\.\s*Brand overview", line, re.I)),
            None,
        )
        if overview_start is not None:
            overview_end = next(
                (i for i in range(overview_start + 1, len(section)) if re.match(r"^####\s*Positioning brand", section[i], re.I)),
                len(section),
            )
            overviews[brand] = source_prose(section[overview_start + 1:overview_end])
        else:
            overviews[brand] = ""

        product_positions = [
            i for i, line in enumerate(section) if re.match(r"^####\s+\d+\.\s+", line)
        ]
        faq_start = next(
            (i for i, line in enumerate(section) if re.match(r"^###\s*D\.\s*FAQ brand", line, re.I)),
            len(section),
        )
        for product_index, position in enumerate(product_positions):
            if position >= faq_start:
                continue
            product_end = min(
                product_positions[product_index + 1] if product_index + 1 < len(product_positions) else len(section),
                faq_start,
            )
            name = heading_name(section[position])
            products[(normalize(brand), normalize(name))] = SourceProduct(
                brand,
                name,
                parse_enhanced_product_fields(section[position + 1:product_end]),
            )

        faqs[brand] = []
        if faq_start < len(section):
            faq_lines = section[faq_start + 1:]
            question_positions = [
                i for i, line in enumerate(faq_lines) if re.match(r"^####\s+\d+\.\s+", line)
            ]
            for question_index, position in enumerate(question_positions):
                question_end = (
                    question_positions[question_index + 1]
                    if question_index + 1 < len(question_positions)
                    else len(faq_lines)
                )
                question = clean(re.sub(r"^####\s+\d+\.\s+", "", faq_lines[position]))
                answer = source_prose(faq_lines[position + 1:question_end])
                if question and answer:
                    faqs[brand].append({"question": question, "answer": answer})

    if len(overviews) != 20 or len(products) != 118:
        raise ValueError(
            f"Enhanced knowledge must contain 20 brands and 118 products; found {len(overviews)} and {len(products)}"
        )
    return overviews, faqs, products


def bullet_items(lines: list[str]) -> list[str]:
    expanded: list[str] = []
    for line in lines:
        # Some extracted rows contain several bullet symbols without line breaks.
        expanded.extend(re.sub(r"(?<!^)\s*[•●▪]\s*", "\n• ", line).splitlines())
    items: list[str] = []
    for raw in expanded:
        raw_line = raw.strip()
        match = re.match(r"^(?:(?:[-*]|\d+[.)])\s+|[•●▪◦]\s*)(.+)$", raw_line)
        line = clean(match.group(1) if match else raw_line)
        if not line or re.fullmatch(r"(?:active ingredients?|ingredients?)\s*:?", line, re.I):
            continue
        if match:
            items.append(line)
        elif items and not re.search(r"[.!?;:]$", items[-1]):
            items[-1] = clean(items[-1] + " " + line)
        else:
            items.append(line)
    return list(dict.fromkeys(item for item in items if item))


def source_prose(lines: list[str]) -> str:
    paragraphs: list[str] = []
    current: list[str] = []
    for raw in lines:
        raw_line = re.sub(r"^#{1,6}\s*", "", raw).strip()
        bullet = re.match(r"^(?:(?:[-*]|\d+[.)])\s+|[•●▪◦]\s*)(.+)$", raw_line)
        line = clean(bullet.group(1) if bullet else raw_line)
        if not line:
            if current:
                paragraphs.append(" ".join(current))
                current = []
            continue
        if bullet:
            if current:
                paragraphs.append(" ".join(current))
                current = []
            paragraphs.append(f"• {line}")
        else:
            current.append(line)
    if current:
        paragraphs.append(" ".join(current))
    return "\n\n".join(paragraphs)


def field_prose(lines: list[str]) -> str:
    items = [item.rstrip(" .;") for item in bullet_items(lines)]
    if not items:
        return ""
    text = "; ".join(items).rstrip(";")
    return text if re.search(r"[.!?][\"'”’)]*$", text) else text.rstrip(".") + "."


def detail_prose(lines: list[str]) -> str:
    """Format source detail as readable paragraphs without flattening it into semicolons."""
    values: list[str] = []
    for raw in lines:
        raw_line = raw.strip()
        match = re.match(r"^(?:(?:[-*]|\d+[.)])\s+|[•●▪◦]\s*)(.+)$", raw_line)
        line = clean(match.group(1) if match else raw_line)
        if line:
            values.append(line)

    paragraphs: list[str] = []
    index = 0
    while index < len(values):
        line = values[index]
        alpha_heading = re.match(r"^[a-z]\.\s*(.+)$", line, re.I)
        if alpha_heading:
            heading = alpha_heading.group(1).rstrip(" :.;")
            if index + 1 < len(values):
                body = values[index + 1]
                body = re.sub(
                    r"^([^,]{3,60}),\s+(?=(?:Serum|Cream|Krim|Produk|Pembersih|Sunscreen)\b)",
                    r"\1. ",
                    body,
                    flags=re.I,
                )
                paragraphs.append(f"{heading} — {body.rstrip('.')}.")
                index += 2
                continue
            paragraphs.append(heading + ".")
            index += 1
            continue

        is_short_heading = (
            len(line) <= 70
            and not re.search(r"[.!?;:]$", line)
            and index + 1 < len(values)
            and not re.match(r"^[a-z]\.\s+", values[index + 1], re.I)
        )
        if is_short_heading:
            next_line = values[index + 1]
            if re.search(r"^(?:Mineral-First|Minimal Chemical|Tinted Mineral|Skin Care Integration)\b", next_line, re.I):
                paragraphs.append(line.rstrip(" .") + ":")
                index += 1
                continue
            paragraphs.append(f"{line.rstrip(' .')} — {next_line.rstrip('.')}.")
            index += 2
            continue

        paragraphs.append(line if re.search(r"[.!?][\"'”’)]*$", line) else line + ".")
        index += 1
    return "\n\n".join(dict.fromkeys(paragraphs))


def parse_benefits(lines: list[str]) -> list[str]:
    values: list[str] = []
    compact_terms: list[str] = []
    component = ""
    for raw in lines:
        raw_line = raw.strip()
        match = re.match(r"^(?:(?:[-*]|\d+[.)])\s+|[•●▪◦]\s*)(.+)$", raw_line)
        line = clean(match.group(1) if match else raw_line).strip(" .;")
        if not line:
            continue
        component_match = re.match(r"^[a-z]\.\s*(.+)$", line, re.I)
        if component_match:
            component = component_match.group(1).rstrip(" :.;")
            continue
        terms = [part.strip(" .;") for part in re.split(r"\s*,\s*|\s*\.\s+", line) if part.strip(" .;")]
        is_compact_list = 2 <= len(terms) <= 5 and all(len(term.split()) <= 4 for term in terms)
        if component and is_compact_list:
            values.append(f"{component}: {', '.join(terms)}")
            component = ""
        elif is_compact_list:
            compact_terms.extend(terms)
        else:
            values.append(f"{component}: {line}" if component else line)
            component = ""
    selected = values if len(values) >= 2 else [*compact_terms, *values]
    return list(dict.fromkeys(selected))


def parse_ingredients(lines: list[str]) -> tuple[list[str], list[dict[str, str]]]:
    names: list[str] = []
    details: list[dict[str, str]] = []
    for item in bullet_items(lines):
        if item.rstrip().endswith(":") or re.match(r"^[a-z]\.\s+", item, re.I):
            continue
        parts = re.split(r"\s*[–—]\s*|\s+-\s+|:\s+", item, maxsplit=1)
        name = clean(parts[0]).rstrip(".,;:")
        description = clean(parts[1]).rstrip(".") + "." if len(parts) > 1 else ""
        if description:
            description = description[:1].upper() + description[1:]
        if not name or name.casefold() in {"active ingredients", "ingredients"}:
            continue
        concentration = ""
        concentration_match = re.search(r"\b(\d+(?:[.,]\d+)?\s*(?:-|–|to)?\s*\d*(?:[.,]\d+)?\s*%)", name, re.I)
        if concentration_match:
            concentration = clean(concentration_match.group(1)).replace("  ", " ")
        if normalize(name) in {normalize(existing) for existing in names}:
            continue
        names.append(name)
        details.append({
            "name": name,
            "description": description,
            "concentration": concentration,
            "function": "",
        })
    return names, details


def product_category(brand: str, name: str, detail: str) -> str:
    if (brand, name) in CATEGORY_OVERRIDES:
        return CATEGORY_OVERRIDES[(brand, name)]
    rules = [
        (("setting balm",), "Makeup / Complexion"),
        (("perfume balm",), "Fragrance"),
        (("toothpaste",), "Oral Care / Toothpaste"),
        (("diffuser",), "Home Wellness / Diffuser"),
        (("room spray",), "Home Wellness / Room Spray"),
        (("aromatheraphy", "aromatherapy"), "Home Wellness / Aromatherapy"),
        (("paper soap",), "Personal Care / Paper Soap"),
        (("hand soap",), "Hand Care / Cleanser"),
        (("semprot tangan",), "Hand Care / Spray"),
        (("intimate",), "Intimate Care"),
        (("shampoo",), "Hair Care / Shampoo"),
        (("conditioner",), "Hair Care / Conditioner"),
        (("hair tonic", "scalp care"), "Hair & Scalp Care"),
        (("hair",), "Hair Care"),
        (("sunscreen", "sun protection", "uv defense", "uv radiation"), "Sun Care"),
        (("facial wash", "face wash"), "Face Care / Facial Cleanser"),
        (("cleanser", "cleansing"), "Face Care / Cleanser"),
        (("toner",), "Face Care / Toner"),
        (("face mist", "facial mist"), "Face Care / Face Mist"),
        (("serum spray",), "Face Care / Serum Spray"),
        (("body serum",), "Body Care / Serum"),
        (("miracle oil", "face & body treatment oil"), "Face & Body Care / Oil"),
        (("hair infusion serum",), "Hair Care / Serum"),
        (("serum",), "Face Care / Serum"),
        (("lipbalm", "lip balm", "lips color"), "Lip Care"),
        (("body wash", "shower gel"), "Body Care / Cleanser"),
        (("body lotion", "massage lotion"), "Body Care / Lotion"),
        (("body scrub",), "Body Care / Scrub"),
        (("deodorant", "deo spray"), "Body Care / Deodorant"),
        (("mask",), "Face Care / Mask"),
        (("massage cream",), "Body Care / Massage Cream"),
        (("cream", "moisturizer", "moist balm"), "Skin Care / Moisturizer"),
        (("gel",), "Skin Care / Gel"),
        (("balm",), "Skin Care / Balm"),
        (("pad",), "Face Care / Treatment Pad"),
    ]
    for text in (name.casefold(), f"{name} {detail}".casefold()):
        for keywords, category in rules:
            if any(keyword in text for keyword in keywords):
                return category
    return "Personal Care"


def first_sentence(value: str, limit: int = 280) -> str:
    sentence = re.split(r"(?<=[.!?])\s+", value.strip(), maxsplit=1)[0] if value else ""
    if len(sentence) <= limit:
        return sentence
    clipped = sentence[:limit].rsplit(" ", 1)[0]
    return clipped.rstrip(" ,;:") + "…"


def normalize_netto(value: str) -> str:
    value = clean(value).rstrip(".")
    value = re.sub(r"\b(\d+(?:[.,]\d+)?)\s*m[lL]\b", r"\1 ml", value)
    value = re.sub(r"\b(\d+(?:[.,]\d+)?)\s*[gG]\b", r"\1 g", value)
    value = re.sub(r"\b(\d+(?:[.,]\d+)?)\s*gram\b", r"\1 g", value, flags=re.I)
    value = re.sub(r"\b(\d+(?:[.,]\d+)?)\s*millilit(?:er|re)\b", r"\1 ml", value, flags=re.I)
    return value


def documented_usage(detail: str) -> list[str]:
    if not detail:
        return []
    sentences = re.split(r"(?<=[.!?])\s+", detail)
    pattern = re.compile(
        r"^(?:cara (?:pakai|penggunaan)|gunakan\b|aplikasikan\b|oleskan\b|semprotkan\b|"
        r"basahi\b|tuangkan\b|usapkan\b|bilas\b|diamkan\b|ratakan\b|kocok\b|dikocok\b|"
        r"(?:pemakaian|penggunaan)\s+dilakukan\b|"
        r"(?:produk|pemakaian|penggunaan|essence|serum|krim|cream|toner|sunscreen|stick|balm|pad|spray)\s+"
        r"(?:dapat\s+)?(?:digunakan|diaplikasikan|dioleskan|disemprotkan|dikocok)\b|"
        r"digunakan\s+(?:setelah|pagi|malam|setiap)|dapat dicampur\b)",
        re.I,
    )
    found = [sentence.strip() for sentence in sentences if pattern.search(sentence.strip())]
    return found


def extract_detail_and_usage(lines: list[str]) -> tuple[str, list[str]]:
    description_lines: list[str] = []
    section_usage: list[str] = []
    in_usage = False
    prefix_form = False
    for raw in lines:
        line = clean(raw)
        if re.fullmatch(r"(?:how to use|cara pakai)\s*:?", line, re.I):
            in_usage = True
            continue
        if in_usage and re.fullmatch(r"bentuk\s*:?", line, re.I):
            in_usage = False
            prefix_form = True
            continue
        if in_usage:
            section_usage.extend(bullet_items([raw]))
        else:
            description_lines.append(f"Bentuk produk: {line}" if prefix_form else raw)
            prefix_form = False

    description = detail_prose(description_lines)
    inline_usage = documented_usage(description)
    if inline_usage:
        usage_keys = {normalize(item) for item in inline_usage}
        kept_paragraphs = []
        for paragraph in description.split("\n\n"):
            sentences = re.split(r"(?<=[.!?])\s+", paragraph)
            kept = [
                sentence.strip() for sentence in sentences
                if sentence.strip() and normalize(sentence) not in usage_keys
            ]
            if kept:
                kept_paragraphs.append(" ".join(kept))
        description = "\n\n".join(kept_paragraphs)
    usage = list(dict.fromkeys([*section_usage, *inline_usage]))
    return description.strip(), usage


def publishable_field_lines(lines: list[str]) -> list[str]:
    blocked = (
        "belum tersedia",
        "belum tercantum",
        "belum disertakan",
        "tidak dicantumkan",
        "laporan uji",
        "dokumen pendukung",
        "catatan pemeriksaan",
        "perlu dikonfirmasi",
        "perlu diverifikasi",
        "masih dalam revisi",
        "masih dalam proses revisi",
        "krim berbahaya",
    )
    selected = []
    for raw in lines:
        text = clean(raw)
        low = text.casefold()
        if any(term in low for term in blocked):
            continue
        if re.search(r"(?:lebih dari|hingga)\s*\d+(?:[.,]\d+)?\s*%|\b24h\b|\bdalam\s+\d+\s+hari\b", low):
            continue
        selected.append(raw)
    return selected


def publishable_product_description(value: str) -> str:
    value = re.sub(
        r"PreBIULIN FOS disebut membantu menurunkan.+?berdasarkan data pengujian yang tersedia\.",
        "",
        value,
        flags=re.I,
    )
    value = value.replace(" dalam 28 hari", "").replace(" selama 28 hari", "")
    paragraphs = []
    for paragraph in value.split("\n\n"):
        kept = []
        for sentence in re.split(r"(?<=[.!?])\s+", paragraph):
            low = sentence.casefold()
            percent_count = sentence.count("%")
            quantified_outcome = bool(
                re.search(r"(?:lebih dari|hingga|sebesar)\s*\d+(?:[.,]\d+)?\s*%", low)
            )
            if percent_count >= 2 and (
                "data uji" in low
                or "pengujian" in low
                or quantified_outcome
                or "disebut dapat" in low
            ):
                continue
            if any(term in low for term in (
                "menyeimbangkan hormon",
                "melegakan pernapasan",
                "bebas dari kerontokan",
                "zat aktif masih dalam proses revisi",
                "formulasi bahan aktif masih dalam proses revisi",
            )):
                continue
            kept.append(sentence.strip())
        if kept:
            paragraphs.append(" ".join(kept))
    return "\n\n".join(paragraphs).strip()


def public_product_description(brand: str, name: str, value: str) -> str:
    description = publishable_product_description(value)
    if brand == "ALPHA SHIELD" and name in ("Face Camouflage Green Mask", "Face Camouflage Black Mask"):
        variant = "hijau" if "Green" in name else "hitam"
        description = description.replace("berwarna hijau/hitam", f"berwarna {variant}")
    if brand == "INOVASI":
        description = " ".join(
            sentence.strip()
            for sentence in re.split(r"(?<=[.!?])\s+|\n+", description)
            if sentence.strip() and "benchmark" not in sentence.casefold()
        )
    return re.sub(r"\.\s+\.", ".", description).strip()


def public_product_usp(brand: str, value: str) -> str:
    if brand != "INOVASI":
        return value
    return "; ".join(
        item.strip()
        for item in value.split(";")
        if item.strip() and "benchmark" not in item.casefold()
    )


def usage_for(name: str, category: str) -> list[str]:
    text = f"{name} {category}".casefold()
    if "toothpaste" in text:
        return ["Gunakan pada sikat gigi secukupnya, sikat gigi secara menyeluruh, lalu berkumur.", "Jangan ditelan; penggunaan oleh anak mengikuti petunjuk usia dan pengawasan pada label."]
    if "diffuser" in text:
        return ["Letakkan diffuser pada permukaan yang stabil di area dengan sirkulasi udara baik.", "Atur jumlah reed sesuai intensitas aroma yang diinginkan dan jauhkan dari anak, hewan, panas, serta api."]
    if "room spray" in text or "aromatherapy" in text:
        return ["Semprotkan ke udara atau gunakan sesuai fungsi yang tertulis pada label.", "Hindari semprotan langsung ke wajah, mata, makanan, dan permukaan yang sensitif; jauhkan dari panas dan api."]
    if "sunscreen" in text or "sun care" in text:
        return ["Oleskan merata pada area yang akan terpapar matahari sebagai langkah terakhir perawatan pagi.", "Gunakan dalam jumlah memadai dan aplikasikan ulang mengikuti petunjuk label, terutama setelah berkeringat, berenang, atau mengeringkan kulit."]
    if "facial cleanser" in text or "face care / cleanser" in text:
        if "cleansing oil" in text or "milky" in text:
            return ["Aplikasikan dengan tangan bersih mengikuti petunjuk kondisi kulit pada label, lalu pijat lembut.", "Tambahkan air bila diperlukan dan bilas sampai bersih tanpa menggosok berlebihan."]
        return ["Basahi wajah, aplikasikan produk secukupnya, lalu pijat lembut.", "Bilas hingga bersih dan lanjutkan dengan langkah perawatan berikutnya."]
    if "toner" in text:
        return ["Gunakan setelah membersihkan wajah.", "Tuangkan secukupnya pada telapak tangan atau kapas, aplikasikan lembut, lalu lanjutkan dengan perawatan berikutnya."]
    if "serum" in text or "face mist" in text:
        if "spray" in text or "mist" in text:
            return ["Kocok terlebih dahulu hanya bila petunjuk label menyatakannya.", "Semprotkan pada jarak aman dengan mata dan mulut tertutup, lalu tepuk lembut bila diperlukan."]
        return ["Aplikasikan secukupnya pada kulit yang sudah dibersihkan.", "Ratakan atau tepuk lembut hingga menyerap, lalu lanjutkan dengan pelembap; untuk pemakaian pagi lanjutkan dengan sunscreen."]
    if "intimate" in text:
        return ["Gunakan hanya pada area luar yang telah dibasahi.", "Aplikasikan secukupnya dengan lembut, lalu bilas hingga bersih."]
    if "hand care / spray" in text:
        return ["Semprotkan secukupnya pada tangan.", "Ratakan pada seluruh permukaan tangan dan biarkan mengering; hindari wajah dan mata."]
    if "hand care / cleanser" in text:
        return ["Basahi tangan, gunakan produk secukupnya, lalu gosok seluruh permukaan tangan.", "Bilas hingga bersih dan keringkan."]
    if "shampoo" in text:
        return ["Basahi rambut dan kulit kepala, aplikasikan secukupnya, lalu pijat lembut.", "Bilas hingga bersih dan ulangi hanya bila diperlukan sesuai label."]
    if "conditioner" in text:
        return ["Setelah keramas, aplikasikan pada batang hingga ujung rambut.", "Diamkan sesuai petunjuk label lalu bilas hingga bersih."]
    if "baby care / hair & body cleanser" in text:
        return ["Basahi rambut dan tubuh bayi dengan air hangat.", "Gunakan produk secukupnya, usapkan dengan lembut hingga berbusa, lalu bilas sampai bersih."]
    if "body care / cleanser" in text or "paper soap" in text:
        return ["Gunakan pada kulit yang telah dibasahi, busakan atau ratakan dengan lembut.", "Bilas hingga bersih dan hindari kontak langsung dengan mata."]
    if "body care / scrub" in text:
        return ["Aplikasikan secukupnya pada kulit tubuh yang telah dibasahi.", "Pijat lembut tanpa menggosok berlebihan, lalu bilas hingga bersih."]
    if "deodorant" in text:
        return ["Aplikasikan secukupnya pada kulit ketiak yang bersih dan kering.", "Biarkan mengering sebelum berpakaian dan jangan gunakan pada kulit yang luka atau baru dicukur bila terasa perih."]
    if "lip care" in text:
        return ["Aplikasikan tipis dan merata pada bibir yang bersih.", "Ulangi sesuai kebutuhan dan petunjuk pada label."]
    if "mask" in text:
        return ["Aplikasikan merata pada kulit yang bersih dengan menghindari area mata dan bibir.", "Diamkan dan bilas mengikuti durasi yang tercantum pada label kemasan."]
    if "hair" in text or "scalp" in text:
        return ["Aplikasikan secukupnya pada rambut atau kulit kepala sesuai area tujuan yang dinyatakan pada label.", "Pijat atau ratakan dengan lembut; bilas hanya bila petunjuk produk menyatakannya."]
    if "massage lotion" in text or "massage cream" in text:
        return ["Aplikasikan secukupnya pada area tubuh yang akan dipijat.", "Pijat perlahan hingga produk merata dan hentikan penggunaan bila kulit terasa tidak nyaman."]
    if "body care / lotion" in text:
        return ["Aplikasikan secukupnya pada kulit tubuh yang bersih.", "Ratakan sambil dipijat lembut hingga menyerap, terutama pada area yang terasa kering."]
    if any(term in text for term in ("moisturizer", "cream", "gel", "body care / balm")):
        return ["Aplikasikan secukupnya pada kulit yang bersih dan kering.", "Ratakan dengan lembut hingga menyerap dan gunakan sesuai frekuensi pada label."]
    return ["Aplikasikan secukupnya pada area yang bersih sesuai fungsi produk.", "Ratakan dengan lembut dan gunakan dengan frekuensi yang tercantum pada label kemasan."]


def safety_for(name: str, category: str) -> tuple[str, str, str]:
    text = f"{name} {category}".casefold()
    storage = "Simpan tertutup rapat di tempat sejuk dan kering, terlindung dari sinar matahari langsung, serta jauh dari jangkauan anak-anak."
    if any(term in text for term in ("diffuser", "room spray", "aromatherapy")):
        safety = "Gunakan sesuai fungsi pada label dan pastikan ventilasi memadai."
        avoid = "Bukan untuk dikonsumsi atau diaplikasikan ke kulit kecuali label menyatakan demikian. Hindari mata, makanan, panas, api, anak-anak, dan hewan peliharaan."
    elif "toothpaste" in text:
        safety = "Gunakan sesuai petunjuk usia pada label. Anak-anak perlu didampingi orang dewasa."
        avoid = "Jangan ditelan. Hentikan penggunaan bila timbul iritasi pada mulut dan ikuti peringatan pada kemasan."
    else:
        safety = "Gunakan sesuai petunjuk pemakaian. Hentikan penggunaan bila timbul reaksi yang tidak nyaman."
        avoid = "Hindari kontak langsung dengan mata dan penggunaan pada kulit yang sedang luka atau mengalami iritasi aktif, kecuali petunjuk produk menyatakan lain."
    return safety, storage, avoid


def find_source_product(source: dict[tuple[str, str], SourceProduct], brand: str, name: str) -> SourceProduct:
    wanted = SOURCE_NAME_ALIASES.get((brand, name), name)
    key = (normalize(brand), normalize(wanted))
    if key in source:
        return source[key]
    candidates = [item for (source_brand, _), item in source.items() if source_brand == normalize(brand)]
    ranked = sorted(
        ((SequenceMatcher(None, normalize(wanted), normalize(item.name)).ratio(), item) for item in candidates),
        key=lambda row: row[0], reverse=True,
    )
    if not ranked or ranked[0][0] < 0.88:
        raise ValueError(f"No reliable source match for {brand} / {name}")
    return ranked[0][1]


def product_image(brand: str, name: str) -> str:
    if (brand, name) in ASSET_ALIASES:
        return ASSET_ALIASES[(brand, name)]
    files = list(PRODUCT_ASSETS.glob("*.webp"))
    wanted = normalize(name)
    brand_key = normalize(brand)
    brand_aliases = {brand_key}
    if brand == "BABYLATORY": brand_aliases.add(normalize("BABY-LATORY"))
    if brand == "UPGLOW": brand_aliases.add(normalize("UPGLOW DIA Series"))
    if brand == "VOLUBILIS": brand_aliases.add(normalize("VOLUBILIS Vomega"))
    candidates = []
    for path in files:
        stem = re.sub(r"\s*\([^)]*\)\s*$", "", path.stem).strip()
        suffix_match = re.search(r"\(([^)]*)\)\s*$", path.stem)
        suffix = normalize(suffix_match.group(1)) if suffix_match else ""
        if suffix and not any(alias in suffix or suffix in alias for alias in brand_aliases):
            continue
        stem_key = normalize(stem)
        score = SequenceMatcher(None, wanted, stem_key).ratio()
        if wanted in stem_key or stem_key in wanted:
            score += 0.25
        if suffix == brand_key:
            score += 0.2
        elif suffix:
            score += 0.08
        candidates.append((score, path.stat().st_mtime, path))
    candidates.sort(key=lambda row: (row[0], row[1]), reverse=True)
    if not candidates or candidates[0][0] < 0.72:
        raise ValueError(f"No product image match for {brand} / {name}")
    return "/assets/products/" + candidates[0][2].name


def build_product(
    brand: str,
    name: str,
    source: SourceProduct,
    index: int,
    enhanced: SourceProduct | None = None,
) -> dict:
    copy_source = enhanced or source
    detail, source_usage = extract_detail_and_usage(copy_source.fields["detail"])
    unique = field_prose(publishable_field_lines(copy_source.fields["unique"]))
    benefits = parse_benefits(publishable_field_lines(copy_source.fields["benefits"]))
    ingredients, ingredient_details = parse_ingredients(source.fields["ingredients"])
    netto_items = bullet_items(source.fields["netto"])
    size = " / ".join(dict.fromkeys(normalize_netto(item) for item in netto_items))
    category = product_category(brand, name, detail)

    if detail:
        description = public_product_description(brand, name, detail)
    elif benefits:
        description = f"{name} memiliki manfaat utama: " + "; ".join(benefits) + "."
    elif ingredients:
        description = f"{name} diformulasikan dengan " + ", ".join(ingredients) + "."
    else:
        description = f"{name} merupakan bagian dari portofolio {brand}."

    usp = public_product_usp(brand, unique)

    if len(description) < 220:
        supporting_copy = []
        if benefits:
            benefit_copy = [item[:1].lower() + item[1:].rstrip(" .;") for item in benefits[:3]]
            supporting_copy.append("Fokus perawatannya mencakup " + natural_join(benefit_copy) + ".")
        if ingredients:
            supporting_copy.append("Bahan aktif yang ditonjolkan meliputi " + natural_join(ingredients[:5]) + ".")
        if supporting_copy:
            description = description.rstrip() + "\n\n" + " ".join(supporting_copy)

    card_source = "; ".join(item.rstrip(" .;") for item in benefits[:2])
    card_copy = (card_source.rstrip(" .;") + ".") if card_source else first_sentence(description)
    tagline = ""
    target = ""
    usp = "" if normalize(usp) == normalize(description) else usp
    usage = USAGE_OVERRIDES.get((brand, name)) or source_usage or usage_for(name, category)
    safety, storage, attention = safety_for(name, category)

    faq = []
    summary_sentences = [
        item.strip()
        for item in re.split(r"(?<=[.!?])\s+|\n+", description)
        if item.strip()
    ][:2]
    if summary_sentences:
        faq.append({
            "question": f"Apa fungsi utama {name}?",
            "answer": " ".join(summary_sentences),
        })
    if usp:
        usp_points = [item.strip(" .;") for item in usp.split(";") if item.strip(" .;")][:3]
        if usp_points:
            faq.append({
                "question": f"Apa yang membedakan {name}?",
                "answer": "; ".join(usp_points) + ".",
            })
    if ingredients:
        faq.append({
            "question": f"Apa bahan aktif utama {name}?",
            "answer": ", ".join(ingredients) + ".",
        })
    if size:
        faq.append({"question": f"Berapa netto {name}?", "answer": size})
    code_match = re.search(r"\b([A-Za-z][A-Za-z0-9-]*\s+[A-Z]{1,4}-\d{1,3})\b", unique)
    code = clean(code_match.group(1)) if code_match else ""
    image = product_image(brand, name)
    return {
        "id": slugify(name),
        "image": image,
        "name": name,
        "code": code,
        "size": size,
        "category": category,
        "tagline": tagline,
        "cardCopy": card_copy,
        "detailCopy": description,
        "description": description,
        "usp": usp,
        "targetUsers": target,
        "ingredients": ingredients,
        "heroIngredients": ingredients[:4],
        "benefits": benefits,
        "usage": usage,
        "slideReference": "",
        "slideReferences": [],
        "sourceImagePath": image.lstrip("/"),
        "brand": brand,
        "reportSlug": BRAND_SLUGS[brand],
        "packageInfo": {"netto": size},
        "safety": safety,
        "storage": storage,
        "storageExtra": "",
        "avoid": attention,
        "heroIngredientsDetail": ingredient_details,
        "faq": faq,
        "sourceDocument": f"{KNOWLEDGE_PATH.name}; {ENHANCED_PATH.name}",
    }


def brand_category(brand: str) -> str:
    if brand in COLLABORATION_BRANDS: return "kolaborasi"
    if brand in INTERNAL_BRANDS: return "internal"
    if brand == "BEAUTY SCAPE": return "beautyscape"
    return "inovasi"


def public_brand_overview(value: str, brand: str) -> str:
    value = value.replace("Portofolio dalam dokumen ini", f"Portofolio {brand}")
    value = value.replace(f"{brand} pada portofolio ini", brand)
    value = value.replace("dalam dokumen ini", "dalam rangkaian ini")
    value = value.replace("Dalam dokumen ini", "Dalam rangkaian ini")
    value = value.replace("Identitas ANARA dalam rangkaian ini", "Identitas ANARA")
    value = value.replace("Portofolio yang tercantum terdiri dari", "Portofolionya terdiri dari")
    value = value.replace("Portofolio produk yang dijabarkan mencakup", "Portofolionya mencakup")
    value = value.replace("Portofolio yang dijabarkan terdiri dari", "Portofolionya terdiri dari")
    value = value.replace("Rangkaian yang tercantum terdiri dari", "Rangkaiannya terdiri dari")
    value = value.replace("pilihan warna yang tercantum", "pilihan warna")
    value = value.replace("konsep multi-active brightening yang tercantum", "konsep multi-active brightening")
    value = value.replace("Alur pengembangan yang dijelaskan adalah", "Alur pengembangannya adalah")
    value = value.replace(
        "Essential Nourish Serum mencantumkan Patin Fish Oil 5% dan Vitamin E 1%, bersama bahan emolien yang mendukung tekstur pemakaian.",
        "Essential Nourish Serum memadukan Patin Fish Oil 5% dan Vitamin E 1% dengan bahan emolien yang mendukung tekstur pemakaian.",
    )
    value = value.replace(
        "Perbedaan kandungan dan netto dijelaskan per produk agar konsentrasi pada satu serum tidak dianggap berlaku untuk serum lainnya.",
        "Kedua serum memiliki komposisi dan netto berbeda sesuai karakter formulanya masing-masing.",
    )
    value = value.replace(
        "Identitas BABYLATORY bertumpu pada perawatan kulit bayi yang lembut dan nyaman, dengan informasi spesifik mengikuti deskripsi masing-masing produk.",
        "Identitas BABYLATORY bertumpu pada perawatan kulit bayi yang lembut dan nyaman, dengan komposisi serta fokus penggunaan yang berbeda pada setiap produk.",
    )
    value = value.replace(
        "Deskripsi rangkaian berfokus pada fungsi perawatan kulit yang disebutkan pada masing-masing formula, tanpa menjadikan konteks DIA Series sebagai janji pengobatan diabetes atau penyembuhan luka.",
        "Setiap formula diposisikan sebagai perawatan kosmetik untuk membantu menjaga hidrasi, kenyamanan, dan kondisi skin barrier.",
    )
    value = value.replace(
        "Harga, cakupan paket, jumlah pemesanan, dan waktu pengerjaan mengikuti spesifikasi yang disepakati, karena dokumen sumber memuat beberapa skenario serta angka penawaran yang belum selaras.",
        "Harga, cakupan paket, jumlah pemesanan, dan waktu pengerjaan mengikuti spesifikasi produk yang disepakati.",
    )
    value = re.sub(
        r"Harga, cakupan paket, jumlah pemesanan, dan waktu pengerjaan mengikuti spesifikasi yang disepakati, karena dokumen memuat[^.]*\.",
        "Harga, cakupan paket, jumlah pemesanan, dan waktu pengerjaan mengikuti spesifikasi produk yang disepakati.",
        value,
    )
    value = value.replace(
        "Status konsep, formula yang masih direvisi, dan data pengujian bahan diperlakukan sesuai keterangannya dalam sumber sehingga tidak otomatis menjadi bukti kinerja seluruh produk jadi.",
        "Setiap konsep mengikuti status pengembangan dan verifikasi yang berlaku sebelum menjadi produk final.",
    )
    value = value.replace(
        "Status konsep, formula yang masih direvisi, dan data pengujian bahan diperlakukan sesuai keterangannya sehingga tidak otomatis menjadi bukti kinerja seluruh produk jadi.",
        "Setiap konsep mengikuti status pengembangan dan verifikasi yang berlaku sebelum menjadi produk final.",
    )
    value = value.replace(
        "Fungsi tiga produk pembersihan dijelaskan sesuai fungsi masing-masing, sementara daftar bahan yang belum tersedia tidak disamakan dengan formula produk lain dalam seri.",
        "Fungsi tiga produk pembersihan dibedakan berdasarkan tahap penggunaannya dalam masing-masing seri.",
    )
    return value.strip()


def publishable_brand_faqs(items: list[dict[str, str]]) -> list[dict[str, str]]:
    selected = []
    for item in items:
        question = clean(item["question"])
        question_low = question.casefold()
        if any(term in question_low for term in (
            "dokumen",
            "sumber",
            "materi",
            "tercantum",
            "belum",
            "sudah tersedia",
            "sudah ditentukan",
            "dapat dipastikan",
            "dapat disebut bebas",
            "seluruh rangkaian dapat disebut",
            "dirinci menjadi persentase",
        )):
            continue
        if question == "Apakah Shellora AquaShield SPF 50+ sudah dinyatakan sebagai formula final?":
            question = "Apa konsep pengembangan Shellora AquaShield SPF 50+?"
        if question == "Apakah semua produk UPGLOW mengandung probiotik hidup?":
            question = "Bahan apa yang mendukung konsep mikrobioma UPGLOW?"
        answer = clean(item["answer"])
        answer = re.sub(r"^Sumber mengaitkan kebutuhan perawatan dengan\s+", "Kebutuhan perawatannya mencakup ", answer)
        answer = re.sub(r"^Sumber menjelaskan\s+", "", answer)
        answer = re.sub(r"^Sumber menempatkannya sebagai\s+", "Produk ini merupakan ", answer)
        answer = re.sub(r"^Sumber mencantumkan\s+", "", answer)
        answer = re.sub(r"^Sumber menyebut\s+", "", answer)
        answer = answer.replace("Sumber memberi keduanya deskripsi bahan umum", "Keduanya memadukan")
        answer = answer.replace("Sumber menuliskan urutan setelah mandi berupa", "Urutan pemakaian setelah mandi adalah")
        answer = answer.replace("Sumber juga menyebut", "Karakter produknya juga mencakup")
        answer = answer.replace("Sumber menempatkannya untuk", "Produk ini praktis digunakan untuk")
        answer = answer.replace("Sumber mengaitkannya dengan", "Produk ini membantu merawat")
        answer = answer.replace("Petunjuk sumber menyebut aplikasi pada", "Aplikasikan pada")
        answer = answer.replace("menurut petunjuk sumber", "sesuai kebutuhan")
        answer = answer.replace("mengikuti petunjuk penggunaan sumber", "mengikuti cara pakai masing-masing")
        answer = answer.replace("menurut sumber", "")
        answer = answer.replace("menurut deskripsinya", "")
        answer = answer.replace("Nilai tersebut mengikuti dokumen yang diberikan.", "")
        answer = answer.replace("Satuan massa dan volume dipertahankan sesuai sumber.", "")
        answer = answer.replace("Penamaan rangkaian dipertahankan sesuai sumber, sementara peran toner tetap dijelaskan sebagai toner.", "Essence Toner tetap digunakan pada tahap toner.")
        answer = answer.replace("KATEGORI: BRAND INTERNAL", "")
        answer = answer.replace(
            "Dokumen menggunakan bagian Arah Pengembangan Formula untuk menjelaskan produk ini. Konsepnya mencakup mineral-first protection, minimal chemical filters, tinted finish, dan skin care integration. Informasi tersebut diperlakukan sebagai arah pengembangan, bukan konfirmasi formula final atau hasil uji ketahanan air.",
            "Konsep pengembangannya mencakup mineral-first protection, minimal chemical filters, tinted finish, dan integrasi perawatan kulit.",
        )
        answer = answer.replace(
            "Hal tersebut tidak dapat dipastikan dari dokumen. Daftar produk menyebut Inulin + Fructose, Ferment Extract, Galactomyces Ferment, dan berbagai bahan pendukung lainnya. Istilah ferment, prebiotik, dan konsep mikrobioma tidak disamakan dengan konfirmasi probiotik hidup dalam seluruh formula.",
            "Konsep mikrobioma UPGLOW didukung oleh Inulin + Fructose, Ferment Extract, Galactomyces Ferment, dan bahan pendukung lain sesuai formula masing-masing produk.",
        )
        answer = answer.replace(
            "Sumber menjelaskan efek gold melalui Mica dan CI 77491. Bahan emas tidak tercantum dalam daftar yang tersedia. Nama Gold Serum karena itu tidak digunakan untuk menyimpulkan adanya emas murni atau partikel emas.",
            "Efek gold berasal dari Mica dan CI 77491. Penamaan Gold Serum menggambarkan efek visual formula, bukan kandungan emas murni.",
        )
        answer = answer.replace(
            "efek gold melalui Mica dan CI 77491. Bahan emas tidak tercantum dalam daftar yang tersedia. Nama Gold Serum karena itu tidak digunakan untuk menyimpulkan adanya emas murni atau partikel emas.",
            "Efek gold berasal dari Mica dan CI 77491. Penamaan Gold Serum menggambarkan efek visual formula, bukan kandungan emas murni.",
        )
        answer = re.sub(r"\b([A-Za-zÀ-ÿ]{3,})\s+\1\b", r"\1", answer, flags=re.I)
        kept = []
        for sentence in re.split(r"(?<=[.!?])\s+|\n+", answer):
            low = sentence.casefold()
            if any(term in low for term in (
                "belum",
                "tidak ada",
                "tidak dicantumkan",
                "tidak diberikan",
                "tidak ditambahkan",
                "tidak diturunkan",
                "tidak dapat dipastikan",
                "tidak dapat disimpulkan",
                "tidak dijelaskan",
                "tidak dijabarkan",
                "tidak disebut",
                "tidak menetapkan",
                "tidak diambil",
                "perlu dikonfirmasi",
                "perlu diselaraskan",
                "catatan internal",
                "laporan uji",
                "data materi saat ini",
                "dokumen ini",
                "sumber",
                "janji pengobatan",
                "mengobati diabetes",
            )):
                continue
            if sentence.strip():
                kept.append(sentence.strip())
        if kept and not (question_low.startswith("apakah") and len(kept) == 1 and kept[0].casefold() in ("tidak.", "tidak")):
            public_answer = " ".join(kept).strip()
            public_answer = public_answer[:1].upper() + public_answer[1:]
            selected.append({"question": question, "answer": public_answer})
    return selected


def build_brand(
    number: int,
    brand: str,
    product_names: list[str],
    source_products: dict[tuple[str, str], SourceProduct],
    overview: str,
    collaborators: list[str],
    enhanced_products: dict[tuple[str, str], SourceProduct],
    enhanced_faqs: list[dict[str, str]],
) -> dict:
    products = [
        build_product(
            brand,
            name,
            find_source_product(source_products, brand, name),
            index,
            find_source_product(enhanced_products, brand, name),
        )
        for index, name in enumerate(product_names, 1)
    ]
    categories = list(dict.fromkeys(product["category"] for product in products))
    portfolio = ", ".join(product_names)
    if overview:
        long_description = public_brand_overview(overview, brand)
        short_description = long_description.split("\n\n", 1)[0]
    else:
        long_description = (
            f"{brand} menghadirkan rangkaian yang terdiri dari {len(products)} produk: {portfolio}.\n\n"
            f"Portofolionya mencakup {', '.join(categories)}, dengan fungsi dan bahan aktif yang dijelaskan pada setiap halaman produk."
        )
        short_description = f"Portofolio {brand} mencakup {len(products)} produk pada kategori {', '.join(categories)}."

    category_label = ", ".join(categories[:4]) + (" dan lainnya" if len(categories) > 4 else "")
    faq = [
        {"question": f"Apa itu {brand}?", "answer": short_description},
        {"question": f"Produk apa saja yang ada di {brand}?", "answer": f"Portofolio {brand} terdiri dari {portfolio}."},
    ]
    faq.extend(publishable_brand_faqs(enhanced_faqs)[:6])
    if collaborators:
        faq.append({"question": f"Siapa kolaborator {brand}?", "answer": ", ".join(collaborators).rstrip(".") + "."})
    deduplicated_faq = []
    seen_questions = set()
    for item in faq:
        key = normalize(item["question"])
        if key in seen_questions:
            continue
        seen_questions.add(key)
        deduplicated_faq.append(item)
    faq = deduplicated_faq

    category = brand_category(brand)
    profile = {
        "name": brand,
        "slug": BRAND_SLUGS[brand],
        "color": COLOR_BY_CATEGORY[category],
        "eyebrow": category_label,
        "headline": brand,
        "subheadline": short_description,
        "shortDescription": short_description,
        "longDescription": long_description,
        "category": category_label,
        "principle": f"Rangkaian {len(products)} produk",
        "principleDetails": categories,
        "targetAudience": "Mengikuti kebutuhan dan target penggunaan yang dijelaskan pada setiap produk.",
        "searchTags": ", ".join([brand, *categories, *product_names]),
        "ctaPrimary": f"Lihat {len(products)} Produk",
        "ctaSecondary": "Pelajari Brand",
        "faq": faq,
        "principleLine": f"{brand} — {len(products)} produk dalam katalog product knowledge.",
        "collaborators": [{"name": name, "role": "Kolaborator brand", "image": ""} for name in collaborators],
    }
    return {
        "number": number,
        "slug": BRAND_SLUGS[brand],
        "title": brand,
        "slides": KNOWLEDGE_PATH.name,
        "slideCount": len(products),
        "productCount": len(products),
        "gapCount": 0,
        "image": BRAND_IMAGES[brand],
        "brandCategory": category,
        "profiles": [profile],
        "mainProfile": profile,
        "products": products,
        "gaps": [],
        "validationNotes": [f"Roster: {ROSTER_PATH.name}", f"Content: {KNOWLEDGE_PATH.name}"],
    }


def js_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


def write_catalog(brands: list[dict]) -> None:
    regular = [brand for brand in brands if brand["slug"] != "inovasi"]
    inovasi = next(brand for brand in brands if brand["slug"] == "inovasi")
    meta = {
        "title": "RAY Knowledge",
        "source": f"{ROSTER_PATH.name}; {KNOWLEDGE_PATH.name}; {ENHANCED_PATH.name}",
        "brandCount": len(brands),
        "productCount": sum(len(brand["products"]) for brand in brands),
        "updatedLabel": "Katalog product knowledge internal",
        "version": "2.0.0",
        "builtFrom": f"{ROSTER_PATH.name} + {KNOWLEDGE_PATH.name} + {ENHANCED_PATH.name}",
    }
    data_js = "window.RAY_KNOWLEDGE = " + js_json({"meta": meta, "brands": regular}) + ";\n"
    inovasi_js = """(function () {
  \"use strict\";
  const catalog = window.RAY_KNOWLEDGE;
  if (!catalog || !Array.isArray(catalog.brands)) return;
  const brand = __BRAND__;
  catalog.brands = catalog.brands.filter((item) => item.slug !== \"inovasi\");
  catalog.brands.push(brand);
  catalog.meta.brandCount = catalog.brands.length;
  catalog.meta.productCount = catalog.brands.reduce(
    (total, item) => total + (item.products?.length || 0), 0
  );
})();
""".replace("__BRAND__", js_json(inovasi))
    (SOURCE_ASSETS / "data.js").write_text(data_js, encoding="utf-8", newline="\n")
    (SOURCE_ASSETS / "inovasi-data.js").write_text(inovasi_js, encoding="utf-8", newline="\n")


def audit(brands: list[dict]) -> None:
    names = [product["name"] for brand in brands for product in brand["products"]]
    ids = [product["id"] for brand in brands for product in brand["products"]]
    if len(names) != 118 or len(set(ids)) != len(ids):
        raise ValueError("Generated product count or ID uniqueness is invalid")
    missing_assets = []
    for brand in brands:
        for product in brand["products"]:
            asset = ROOT / "public" / product["image"].lstrip("/")
            if not asset.is_file(): missing_assets.append(str(asset))
    if missing_assets:
        raise FileNotFoundError("\n".join(missing_assets))
    gaps = Counter()
    banned_copy = (
        "belum dicantumkan pada dokumen sumber",
        "unique value belum dirinci",
        "dokumen sumber belum mencantumkan",
        "informasi terverifikasi yang tersedia",
        "panduan umum berdasarkan jenis produk",
        "petunjuk berikut diringkas dari dokumen sumber",
        "tidak dicantumkan",
        "dicantumkan sebagai bahan aktif dalam dokumen sumber",
        "tercantum pada sumber",
        "tercantum dalam sumber",
        "sesuai sumber",
        "dalam sumber",
        "pada sumber",
        "petunjuk sumber",
        "dokumen sumber",
        "materi sumber",
        "dalam materi",
        "menurut materi",
        "laporan uji",
        "catatan pemeriksaan internal",
        "penjelasan lengkap untuk sales",
        "pembeda yang perlu ditekankan oleh sales",
        "masih dalam proses revisi",
        "informasi tersebut tidak dapat disimpulkan",
        "informasi tersebut tidak dapat dipastikan",
    )
    for brand in brands:
        profile = brand["profiles"][0]
        brand_copy = json.dumps(
            {"overview": profile["longDescription"], "faq": profile["faq"]},
            ensure_ascii=False,
        ).casefold()
        leaked_brand_copy = [phrase for phrase in banned_copy if phrase in brand_copy]
        if leaked_brand_copy:
            raise ValueError(f"{brand['title']}: editorial copy leaked into brand page: {leaked_brand_copy}")
        if len(profile["longDescription"]) < 180 or len(profile["faq"]) < 3:
            raise ValueError(f"{brand['title']}: brand overview or FAQ is incomplete")
        for product in brand["products"]:
            if not product["ingredients"]: gaps["bahan aktif tidak tersedia"] += 1
            if not product["benefits"]: gaps["key benefits tidak tersedia"] += 1
            if not product["size"]: gaps["netto tidak tersedia"] += 1
            visible_copy = json.dumps(
                {key: product[key] for key in ("tagline", "description", "usp", "size", "code", "usage", "faq", "heroIngredientsDetail")},
                ensure_ascii=False,
            ).casefold()
            matched = [phrase for phrase in banned_copy if phrase in visible_copy]
            if matched:
                raise ValueError(f"{brand['title']} / {product['name']}: placeholder copy leaked: {matched}")
            if len(product["description"]) < 180 or len(product["faq"]) < 2:
                raise ValueError(f"{brand['title']} / {product['name']}: product copy is incomplete")
            if normalize(product["tagline"]) == normalize(product["description"]):
                raise ValueError(f"{brand['title']} / {product['name']}: tagline duplicates description")
            paragraphs = [normalize(item) for item in product["description"].split("\n\n") if normalize(item)]
            if len(paragraphs) != len(set(paragraphs)):
                raise ValueError(f"{brand['title']} / {product['name']}: duplicate description paragraph")
            questions = [normalize(item["question"]) for item in product["faq"]]
            if len(questions) != len(set(questions)):
                raise ValueError(f"{brand['title']} / {product['name']}: duplicate FAQ question")
    print(f"Generated {len(brands)} brands and {len(names)} official products.")
    for label, count in gaps.items():
        print(f"Source gap - {label}: {count}")


def audit_source_coverage(
    brands: list[dict],
    roster: OrderedDict[str, list[str]],
    source_products: dict[tuple[str, str], SourceProduct],
    enhanced_products: dict[tuple[str, str], SourceProduct],
) -> None:
    generated = {
        (brand["title"], product["name"]): product
        for brand in brands
        for product in brand["products"]
    }
    checked = 0
    for brand, names in roster.items():
        for name in names:
            product = generated[(brand, name)]
            source = find_source_product(source_products, brand, name)
            enhanced = find_source_product(enhanced_products, brand, name)
            searchable_detail = normalize(product["description"] + " " + " ".join(product["usage"]))
            for raw in source.fields["detail"]:
                line = clean(raw)
                line = re.sub(r"^(?:[-*]|\d+[.)]|[a-z][.)])\s*", "", line, flags=re.I)
                if not line or re.fullmatch(r"(?:how to use|cara pakai|bentuk)\s*: ?", line, re.I):
                    continue
                publishable_line = public_product_description(brand, name, line)
                for sentence in re.split(r"(?<=[.!?])\s+", publishable_line):
                    publishable_sentence = sentence.strip()
                    key = normalize(publishable_sentence)
                    if not publishable_sentence:
                        continue
                    if len(key) > 15 and key not in searchable_detail:
                        raise ValueError(f"{brand} / {name}: source detail was not carried into info or usage: {sentence}")

            expected_benefits = parse_benefits(publishable_field_lines(enhanced.fields["benefits"]))
            expected_ingredients, _ = parse_ingredients(source.fields["ingredients"])
            expected_size = " / ".join(
                dict.fromkeys(normalize_netto(item) for item in bullet_items(source.fields["netto"]))
            )
            expected_unique = field_prose(publishable_field_lines(enhanced.fields["unique"]))
            expected_unique = public_product_usp(brand, expected_unique)
            expected_usp = "" if normalize(expected_unique) == normalize(product["description"]) else expected_unique
            for field, expected in (
                ("benefits", expected_benefits),
                ("ingredients", expected_ingredients),
                ("size", expected_size),
                ("usp", expected_usp),
            ):
                if product[field] != expected:
                    raise ValueError(f"{brand} / {name}: generated {field} no longer matches the approved source")
            checked += 1
    print(f"Audited source coverage for all {checked} official products.")


def main() -> None:
    roster = parse_roster()
    overviews, collaborators, source_products = parse_source()
    enhanced_overviews, enhanced_faqs, enhanced_products = parse_enhanced_source()
    if len(source_products) != 118:
        raise ValueError(f"Knowledge document must contain exactly 118 product sections, found {len(source_products)}")
    brands = [
        build_brand(
            number,
            brand,
            product_names,
            source_products,
            enhanced_overviews.get(brand, "") or overviews.get(brand, ""),
            collaborators.get(brand, []),
            enhanced_products,
            enhanced_faqs.get(brand, []),
        )
        for number, (brand, product_names) in enumerate(roster.items(), 1)
    ]
    audit(brands)
    audit_source_coverage(brands, roster, source_products, enhanced_products)
    write_catalog(brands)


if __name__ == "__main__":
    main()
