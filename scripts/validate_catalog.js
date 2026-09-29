const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const scopedImagePattern = /^\/assets\/(brands|products|collaborators)\/.+\.webp$/i;
const checkedImages = new Set();

function validateWebpAsset(label, image) {
  if (!scopedImagePattern.test(image || "")) {
    throw new Error(`${label}: expected canonical WebP asset path, received ${image}`);
  }
  const imagePath = path.join(root, "public", decodeURIComponent(image));
  if (!fs.existsSync(imagePath)) throw new Error(`${label}: image not found at ${image}`);
  const header = fs.readFileSync(imagePath).subarray(0, 12);
  if (
    header.length !== 12 ||
    header.toString("ascii", 0, 4) !== "RIFF" ||
    header.toString("ascii", 8, 12) !== "WEBP"
  ) {
    throw new Error(`${label}: file is not a valid WebP container at ${image}`);
  }
  checkedImages.add(image);
}

function findLegacyRasters(directory) {
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...findLegacyRasters(fullPath));
    else if (/\.(?:jpe?g|png)$/i.test(entry.name)) found.push(fullPath);
  }
  return found;
}
const context = { window: {} };
vm.createContext(context);
for (const file of [
  "public/assets/data.js",
  "public/assets/collaborator-data.js",
  "public/assets/inovasi-data.js",
]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

const catalog = context.window.RAY_KNOWLEDGE;
if (!catalog || !Array.isArray(catalog.brands)) throw new Error("Invalid catalog root");
const normalizeCopy = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const copySentences = (value) =>
  String(value || "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
const bannedVisibleCopy = [
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
];

const rosterLines = fs
  .readFileSync(path.join(root, "list brand dan produk.md"), "utf8")
  .split(/\r?\n/)
  .filter((line) => line.startsWith("|") && !line.includes("---") && !line.includes("| BRAND"));
const officialRoster = new Map();
for (const line of rosterLines) {
  const cells = line.slice(1, -1).split("|").map((cell) => cell.trim());
  if (!cells[0] || !cells[1]) continue;
  if (!officialRoster.has(cells[0])) officialRoster.set(cells[0], []);
  officialRoster.get(cells[0]).push(cells[1]);
}
if (officialRoster.size !== 20) throw new Error(`Expected 20 brands in official roster, found ${officialRoster.size}`);
if ([...officialRoster.values()].flat().length !== 118) throw new Error("Expected 118 products in official roster");
const catalogRoster = new Map(catalog.brands.map((brand) => [brand.title, (brand.products || []).map((product) => product.name)]));
for (const [brand, officialProducts] of officialRoster) {
  const actualProducts = catalogRoster.get(brand);
  if (!actualProducts) throw new Error(`Official brand missing from catalog: ${brand}`);
  const missing = officialProducts.filter((name) => !actualProducts.includes(name));
  const extra = actualProducts.filter((name) => !officialProducts.includes(name));
  if (missing.length || extra.length) {
    throw new Error(`${brand}: roster mismatch; missing [${missing.join(", ")}], extra [${extra.join(", ")}]`);
  }
}
const extraBrands = [...catalogRoster.keys()].filter((brand) => !officialRoster.has(brand));
if (extraBrands.length) throw new Error(`Catalog contains unofficial brands: ${extraBrands.join(", ")}`);

for (const catalogBrand of catalog.brands) {
  validateWebpAsset(`Brand ${catalogBrand.slug}`, catalogBrand.image);
  const profile = catalogBrand.profiles?.[0];
  if (!profile?.longDescription || profile.longDescription.length < 180 || (profile.faq || []).length < 3) {
    throw new Error(`${catalogBrand.title}: incomplete brand overview or FAQ`);
  }
  const brandVisibleCopy = JSON.stringify({
    overview: profile.longDescription,
    faq: profile.faq,
  }).toLowerCase();
  const brandLeaks = bannedVisibleCopy.filter((phrase) => brandVisibleCopy.includes(phrase));
  if (brandLeaks.length) throw new Error(`${catalogBrand.title}: editorial copy leaked into brand page: ${brandLeaks.join(", ")}`);
  if (/\b([a-z]{3,})\s+\1\b/i.test(brandVisibleCopy)) {
    throw new Error(`${catalogBrand.title}: repeated adjacent word in brand copy`);
  }
  for (const catalogProduct of (catalogBrand.products || []).filter(Boolean)) {
    validateWebpAsset(`Product ${catalogProduct.id}`, catalogProduct.image);
    if (!catalogProduct.description || !Array.isArray(catalogProduct.usage) || !catalogProduct.usage.length) {
      throw new Error(`${catalogBrand.title} / ${catalogProduct.name}: incomplete core product copy`);
    }
    if (catalogProduct.description.length < 180 || (catalogProduct.faq || []).length < 2) {
      throw new Error(`${catalogBrand.title} / ${catalogProduct.name}: incomplete product description or FAQ`);
    }
    const visibleCopy = JSON.stringify({
      tagline: catalogProduct.tagline,
      description: catalogProduct.description,
      usp: catalogProduct.usp,
      size: catalogProduct.size,
      code: catalogProduct.code,
      usage: catalogProduct.usage,
      faq: catalogProduct.faq,
      ingredientDetails: catalogProduct.heroIngredientsDetail,
    }).toLowerCase();
    const leaked = bannedVisibleCopy.filter((phrase) => visibleCopy.includes(phrase));
    if (leaked.length) throw new Error(`${catalogBrand.title} / ${catalogProduct.name}: placeholder copy leaked: ${leaked.join(", ")}`);
    if (/\b([a-z]{3,})\s+\1\b/i.test(visibleCopy)) {
      throw new Error(`${catalogBrand.title} / ${catalogProduct.name}: repeated adjacent word in visible copy`);
    }
    if (catalogProduct.tagline && normalizeCopy(catalogProduct.tagline) === normalizeCopy(catalogProduct.description)) {
      throw new Error(`${catalogBrand.title} / ${catalogProduct.name}: tagline duplicates description`);
    }
    if (/\b([a-z]{3,})\s+\1\b/i.test(catalogProduct.description)) {
      throw new Error(`${catalogBrand.title} / ${catalogProduct.name}: repeated adjacent word in description`);
    }
    const descriptionSentences = copySentences(catalogProduct.description).map(normalizeCopy).filter(Boolean);
    if (descriptionSentences.length !== new Set(descriptionSentences).size) {
      throw new Error(`${catalogBrand.title} / ${catalogProduct.name}: duplicate description sentence`);
    }
    const usageSteps = (catalogProduct.usage || []).map(normalizeCopy).filter(Boolean);
    if (usageSteps.length !== new Set(usageSteps).size) {
      throw new Error(`${catalogBrand.title} / ${catalogProduct.name}: duplicate usage step`);
    }
    const usageSet = new Set(usageSteps);
    if (descriptionSentences.some((sentence) => usageSet.has(sentence))) {
      throw new Error(`${catalogBrand.title} / ${catalogProduct.name}: description duplicates a usage step`);
    }
    if ((catalogProduct.ingredients || []).some((item) => /^[a-z]\.\s+/i.test(item))) {
      throw new Error(`${catalogBrand.title} / ${catalogProduct.name}: structural heading leaked into ingredients`);
    }
    for (const field of ["ingredients", "benefits"]) {
      const values = (catalogProduct[field] || []).map(normalizeCopy).filter(Boolean);
      if (values.length !== new Set(values).size) throw new Error(`${catalogBrand.title} / ${catalogProduct.name}: duplicate ${field}`);
    }
    const questions = (catalogProduct.faq || []).map((item) => normalizeCopy(item.question)).filter(Boolean);
    if (questions.length !== new Set(questions).size) throw new Error(`${catalogBrand.title} / ${catalogProduct.name}: duplicate FAQ question`);
  }
}

const publicApp = fs.readFileSync(path.join(root, "public/assets/app.js"), "utf8").toLowerCase();
for (const phrase of ["belum dicantumkan pada dokumen sumber", "belum tercantum pada materi sumber", "belum tersedia pada materi sumber"]) {
  if (publicApp.includes(phrase)) throw new Error(`Public UI still contains editorial placeholder: ${phrase}`);
}
const collaboratorMap = context.window.RAY_COLLABORATORS_BY_BRAND;
if (!collaboratorMap || Object.keys(collaboratorMap).length !== 14) {
  throw new Error("Expected collaborator data for 14 collaboration brands");
}
for (const [slug, collaborators] of Object.entries(collaboratorMap)) {
  const collaborationBrand = catalog.brands.find((item) => item.slug === slug);
  if (!collaborationBrand) throw new Error(`Collaborator brand not found: ${slug}`);
  if (!collaborators.length) throw new Error(`${slug}: collaborators cannot be empty`);
  if (collaborationBrand.mainProfile?.collaborators?.length !== collaborators.length) {
    throw new Error(`${slug}: main profile collaborator data was not applied`);
  }
  for (const collaborator of collaborators) {
    if (!collaborator.name || !collaborator.role || !collaborator.image) {
      throw new Error(`${slug}: incomplete collaborator record`);
    }
    validateWebpAsset(`Collaborator ${collaborator.name}`, collaborator.image);
  }
}
const inovasiBrands = catalog.brands.filter((brand) => brand.slug === "inovasi");
if (inovasiBrands.length !== 1) throw new Error(`Expected one INOVASI brand, found ${inovasiBrands.length}`);
const brand = inovasiBrands[0];
if (brand.products.length !== 18) throw new Error(`Expected 18 INOVASI products, found ${brand.products.length}`);

const ids = new Set();
for (const product of brand.products) {
  for (const field of ["id", "name", "brand", "image", "category", "description", "usage"]) {
    if (!product[field] || (Array.isArray(product[field]) && !product[field].length)) {
      throw new Error(`${product.name || product.id || "Unknown product"}: missing ${field}`);
    }
  }
  if (ids.has(product.id)) throw new Error(`Duplicate product id: ${product.id}`);
  ids.add(product.id);
  if (!Array.isArray(product.ingredients)) throw new Error(`${product.name}: ingredients must be an array`);
  if (!Array.isArray(product.heroIngredients)) throw new Error(`${product.name}: heroIngredients must be an array`);
  if (!Array.isArray(product.heroIngredientsDetail)) throw new Error(`${product.name}: heroIngredientsDetail must be an array`);
}

for (const assetFolder of ["brands", "products", "collaborators"]) {
  const legacy = findLegacyRasters(path.join(root, "public", "assets", assetFolder));
  if (legacy.length) {
    throw new Error(`${assetFolder}: ${legacy.length} legacy JPG/JPEG/PNG files remain`);
  }
}

const productCount = catalog.brands.reduce((total, item) => total + (item.products?.length || 0), 0);
if (catalog.meta.brandCount !== catalog.brands.length) throw new Error("meta.brandCount is stale");
if (catalog.meta.productCount !== productCount) throw new Error("meta.productCount is stale");
console.log(`Validated ${catalog.brands.length} brands, ${productCount} products, 15 collaborator records, and ${checkedImages.size} unique WebP assets.`);
