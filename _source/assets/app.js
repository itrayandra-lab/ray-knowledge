(function () {
  "use strict";

  const source = window.RAY_KNOWLEDGE;
  const app = document.getElementById("app");
  if (!source || !app) return;

  const brands = source.brands || [];
  function webpAssetPath(value) {
    return String(value || "").replace(
      /^(\/assets\/(?:brands|products|collaborators)\/.+)\.(?:jpe?g|png)([?#].*)?$/i,
      "$1.webp$2",
    );
  }
  brands.forEach((brand) => {
    brand.image = webpAssetPath(brand.image);
    (brand.products || []).forEach((product) => {
      product.image = webpAssetPath(product.image);
    });
    const profiles = [brand.mainProfile, ...(brand.profiles || [])].filter(Boolean);
    profiles.forEach((profile) => {
      (profile.collaborators || []).forEach((collaborator) => {
        collaborator.image = webpAssetPath(collaborator.image);
      });
    });
  });
  const products = brands.flatMap((brand) =>
    (brand.products || []).map((product) => ({
      ...product,
      brandRecord: brand,
    })),
  );
  const state = {
    productTab: "info",
    category: "all",
    brandTab: "overview",
    homeBrandCat: "all",
    productTextScale: Number(localStorage.getItem("ray-product-text-scale") || 1),
  };
  if (!Number.isFinite(state.productTextScale)) state.productTextScale = 1;
  state.productTextScale = Math.min(1.3, Math.max(0.9, state.productTextScale));

  // Global handler for home brand category filter (called from inline onclick)
  window.homeFilterCat = function (cat) {
    state.homeBrandCat = cat;
    // Toggle active pill
    document.querySelectorAll(".home-cat-filter .cat-pill").forEach((b) => {
      b.classList.toggle("active", b.dataset.cat === cat);
    });
    // Toggle section visibility (matching brandsPage catFilter pattern)
    document.querySelectorAll(".brand-section").forEach((s) => {
      s.hidden = cat !== "all" && s.id !== cat;
    });
  };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function clean(value, fallback) {
    return String(value || "").trim() || fallback || "";
  }

  function hex(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(String(value || ""))
      ? value
      : fallback || "#9ac9ff";
  }

  function slugify(value) {
    return (
      normalize(value)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "ingredient"
    );
  }

  function icon(name, size) {
    const paths = {
      arrow: '<path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path>',
      back: '<path d="m15 18-6-6 6-6"></path>',
      book: '<path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z"></path><path d="M9 8h6M9 12h6M9 16h4"></path>',
      check: '<path d="m5 12 4 4L19 6"></path>',
      drop: '<path d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z"></path>',
      grid: '<rect x="4" y="4" width="6" height="6" rx="1.5"></rect><rect x="14" y="4" width="6" height="6" rx="1.5"></rect><rect x="4" y="14" width="6" height="6" rx="1.5"></rect><rect x="14" y="14" width="6" height="6" rx="1.5"></rect>',
      heart:
        '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.7-7.5 1.1-1.1a5.5 5.5 0 0 0 0-7.8Z"></path>',
      home: '<path d="m3 11 9-8 9 8"></path><path d="M5 10v10h14V10"></path><path d="M9 20v-6h6v6"></path>',
      info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path>',
      layers:
        '<path d="m12 3 8 4-8 4-8-4 8-4Z"></path><path d="m4 12 8 4 8-4M4 17l8 4 8-4"></path>',
      molecule:
        '<circle cx="12" cy="12" r="2.5"></circle><circle cx="5" cy="18" r="2"></circle><circle cx="18.5" cy="5" r="2"></circle><circle cx="20" cy="17" r="2"></circle><path d="m10 14-3.5 2.5M14 10l3-3.4M14.5 13.2l3.7 2.5"></path>',
      question:
        '<circle cx="12" cy="12" r="9"></circle><path d="M9.8 9a2.5 2.5 0 0 1 4.8 1c0 1.7-2.6 2.1-2.6 4M12 17h.01"></path>',
      search:
        '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path>',
      share:
        '<circle cx="18" cy="5" r="2"></circle><circle cx="6" cy="12" r="2"></circle><circle cx="18" cy="19" r="2"></circle><path d="m8 11 8-5M8 13l8 5"></path>',
      spark:
        '<path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z"></path><path d="m18.5 15 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"></path>',
      use: '<path d="M8 3h8M9 3v5l-4 8a3 3 0 0 0 2.7 4h8.6a3 3 0 0 0 2.7-4l-4-8V3"></path><path d="M8 14h8"></path>',
    };
    return `<svg class="icon" width="${size || 22}" height="${size || 22}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.spark}</svg>`;
  }

  function splitIngredient(raw) {
    const text = clean(raw).replace(/\s[—–]\s/g, " : ");
    const parts = text.split(/\s(?:—|–|:)\s/);
    return {
      name: clean(parts.shift(), text).replace(/^[-•]\s*/, ""),
      detail: clean(
        parts.join(" — "),
        "",
      ),
    };
  }

  const ingredientMap = new Map();
  products.forEach((product) => {
    const rawItems = [
      ...(product.heroIngredients || []),
      ...(product.ingredients || []),
    ];
    rawItems.forEach((raw) => {
      const parsed = splitIngredient(raw);
      if (!parsed.name) return;
      const productDetail = (product.heroIngredientsDetail || []).find(
        (item) => normalize(item.name) === normalize(parsed.name),
      );
      const description = clean(productDetail?.description || parsed.detail, "");
      const key = normalize(parsed.name);
      const current = ingredientMap.get(key) || {
        id: slugify(parsed.name),
        name: parsed.name,
        description,
        products: [],
        hero: false,
      };
      if (current.description.length < description.length)
        current.description = description;
      if (!current.products.some((item) => item.id === product.id))
        current.products.push(product);
      current.hero =
        current.hero || (product.heroIngredients || []).includes(raw);
      ingredientMap.set(key, current);
    });
  });
  const ingredients = [...ingredientMap.values()].sort(
    (a, b) =>
      b.products.length - a.products.length || a.name.localeCompare(b.name),
  );

  // ===== Admin overrides (localStorage-persisted edits) =====
  const ADMIN_KEY = "ray-kb-overrides-v1";
  const ADMIN_AUTH_KEY = "ray-kb-auth";
  function loadAdminOverrides() {
    try {
      const raw = localStorage.getItem(ADMIN_KEY);
      return raw ? JSON.parse(raw) : { brands: {}, products: {}, global: {} };
    } catch (_) {
      return { brands: {}, products: {}, global: {} };
    }
  }
  function saveAdminOverrides(o) {
    try {
      localStorage.setItem(ADMIN_KEY, JSON.stringify(o));
    } catch (_) {}
  }
  // Fetch remote overrides (server-stored JSON file)
  async function fetchServerOverrides() {
    try {
      const res = await fetch("/assets/data-overrides.json?_=" + Date.now(), {
        cache: "no-store",
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    }
  }
  async function saveServerOverrides(o) {
    // Generate downloadable JSON file; user deploys it
    const blob = new Blob([JSON.stringify(o, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data-overrides.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function applyAdminOverrides() {
    // Merge from server-fetched overrides + localStorage, then apply to data
    const server = window.__SERVER_OVERRIDES__ || {};
    const local = loadAdminOverrides();
    const o = mergeOverrides(server, local);
    applyOverridesData(o);
  }

  function mergeOverrides(server, local) {
    const brands = Object.assign({}, server.brands || {}, local.brands || {});
    const products = Object.assign(
      {},
      server.products || {},
      local.products || {},
    );
    return {
      brands,
      products,
      global: Object.assign({}, server.global || {}, local.global || {}),
    };
  }

  function applyOverridesData(o) {
    brands.forEach((b) => {
      const edits = o.brands[b.slug];
      if (!edits) return;
      if (edits.title) b.title = edits.title;
      if (edits.image) b.image = webpAssetPath(edits.image);
      if (edits.profile) {
        const p = b.mainProfile || (b.mainProfile = {});
        Object.assign(p, edits.profile);
        if (b.profiles && b.profiles[0])
          Object.assign(b.profiles[0], edits.profile);
      }
    });
    products.forEach((p) => {
      const edits = o.products[p.id];
      if (!edits) return;
      [
        "name",
        "category",
        "tagline",
        "detailCopy",
        "description",
        "usp",
        "targetUsers",
        "image",
      ].forEach((k) => {
        if (edits[k]) p[k] = k === "image" ? webpAssetPath(edits[k]) : edits[k];
      });
      ["ingredients", "heroIngredients", "benefits", "pairing", "faq"].forEach(
        (k) => {
          if (Array.isArray(edits[k])) p[k] = edits[k];
        },
      );
    });
  }

  async function loadServerOverrides() {
    // Add 3-second timeout so a slow/stuck server doesn't block initial render
    const controller = new AbortController();
    const timeout = setTimeout(function () {
      controller.abort();
    }, 1500);
    try {
      const res = await fetch("/assets/data-overrides.json?_=" + Date.now(), {
        cache: "no-store",
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === "object") {
          window.__SERVER_OVERRIDES__ = data;
        }
      }
    } catch (_) {}
    clearTimeout(timeout);
    // Always apply merged overrides + render, even if server fetch failed
    applyAdminOverrides();
    render();
  }

  function route() {
    const raw = (location.hash || "#/home").replace(/^#\/?/, "");
    const [path, query = ""] = raw.split("?");
    const parts = path.split("/").filter(Boolean);
    return {
      name: parts[0] || "home",
      id: decodeURIComponent(parts[1] || ""),
      params: new URLSearchParams(query),
    };
  }

  function href(type, id) {
    return `#/${type}${id ? `/${encodeURIComponent(id)}` : ""}`;
  }

  function currentBrandName(brand) {
    return clean(
      brand && brand.mainProfile && brand.mainProfile.name,
      brand && brand.title,
    );
  }

  function topbar(title, options) {
    const opts = options || {};
    if (opts.home) {
      return `<header class="topbar home-topbar">
        <a class="ray-wordmark" href="#/home" aria-label="RAY Product Knowledge"><img src="/assets/logo-name-lunaray.png" alt="RAY" class="ray-wordmark-img" /></a>
        <div class="system-time"><strong data-clock>--:--</strong><span data-date>Knowledge hub</span></div>
      </header>`;
    }
    return `<header class="topbar">
      <button class="round-button" type="button" data-back aria-label="Kembali">${icon("back")}</button>
      <a class="screen-title" href="${opts.brandHref || "#/home"}">${esc(title || "RAY")}</a>
      <div class="top-actions">
        ${opts.productTextControls ? productTextControls() : ""}
        <a class="round-button home-shortcut" href="#/home" aria-label="Ke beranda" title="Home">${icon("home", 19)}</a>
      </div>
    </header>`;
  }

  function productTextControls() {
    return `<div class="product-text-tools" aria-label="Ukuran teks produk">
      <button type="button" data-product-font="-0.1" aria-label="Perkecil teks"><span aria-hidden="true">-</span></button>
      <span class="sr-only" data-product-font-value>${Math.round(state.productTextScale * 100)}%</span>
      <button type="button" data-product-font="0.1" aria-label="Perbesar teks"><span aria-hidden="true">+</span></button>
    </div>`;
  }

  function productTextStyle() {
    const scale = state.productTextScale;
    const px = (value) => `${Number((value * scale).toFixed(2))}px`;
    return `--product-body:${px(18)};--product-support:${px(17)};--product-small:${px(16)};--product-meta:${px(13)};--product-tab:${px(14)};`;
  }

  function bottomNav(active) {
    // Hidden per user request — navigation accessed via top-right home shortcut only
    return `<!-- bottom-nav removed: ${active} -->`;
  }

  function shell(content, options) {
    const opts = options || {};
    app.innerHTML = `<div class="app-shell ${opts.className || ""}" style="--accent:${hex(opts.accent, "#9ecbff")};--product-text-scale:${state.productTextScale};${productTextStyle()}">
      ${topbar(opts.title, opts)}
      <main id="main-content" class="screen">${content}</main>
      ${bottomNav(opts.nav || "")}
    </div>`;
    bindCommon();
    if (opts.home) updateClock();
  }

  function brandCard(brand, index) {
    const profile = brand.mainProfile || {};
    return `<a class="brand-tile reveal" href="${href("brand", brand.slug)}" data-brand-slug="${brand.slug}" data-brand-cat="${esc(brand.brandCategory || "")}" style="--tile:${hex(profile.color)}">
      <img src="${esc(webpAssetPath(brand.image))}" alt="Identitas visual ${esc(currentBrandName(brand))}" loading="lazy" width="1280" height="720">
      <span class="brand-tile-copy"><strong>${esc(currentBrandName(brand))}</strong><small>${esc(clean(profile.category, `${brand.products.length} produk`))}</small></span>
    </a>`;
  }

  function homePage() {
    const collabSlugs = new Set([
      "phytosync",
      "mommylatory",
      "baby-latory",
      "sam-sun-and-moon",
      "volubilis",
      "dermalink",
      "dermond",
      "luecielliderm",
      "eggshellent",
      "alpha-shield",
      "anara",
      "aquera",
      "coralyst",
      "upglow-dai",
    ]);
    const internalSlugs = new Set([
      "beautylatory",
      "beautynature",
      "adhwa",
      "sheluna",
    ]);
    const beautyscapeSlug = "beautyscape";
    const inovasiSlug = "inovasi";

    const brandsByCat = (slugSet) => brands.filter((b) => slugSet.has(b.slug));
    const collab = brandsByCat(collabSlugs);
    const internal = brandsByCat(internalSlugs);
    const beautyscape = brands.filter((b) => b.slug === beautyscapeSlug);
    const inovasi = brands.filter((b) => b.slug === inovasiSlug);

    const catPills = [
      { id: "kolaborasi", label: "Brand Kolaborasi" },
      { id: "internal", label: "Brand Internal" },
      { id: "beautyscape", label: "Brand Beautyscape" },
      { id: "inovasi", label: "Brand Inovasi" },
    ];
    const filterBtn = (id, label, isActive) =>
      `<button class="cat-pill${isActive ? " active" : ""}" type="button" data-cat="${id}" onclick="homeFilterCat('${id}')">${label}</button>`;
    const content = `<section class="home-hero">
      <div class="hero-bg-image" aria-hidden="true"></div>
      <div class="hero-copy">
        <span class="hero-kicker"><i aria-hidden="true"></i>RAY KNOWLEDGE SYSTEM</span>
        <h1><span class="h1-l1">SCIENCE</span><span class="h1-l2"><strong>BEHIND</strong><em>BEAUTY</em></span></h1>
        <p>Knowledge today. For a brighter tomorrow.</p>
        <div class="hero-stats"><span><strong>${brands.length}</strong><span>brand</span></span><span><strong>${products.length}</strong><span>produk</span></span><span><strong>${ingredients.length}</strong><span>bahan aktif</span></span></div>
        <form class="hero-search" data-search-form>
          ${icon("search", 21)}
          <input type="search" name="q" autocomplete="off" placeholder="Cari di knowledge library" aria-label="Cari knowledge">
          <button type="submit" aria-label="Mulai mencari">${icon("arrow", 18)}</button>
        </form>
      </div>
    </section>
    <section class="home-brands" aria-labelledby="home-brands-title">
      <div class="section-heading">
        <div><span class="section-kicker">KNOWLEDGE LIBRARY</span><h2 id="home-brands-title">Our Brands</h2></div>
        <a href="#/brands">Lihat semua ${icon("arrow", 18)}</a>
      </div>
      <p class="section-lede">Jelajahi seluruh keluarga brand, positioning, rangkaian produk, dan bahan aktifnya.</p>
      <div class="home-cat-filter" role="group" aria-label="Filter kategori brand">
        ${filterBtn("all", "Semua", true)}${catPills.map((c) => filterBtn(c.id, c.label, false)).join("")}
      </div>
      <section class="brand-section" id="kolaborasi">
        <div class="brand-grid">${collab.map((b, i) => brandCard(b, i)).join("")}</div>
      </section>
      <section class="brand-section" id="internal">
        <div class="brand-grid">${internal.map((b, i) => brandCard(b, i)).join("")}</div>
      </section>
      <section class="brand-section" id="beautyscape">
        <div class="brand-grid">${beautyscape.map((b, i) => brandCard(b, i)).join("")}</div>
      </section>
      <section class="brand-section" id="inovasi">
        <div class="brand-grid">${inovasi.map((b, i) => brandCard(b, i)).join("")}</div>
      </section>
    </section>`;
    shell(content, { home: true, nav: "home", className: "home-shell" });
  }

  function brandsPage() {
    const collabSlugs = new Set([
      "phytosync",
      "mommylatory",
      "baby-latory",
      "sam-sun-and-moon",
      "volubilis",
      "dermalink",
      "dermond",
      "luecielliderm",
      "eggshellent",
      "alpha-shield",
      "anara",
      "aquera",
      "coralyst",
      "upglow-dai",
    ]);
    const internalSlugs = new Set([
      "beautylatory",
      "beautynature",
      "adhwa",
      "sheluna",
    ]);
    const beautyscapeSlug = "beautyscape";
    const inovasiSlug = "inovasi";

    const brandsBySection = (slugSet) =>
      brands.filter((b) => slugSet.has(b.slug));
    const collab = brandsBySection(collabSlugs);
    const internal = brandsBySection(internalSlugs);
    const beautyscape = brands.filter((b) => b.slug === beautyscapeSlug);
    const inovasi = brands.filter((b) => b.slug === inovasiSlug);

    const catPills = [
      { id: "kolaborasi", label: "Brand Kolaborasi" },
      { id: "internal", label: "Brand Internal" },
      { id: "beautyscape", label: "Brand Beautyscape" },
      { id: "inovasi", label: "Brand Inovasi" },
    ];

    const content = `<section class="page-intro compact">
      <span class="section-kicker">BRAND DIRECTORY</span>
      <h1>Semua brand.<br><em>Satu knowledge hub.</em></h1>
      <p>Temukan ${brands.length} brand dan ${products.length} produk.</p>
      <label class="inline-search">${icon("search", 21)}<input type="search" placeholder="Filter nama atau kategori brand…" data-brand-filter></label>
      <div class="cat-filter" role="group" aria-label="Filter kategori brand">
        <button class="cat-pill active" type="button" data-cat="all">Semua</button>
        ${catPills.map((c) => `<button class="cat-pill" type="button" data-cat="${c.id}">${c.label}</button>`).join("")}
      </div>
    </section>
    <section class="catalog-section" id="kolaborasi">
      <div class="section-heading"><div><span class="section-kicker">KOLABORASI</span><h2>Brand dengan Kolaborasi Ilmiah</h2></div></div>
      <div class="brand-grid">${collab.map((b, i) => brandCard(b, i)).join("")}</div>
    </section>
    <section class="catalog-section" id="internal">
      <div class="section-heading"><div><span class="section-kicker">INTERNAL</span><h2>Brand Utama & Distribusi</h2></div></div>
      <div class="brand-grid">${internal.map((b, i) => brandCard(b, i)).join("")}</div>
    </section>
    <section class="catalog-section" id="beautyscape">
      <div class="section-heading"><div><span class="section-kicker">BEAUTYSCAPE</span><h2>Brand Distribusi & Retail</h2></div></div>
      <div class="brand-grid">${beautyscape.map((b, i) => brandCard(b, i)).join("")}</div>
    </section>
    <section class="catalog-section" id="inovasi">
      <div class="section-heading"><div><span class="section-kicker">INOVASI</span><h2>Beauty Innovation Showcase 2026</h2></div></div>
      <div class="brand-grid">${inovasi.map((b, i) => brandCard(b, i)).join("")}</div>
    </section>`;

    shell(content, { title: "Brand Directory", nav: "brands" });

    const input = document.querySelector("[data-brand-filter]");
    if (input) {
      input.addEventListener("input", () => {
        const q = normalize(input.value);
        document
          .querySelectorAll(".brand-tile[data-brand-slug]")
          .forEach((card) => {
            const slug = card.dataset.brandSlug;
            const brand = brands.find((b) => b.slug === slug);
            if (!brand) {
              card.hidden = true;
              return;
            }
            const profile = brand.mainProfile || {};
            const haystack = normalize(
              [
                brand.title,
                profile.name,
                profile.category,
                profile.searchTags,
                profile.shortDescription,
              ].join(" "),
            );
            card.hidden = q && !haystack.includes(q);
          });
        document.querySelectorAll(".catalog-section").forEach((section) => {
          const visible = section.querySelectorAll(
            ".brand-tile:not([hidden])",
          ).length;
          const empty = section.querySelector("[data-empty]");
          if (empty) empty.hidden = visible > 0;
        });
      });
    }

    document.querySelectorAll(".cat-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cat = btn.dataset.cat;
        document
          .querySelectorAll(".cat-pill")
          .forEach((b) => b.classList.toggle("active", b === btn));
        document
          .querySelectorAll(".catalog-section")
          .forEach((s) => (s.hidden = cat !== "all" && s.id !== cat));
      });
    });
  }

  function productCard(product, index) {
    const brand = product.brandRecord;
    const imgSrc = webpAssetPath(product.image || brand.image);
    const isProductImg = !!product.image;
    return `<a class="product-card" href="${href("product", product.id)}" data-category="${esc(normalize(product.category || "lainnya"))}">
      <div class="product-card-media">
        <img src="${esc(imgSrc)}" alt="Visual ${esc(product.name)}" loading="lazy" width="1280" height="720">
        <span class="visual-label">${isProductImg ? "Foto produk" : "Visual brand"}</span>
        <span class="product-number">${String(index + 1).padStart(2, "0")}</span>
      </div>
      <div class="product-card-copy"><span>${esc(clean(product.category, "Produk"))}</span><h3>${esc(product.name)}</h3><p>${esc(clean(product.cardCopy || product.tagline, "Buka product knowledge lengkap."))}</p></div>
      <span class="product-arrow">${icon("arrow", 17)}</span>
    </a>`;
  }

  function brandPage(slug) {
    const brand = brands.find((item) => item.slug === slug);
    if (!brand) return notFound();
    const profile = brand.mainProfile || {};
    const categories = [
      ...new Set(brand.products.map((item) => clean(item.category, "Lainnya"))),
    ].sort();
    // Build tab list — only show Kolaborasi if collaborators exist
    const collaborators = (profile && profile.collaborators) || [];
    const faqs = profile.faq || [];
    const tabItems = [["overview", "book", "Overview"]];
    if (collaborators.length) tabItems.push(["collab", "spark", "Kolaborasi"]);
    if (faqs.length) tabItems.push(["faq", "question", "FAQ"]);

    const activeTab = tabItems.find((t) => t[0] === state.brandTab)
      ? state.brandTab
      : "overview";
    state.brandTab = activeTab;

    const tabsHtml = `<nav class="brand-tabs" style="--brand-tabs-count:${tabItems.length}" aria-label="Brand sections">${tabItems
      .map(
        ([key, sym, label]) =>
          `<button class="${activeTab === key ? "active" : ""}" type="button" data-brand-tab="${key}" aria-pressed="${activeTab === key}">${icon(sym, 20)}<span>${label}</span></button>`,
      )
      .join("")}</nav>`;

    // Overview section
    const overviewHtml = `<section class="brand-tab-pane" data-brand-pane="overview"${activeTab !== "overview" ? " hidden" : ""}>
      <div class="brand-overview glass-panel">
        <div><span class="section-kicker">BRAND OVERVIEW</span><h2>Identitas dan arah brand.</h2>${paragraphs(profile.longDescription || profile.shortDescription)}</div>
      </div>
    </section>`;

    // Collaboration section (only if data exists)
    let collabHtml = "";
    if (collaborators.length) {
      collabHtml = `<section class="brand-tab-pane" data-brand-pane="collab"${activeTab !== "collab" ? " hidden" : ""}>
        <div class="collab-head">
          <span class="section-kicker">COLLABORATION</span>
          <h2>Kolaborasi ${esc(currentBrandName(brand))}</h2>
          <p>Kolaborator profesional yang tercantum dalam materi brand.</p>
        </div>
        <div class="collab-grid">${collaborators
          .map(
            (c) => `<article class="collab-card">
              <div class="collab-photo"><img src="${esc(webpAssetPath(c.image || brand.image))}" alt="Foto ${esc(c.name)}" loading="lazy" width="400" height="500"></div>
              <div class="collab-meta">
                <strong>${esc(c.name)}</strong>
                <small>${esc(c.role || "Collaboration Partner")}</small>
              </div>
            </article>`,
          )
          .join("")}</div>
      </section>`;
    }

    // FAQ section (only if data exists)
    let faqHtml = "";
    if (faqs.length) {
      faqHtml = `<section class="brand-tab-pane" data-brand-pane="faq"${activeTab !== "faq" ? " hidden" : ""}>
        <div class="brand-faq-head">
          <span class="section-kicker">FAQ BRAND</span>
          <h2>Pertanyaan tentang ${esc(currentBrandName(brand))}</h2>
        </div>
        <div class="accordion">${faqs
          .map(
            (f, i) =>
              `<details ${i === 0 ? "open" : ""}><summary>${esc(f.question || "")}<span>+</span></summary><p>${esc(f.answer || "")}</p></details>`,
          )
          .join("")}</div>
      </section>`;
    }

    // Products section (always shown, outside tabs)
    const productsHtml = `<section class="product-catalog">
        <div class="section-heading"><div><span class="section-kicker">PRODUCT KNOWLEDGE</span><h2>Our Products</h2></div>
          <label class="select-pill"><span class="sr-only">Filter kategori</span><select data-category-filter><option value="all">Semua kategori</option>${categories.map((category) => `<option value="${esc(normalize(category))}">${esc(category)}</option>`).join("")}</select></label>
        </div>
        <p class="section-lede">Buka produk untuk melihat info, bahan aktif, dan FAQ.</p>
        <div class="product-grid" data-product-grid>${brand.products.map((product, index) => productCard({ ...product, brandRecord: brand }, index)).join("")}</div>
        <div class="empty-state" data-product-empty hidden>Tidak ada produk pada kategori ini.</div>
      </section>
      ${brand.gaps && brand.gaps.length ? `<details class="validation-note"><summary>${icon("info", 19)} Catatan kelengkapan materi</summary><ul>${brand.gaps.map((gap) => `<li>${esc(gap)}</li>`).join("")}</ul></details>` : ""}`;

    const content = `<section class="brand-hero">
      <img src="${esc(webpAssetPath(brand.image))}" alt="Identitas visual ${esc(currentBrandName(brand))}" width="1280" height="720">
      <div class="brand-hero-wash"></div>
      <div class="brand-hero-copy"><span>${esc(clean(profile.category, "RAY brand"))}</span><h1>${esc(currentBrandName(brand))}</h1><p>${esc(clean(profile.subheadline || profile.shortDescription, `${brand.products.length} produk dalam knowledge library.`))}</p></div>
      <div class="brand-hero-count"><strong>${brand.products.length}</strong><span>produk</span></div>
    </section>
    ${tabsHtml}
    <div class="brand-tab-content">
      ${overviewHtml}
      ${collabHtml}
      ${faqHtml}
    </div>
    ${productsHtml}`;

    shell(content, {
      title: currentBrandName(brand),
      accent: profile.color,
      favorite: `brand:${brand.slug}`,
      share: true,
      brandHref: href("brand", brand.slug),
      nav: "brands",
      className: "brand-shell",
    });

    // Wire up tabs
    document.querySelectorAll("[data-brand-tab]").forEach((btn) =>
      btn.addEventListener("click", () => {
        state.brandTab = btn.dataset.brandTab;
        brandPage(slug);
        window.scrollTo({
          top: document.querySelector(".brand-tabs").offsetTop - 80,
          behavior: "smooth",
        });
      }),
    );

    // Wire up product category filter
    const select = document.querySelector("[data-category-filter]");
    if (select) {
      select.addEventListener("change", () => {
        let visible = 0;
        document.querySelectorAll("[data-category]").forEach((card) => {
          const show =
            select.value === "all" || card.dataset.category === select.value;
          card.hidden = !show;
          visible += show ? 1 : 0;
        });
        const empty = document.querySelector("[data-product-empty]");
        if (empty) empty.hidden = visible > 0;
      });
    }
  }

  function paragraphs(value) {
    return String(value || "")
      .split(/\n\n+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => `<p>${esc(part)}</p>`)
      .join("");
  }

  function list(items, className) {
    const values = (items || []).filter(Boolean);
    return values.length
      ? `<ul class="${className || "check-list"}">${values.map((item) => `<li>${icon("check", 16)}<span>${esc(item)}</span></li>`).join("")}</ul>`
      : "";
  }

  function productTabs(product) {
    const items = [
      ["info", "book", "Info Produk"],
    ];
    if ((product.ingredients || []).length || (product.heroIngredients || []).length)
      items.push(["ingredients", "molecule", "Bahan Aktif"]);
    if ((product.usage || []).length) items.push(["usage", "use", "Cara Pakai"]);
    items.push(["pairing", "layers", "Produk Lain"], ["faq", "question", "FAQ"]);
    return `<nav class="product-tabs" aria-label="Bagian product knowledge">${items
      .map(
        ([key, symbol, label]) =>
          `<button class="${state.productTab === key ? "active" : ""}" type="button" data-product-tab="${key}" aria-pressed="${state.productTab === key}">${icon(symbol, 23)}<span>${label}</span></button>`,
      )
      .join("")}</nav>`;
  }

  function productVisual(product) {
    const brand = product.brandRecord;
    // Use product's uploaded image if available, otherwise brand visual
    const imgSrc = webpAssetPath(product.image || brand.image);
    const isProduct = !!product.image;
    return `<figure class="detail-visual">
      <img src="${esc(imgSrc)}" alt="${esc(product.name)}" width="1280" height="720">
    </figure>`;
  }

  function productInfo(product) {
    const benefits = product.benefits || [];
    return `<section class="product-info-layout">
      ${productVisual(product)}
      <div class="product-info-copy">
        <span class="section-kicker">${esc(clean(product.brand, currentBrandName(product.brandRecord)))}</span>
        <h1>${esc(product.name)}</h1>
        ${product.tagline ? `<p class="product-tagline">${esc(product.tagline)}</p>` : ""}
        <div class="chip-row">${[product.category, product.size, product.code]
          .filter(Boolean)
          .map((item) => `<span>${esc(item)}</span>`)
          .join("")}</div>
        ${paragraphs(product.description || product.detailCopy || product.cardCopy)}
        ${product.usp ? `<aside class="usp-card"><span>Unique value</span><p>${esc(product.usp)}</p></aside>` : ""}
        ${benefits.length ? `<div class="benefit-block"><h2>Key Benefits</h2>${list(benefits)}</div>` : ""}
      </div>
    </section>`;
  }

  function productIngredients(product) {
    const values = [
      ...new Set([
        ...(product.heroIngredients || []),
        ...(product.ingredients || []),
      ]),
    ];
    if (!values.length)
      return `<div class="empty-state panel-empty">Informasi bahan aktif belum tersedia untuk produk ini.</div>`;
    return `<section class="tab-section"><div class="tab-heading"><span class="section-kicker">FORMULA KNOWLEDGE</span><h1>Hero Ingredients</h1><p>Bahan aktif utama dalam formula produk ini.</p></div>
      <div class="ingredient-grid">${values
        .map((raw, index) => {
          const parsed = splitIngredient(raw);
          const record = ingredientMap.get(normalize(parsed.name));
          const detail = (product.heroIngredientsDetail || []).find(
            (item) => normalize(item.name) === normalize(parsed.name),
          );
          return `<a class="ingredient-card" href="${href("ingredient", record ? record.id : slugify(parsed.name))}">
          <div class="ingredient-art art-${index % 3}"><span>${icon("molecule", 36)}</span><i></i></div>
          <div><span class="ingredient-no">0${index + 1}</span><h2>${esc(parsed.name)}</h2>${detail?.description || parsed.detail ? `<p>${esc(detail?.description || parsed.detail)}</p>` : ""}${detail?.concentration ? `<div class="ingredient-meta"><span>${esc(detail.concentration)}</span>${detail.function ? `<span>${esc(detail.function)}</span>` : ""}</div>` : ""}<span class="learn-link">Pelajari ${icon("arrow", 16)}</span></div>
        </a>`;
        })
        .join("")}</div></section>`;
  }

  function usageSteps(value) {
    const text = clean(value);
    if (!text) return [];
    const direct = text
      .split(/(?:\n+|(?<=\.)\s+(?=[A-Z0-9]))/)
      .map((item) => item.trim())
      .filter(Boolean);
    return direct.length > 1 ? direct : [text];
  }

  function productUse(product) {
    const steps = Array.isArray(product.usage)
      ? product.usage.filter(Boolean)
      : usageSteps(product.usage);
    return `<section class="tab-section usage-section"><div class="tab-heading"><span class="section-kicker">USAGE &amp; CARE</span><h1>Cara Pakai</h1><p>Ikuti urutan pemakaian dan catatan perawatan produk berikut.</p></div>
      ${steps.length ? `<ol class="usage-list">${steps.map((step, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><p>${esc(step)}</p></li>`).join("")}</ol>` : `<div class="empty-state panel-empty">Panduan penggunaan belum tersedia untuk produk ini.</div>`}
      <div class="care-grid">
        ${product.safety ? `<article><h2>Keamanan</h2><p>${esc(product.safety)}</p></article>` : ""}
        ${product.storage ? `<article><h2>Penyimpanan</h2><p>${esc(product.storage)}</p>${product.storageExtra ? `<small>${esc(product.storageExtra)}</small>` : ""}</article>` : ""}
        ${product.avoid ? `<article><h2>Perhatian</h2><p>${esc(product.avoid)}</p></article>` : ""}
      </div>
    </section>`;
  }

  function relatedProducts(product) {
    const ownTerms = new Set(
      (product.ingredients || []).map((item) =>
        normalize(splitIngredient(item).name),
      ),
    );
    return products
      .filter((candidate) => candidate.id !== product.id)
      .map((candidate) => {
        const shared = (candidate.ingredients || []).filter((item) =>
          ownTerms.has(normalize(splitIngredient(item).name)),
        ).length;
        const sameBrand =
          candidate.brandRecord.slug === product.brandRecord.slug ? 2 : 0;
        return { candidate, score: shared + sameBrand };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((item) => item.candidate);
  }

  function productPairing(product) {
    const related = relatedProducts(product);
    return `<section class="tab-section"><div class="tab-heading"><span class="section-kicker">RELATED KNOWLEDGE</span><h1>Produk Lain</h1><p>Produk terkait berdasarkan brand dan kesamaan bahan dalam katalog.</p></div>
      <aside class="source-caution">${icon("info", 20)} <p>Bagian ini adalah relasi knowledge, bukan klaim kompatibilitas formula. Ikuti arahan R&amp;D atau Regulatory untuk pairing resmi.</p></aside>
      ${related.length ? `<div class="related-grid">${related.map((item, index) => productCard(item, index)).join("")}</div>` : `<div class="empty-state panel-empty">Produk terkait belum tersedia.</div>`}
    </section>`;
  }

  function productFaq(product) {
    const grounded = [];
    if (product.targetUsers)
      grounded.push({
        question: `Untuk siapa ${product.name}?`,
        answer: product.targetUsers,
      });
    if (product.usage)
      grounded.push({
        question: `Bagaimana cara menggunakan ${product.name}?`,
        answer: Array.isArray(product.usage)
          ? product.usage.join(" ")
          : product.usage,
      });
    if ((product.benefits || []).length)
      grounded.push({
        question: "Apa manfaat utamanya?",
        answer: product.benefits.join("; ") + ".",
      });
    const candidates = [
      ...grounded,
      ...(product.faq || []),
    ];
    const seen = new Set();
    const items = candidates.filter((item) => {
      const key = normalize(item.question);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return `<section class="tab-section faq-tab"><div class="tab-heading"><span class="section-kicker">QUICK ANSWERS</span><h1>FAQ</h1><p>Jawaban ringkas seputar produk dan brand.</p></div>
      ${items.length ? `<div class="accordion">${items.map((item, index) => `<details ${index === 0 ? "open" : ""}><summary>${esc(item.question)}<span>+</span></summary><p>${esc(item.answer)}</p></details>`).join("")}</div>` : `<div class="empty-state panel-empty">FAQ produk belum tersedia.</div>`}
    </section>`;
  }

  function productPage(id) {
    const product =
      products.find((item) => item.id === id) ||
      products.find((item) => {
        const brandSlug = item.brandRecord && item.brandRecord.slug;
        return brandSlug && `${brandSlug}-${item.id}` === id;
      });
    if (!product) return notFound();
    const brand = product.brandRecord;
    if (
      state.productTab === "ingredients" &&
      !(product.ingredients || []).length &&
      !(product.heroIngredients || []).length
    ) state.productTab = "info";
    const renderTab =
      {
        info: productInfo,
        ingredients: productIngredients,
        usage: productUse,
        pairing: productPairing,
        faq: productFaq,
      }[state.productTab] || productInfo;
    const content = `${productTabs(product)}<div class="product-tab-content" data-tab-content>${renderTab(product)}</div>`;
    shell(content, {
      title: product.name,
      accent: brand.mainProfile && brand.mainProfile.color,
      favorite: `product:${product.id}`,
      share: true,
      productTextControls: true,
      brandHref: href("brand", brand.slug),
      nav: "brands",
      className: "product-shell",
    });
    document.querySelectorAll("[data-product-tab]").forEach((button) =>
      button.addEventListener("click", () => {
        state.productTab = button.dataset.productTab;
        productPage(id);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }),
    );
  }

  function ingredientPage(id) {
    const ingredient = ingredients.find((item) => item.id === id);
    if (!ingredient) return notFound();
    const content = `<section class="ingredient-detail-hero">
      <div class="ingredient-hero-art"><span>${icon("molecule", 64)}</span><i></i><b></b></div>
      <div><span class="section-kicker">INGREDIENT LIBRARY</span><h1>${esc(ingredient.name)}</h1>${ingredient.description ? `<p>${esc(ingredient.description)}</p>` : ""}<div class="chip-row"><span>${ingredient.products.length} produk terkait</span>${ingredient.hero ? "<span>Hero ingredient</span>" : ""}</div></div>
    </section>
    <section class="tab-section"><div class="section-heading"><div><span class="section-kicker">FOUND IN</span><h2>Produk Terkait</h2></div></div><div class="product-grid">${ingredient.products.map((item, index) => productCard(item, index)).join("")}</div></section>`;
    shell(content, {
      title: ingredient.name,
      nav: "search",
      className: "ingredient-shell",
    });
  }

  function searchTextProduct(product) {
    return normalize(
      [
        product.name,
        product.brand,
        product.category,
        product.tagline,
        product.description,
        product.cardCopy,
        product.detailCopy,
        product.targetUsers,
        ...(product.ingredients || []),
        ...(product.heroIngredients || []),
        ...(product.benefits || []),
      ].join(" "),
    );
  }

  function searchPage(initial) {
    const query = clean(initial);
    const content = `<section class="search-page-head"><span class="section-kicker">GLOBAL SEARCH</span><h1>Temukan knowledge<br><em>lebih cepat.</em></h1><label class="search-page-field">${icon("search", 25)}<input type="search" value="${esc(query)}" autofocus autocomplete="off" placeholder="Brand, produk, bahan aktif, manfaat…" data-search-page><button type="button" data-search-clear aria-label="Hapus pencarian">×</button></label><div class="search-suggestions"><span>Coba:</span><button data-query="sunscreen">sunscreen</button><button data-query="niacinamide">niacinamide</button><button data-query="sensitive">sensitive</button></div></section><section class="search-results" data-search-results></section>`;
    shell(content, {
      title: "Search Knowledge",
      nav: "search",
      className: "search-shell",
    });
    const input = document.querySelector("[data-search-page]");
    const renderResults = () => {
      const q = normalize(input.value);
      const brandMatches = q
        ? brands.filter((brand) =>
            normalize(
              [
                brand.title,
                currentBrandName(brand),
                brand.mainProfile && brand.mainProfile.category,
                brand.mainProfile && brand.mainProfile.shortDescription,
              ].join(" "),
            ).includes(q),
          )
        : [];
      const productMatches = q
        ? products.filter((product) => searchTextProduct(product).includes(q))
        : [];
      const ingredientMatches = q
        ? ingredients.filter((ingredient) =>
            normalize(
              [ingredient.name, ingredient.description].join(" "),
            ).includes(q),
          )
        : [];
      const total =
        brandMatches.length + productMatches.length + ingredientMatches.length;
      document.querySelector("[data-search-results]").innerHTML = !q
        ? `<div class="search-idle"><span>${icon("spark", 34)}</span><h2>Mulai dari satu kata.</h2><p>Kami akan mencari ke seluruh ${brands.length} brand, ${products.length} produk, dan bahan aktif.</p></div>`
        : !total
          ? `<div class="search-idle"><span>${icon("search", 34)}</span><h2>Tidak ada hasil.</h2><p>Coba istilah yang lebih singkat atau nama bahan lainnya.</p></div>`
          : `<div class="result-summary"><span>${total} hasil</span><p>untuk “${esc(input.value)}”</p></div>
            ${brandMatches.length ? `<div class="result-group"><h2>Brand <span>${brandMatches.length}</span></h2><div class="brand-grid compact-grid">${brandMatches.map(brandCard).join("")}</div></div>` : ""}
            ${productMatches.length ? `<div class="result-group"><h2>Produk <span>${productMatches.length}</span></h2><div class="product-grid">${productMatches.map((item, index) => productCard(item, index)).join("")}</div></div>` : ""}
            ${
              ingredientMatches.length
                ? `<div class="result-group"><h2>Bahan aktif <span>${ingredientMatches.length}</span></h2><div class="ingredient-chip-grid">${ingredientMatches
                    .slice(0, 24)
                    .map(
                      (item) =>
                        `<a href="${href("ingredient", item.id)}"><span>${icon("molecule", 19)}</span><div><strong>${esc(item.name)}</strong><small>${item.products.length} produk</small></div>${icon("arrow", 16)}</a>`,
                    )
                    .join("")}</div></div>`
                : ""
            }`;
    };
    input.addEventListener("input", renderResults);
    document
      .querySelector("[data-search-clear]")
      .addEventListener("click", () => {
        input.value = "";
        input.focus();
        renderResults();
      });
    document.querySelectorAll("[data-query]").forEach((button) =>
      button.addEventListener("click", () => {
        input.value = button.dataset.query;
        renderResults();
      }),
    );
    renderResults();
  }

  function notFound() {
    shell(
      `<section class="search-idle not-found"><span>${icon("spark", 40)}</span><h1>Halaman belum ditemukan.</h1><p>Kembali ke knowledge hub untuk melanjutkan.</p><a class="primary-button" href="#/home">Ke beranda ${icon("arrow", 18)}</a></section>`,
      { title: "RAY Knowledge", nav: "home" },
    );
  }

  function isFavorite(key) {
    try {
      return JSON.parse(localStorage.getItem("ray-favorites") || "[]").includes(
        key,
      );
    } catch (_) {
      return false;
    }
  }

  function toggleFavorite(key, button) {
    let values = [];
    try {
      values = JSON.parse(localStorage.getItem("ray-favorites") || "[]");
    } catch (_) {
      values = [];
    }
    values = values.includes(key)
      ? values.filter((item) => item !== key)
      : [...values, key];
    localStorage.setItem("ray-favorites", JSON.stringify(values));
    button.classList.toggle("is-favorite", values.includes(key));
  }

  function bindCommon() {
    document.querySelectorAll("[data-back]").forEach((button) =>
      button.addEventListener("click", () => {
        if (history.length > 1) history.back();
        else location.hash = "#/home";
      }),
    );
    document
      .querySelectorAll("[data-favorite]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          toggleFavorite(button.dataset.favorite, button),
        ),
      );
    document.querySelectorAll("[data-share]").forEach((button) =>
      button.addEventListener("click", async () => {
        const payload = {
          title: document.title,
          text: "Buka di RAY Product Knowledge",
          url: location.href,
        };
        try {
          if (navigator.share) await navigator.share(payload);
          else if (navigator.clipboard) {
            await navigator.clipboard.writeText(location.href);
            button.classList.add("copied");
            setTimeout(() => button.classList.remove("copied"), 1200);
          }
        } catch (_) {
          /* share was dismissed */
        }
      }),
    );
    document.querySelectorAll("[data-product-font]").forEach((button) =>
      button.addEventListener("click", () => {
        const delta = Number(button.dataset.productFont || 0);
        state.productTextScale = Math.min(
          1.3,
          Math.max(0.9, Number((state.productTextScale + delta).toFixed(2))),
        );
        localStorage.setItem("ray-product-text-scale", state.productTextScale);
        const shell = document.querySelector(".product-shell");
        if (shell) {
          shell.style.setProperty("--product-text-scale", state.productTextScale);
          const scale = state.productTextScale;
          shell.style.setProperty("--product-body", `${Number((18 * scale).toFixed(2))}px`);
          shell.style.setProperty("--product-support", `${Number((17 * scale).toFixed(2))}px`);
          shell.style.setProperty("--product-small", `${Number((16 * scale).toFixed(2))}px`);
          shell.style.setProperty("--product-meta", `${Number((13 * scale).toFixed(2))}px`);
          shell.style.setProperty("--product-tab", `${Number((14 * scale).toFixed(2))}px`);
        }
        document.querySelectorAll("[data-product-font-value]").forEach((label) => {
          label.textContent = `${Math.round(state.productTextScale * 100)}%`;
        });
      }),
    );
    document.querySelectorAll("[data-search-form]").forEach((form) =>
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const value = new FormData(form).get("q");
        location.hash = `#/search?q=${encodeURIComponent(value || "")}`;
      }),
    );
  }

  function updateClock() {
    const now = new Date();
    const clock = document.querySelector("[data-clock]");
    const date = document.querySelector("[data-date]");
    if (clock)
      clock.textContent = now
        .toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
        .replace(".", ":");
    if (date)
      date.textContent = now.toLocaleDateString("id-ID", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
  }

  // ===== Admin panel =====
  const ADMIN_PASSWORD = "ray2025"; // change in production
  function isAdminAuthed() {
    return sessionStorage.getItem(ADMIN_AUTH_KEY) === "ok";
  }
  function setAdminAuth(v) {
    sessionStorage.setItem(ADMIN_AUTH_KEY, v ? "ok" : "");
  }

  function adminPage(tab) {
    if (!isAdminAuthed()) return adminLoginPage();
    const activeTab = tab || "overview";
    const overrides = loadAdminOverrides();
    const allProducts = products;
    const productOptions = allProducts
      .map(
        (p) =>
          `<option value="${esc(p.id)}">${esc(p.name)} (${esc(p.brand)})</option>`,
      )
      .join("");
    const brandOptions = brands
      .map((b) => `<option value="${esc(b.slug)}">${esc(b.title)}</option>`)
      .join("");

    const tabNav = (key, label) =>
      `<button class="adm-tab ${activeTab === key ? "active" : ""}" data-adm-tab="${key}">${label}</button>`;

    let body = "";
    if (activeTab === "overview") {
      const editCount =
        Object.keys(overrides.brands).length +
        Object.keys(overrides.products).length;
      body = `
        <div class="adm-stats">
          <div class="adm-stat"><span class="num">${brands.length}</span><span class="lbl">Total Brand</span></div>
          <div class="adm-stat"><span class="num">${allProducts.length}</span><span class="lbl">Total Produk</span></div>
          <div class="adm-stat"><span class="num">${editCount}</span><span class="lbl">Telah Diedit</span></div>
          <div class="adm-stat"><span class="num">${ingredients.length}</span><span class="lbl">Bahan Aktif</span></div>
        </div>
        <div class="adm-card">
          <h3>Selamat datang di Admin Panel</h3>
          <p>Semua perubahan disimpan di browser (localStorage). Klik tab di bawah untuk mulai edit:</p>
          <ul class="adm-list">
            <li><strong>Brands</strong> — edit judul, ganti cover image, ubah deskripsi brand & FAQ</li>
            <li><strong>Products</strong> — edit info produk (nama, deskripsi, bahan aktif, cara pakai, FAQ, dll)</li>
            <li><strong>Images</strong> — upload gambar baru untuk cover brand atau foto produk</li>
            <li><strong>Export/Import</strong> — backup semua edit ke file JSON, atau restore dari backup</li>
          </ul>
        </div>`;
    } else if (activeTab === "brands") {
      body = `
        <div class="adm-card adm-card-flat">
          <h3>Edit Brand</h3>
          <div class="adm-selector-row">
            <div class="adm-selector-left">
              <label>Pilih Brand
                <select id="adm-brand-select">${brandOptions}</select>
              </label>
            </div>
          </div>
          <div id="adm-brand-form"></div>
        </div>`;
    } else if (activeTab === "products") {
      // Build brand filter options
      var brandFilterOpts =
        '<option value="">Semua Brand</option>' +
        brands
          .map(function (b) {
            return (
              '<option value="' +
              esc(b.slug) +
              '">' +
              esc(b.title) +
              "</option>"
            );
          })
          .join("");
      body = `
        <div class="adm-card adm-card-flat">
          <h3>Edit Produk</h3>
          <div class="adm-selector-row">
            <div class="adm-selector-left">
              <label>Filter Brand
                <select id="adm-brand-filter">${brandFilterOpts}</select>
              </label>
              <label>Cari Produk
                <input type="text" id="adm-product-search" placeholder="Ketik nama produk...">
              </label>
            </div>
            <div class="adm-selector-right">
              <label>Daftar Produk
                <select id="adm-product-select" size="10"></select>
              </label>
            </div>
          </div>
          <div id="adm-product-form"></div>
        </div>`;
    } else if (activeTab === "export") {
      body = `
        <div class="adm-card">
          <h3>Export & Deploy ke Server</h3>
          <p style="margin-bottom:14px;">Karena html ini static (siap upload ke hosting), ada <strong>2 mode persistensi</strong>:</p>

          <div class="adm-deploy-mode">
            <div class="adm-mode-card">
              <h4>🖥️ Mode Server (Recommended untuk production)</h4>
              <p>Edit disimpan ke file <code>data-overrides.json</code> di server → semua user lihat edit yang sama setelah deploy.</p>
              <div class="adm-row">
                <button class="adm-btn primary" data-adm-deploy>Download JSON untuk Deploy</button>
              </div>
              <p class="adm-hint">Setelah download, taruh file di <code>public/assets/data-overrides.json</code>, deploy ke server. Semua client akan auto-fetch file ini.</p>
            </div>

            <div class="adm-mode-card">
              <h4>💾 Mode Browser (Local)</h4>
              <p>Edit disimpan di localStorage browser ini. Hilang jika clear cache atau pindah device.</p>
              <div class="adm-row">
                <button class="adm-btn" data-adm-export>Export JSON (download)</button>
                <label class="adm-btn">Import JSON
                  <input type="file" accept="application/json" hidden data-adm-import>
                </label>
                <button class="adm-btn danger" data-adm-clear>Reset Semua Edit</button>
              </div>
            </div>
          </div>

          <h4 style="margin-top:24px;">Preview data tersimpan (localStorage):</h4>
          <pre id="adm-export-preview" class="adm-pre"></pre>
        </div>`;
    }

    const content = `
      <section class="adm-shell">
        <header class="adm-header">
          <h2>Admin Panel — RAY Knowledge</h2>
          <div class="adm-header-actions">
            <a href="#/home" class="adm-btn ghost">Lihat Site</a>
            <button class="adm-btn danger" data-adm-logout>Logout</button>
          </div>
        </header>
        <nav class="adm-tabs">${tabNav("overview", "Overview")}${tabNav("brands", "Brands")}${tabNav("products", "Products")}${tabNav("export", "Export/Import")}</nav>
        <div class="adm-body">${body}</div>
      </section>
    `;
    shell(content, { title: "Admin", className: "admin-mode" });
    bindAdminHandlers(activeTab);
  }

  function adminLoginPage() {
    const content = `
      <section class="adm-login">
        <div class="adm-login-card">
          <h2>🔒 Admin Panel</h2>
          <p>Masukkan password admin untuk melanjutkan.</p>
          <form data-adm-login>
            <input type="password" name="pwd" placeholder="Password" autofocus required>
            <button type="submit" class="adm-btn primary">Masuk</button>
          </form>
          <p class="adm-hint">Default password: <code>ray2025</code></p>
        </div>
      </section>`;
    shell(content, { title: "Login Admin", className: "admin-mode" });
    bindAdminHandlers("login");
  }

  function bindAdminHandlers(tab) {
    // Tab navigation
    document.querySelectorAll("[data-adm-tab]").forEach((b) => {
      b.addEventListener("click", () => {
        location.hash = `#/admin/${b.dataset.admTab}`;
      });
    });
    // Logout
    const lo = document.querySelector("[data-adm-logout]");
    if (lo)
      lo.addEventListener("click", () => {
        setAdminAuth(false);
        location.hash = "#/admin";
      });
    // Login form
    const lf = document.querySelector("[data-adm-login]");
    if (lf)
      lf.addEventListener("submit", (e) => {
        e.preventDefault();
        const pwd = e.target.pwd.value;
        if (pwd === ADMIN_PASSWORD) {
          setAdminAuth(true);
        } else {
          alert("Password salah");
        }
      });
    // Brand form
    if (tab === "brands") renderAdminBrandForm();
    if (tab === "products") renderAdminProductForm();
    if (tab === "export") bindExportImport();
  }

  // Global dropzone init — call once after render
  function initDropzones() {
    document.querySelectorAll(".adm-dz").forEach(function (dz) {
      var id = dz.dataset.dzId;
      if (dz.dataset.dzBound) return;
      dz.dataset.dzBound = "1";
      var input = dz.querySelector(".adm-dz-input");
      var img = dz.querySelector("img");
      var placeholder = dz.querySelector(".adm-dz-placeholder");
      var clearBtn = dz.querySelector("[data-dz-clear]");
      var currentSrc = img && img.src;

      dz.addEventListener("click", function (e) {
        if (e.target !== clearBtn) input.click();
      });
      dz.addEventListener("dragover", function (e) {
        e.preventDefault();
        dz.classList.add("drag-over");
      });
      dz.addEventListener("dragleave", function () {
        dz.classList.remove("drag-over");
      });
      dz.addEventListener("drop", function (e) {
        e.preventDefault();
        dz.classList.remove("drag-over");
        var file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) showPreview(file);
      });
      input.addEventListener("change", function () {
        if (this.files[0]) showPreview(this.files[0]);
      });
      if (clearBtn)
        clearBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          if (img) {
            img.src = currentSrc || "";
            img.classList.toggle("is-loaded", !!currentSrc);
          }
          if (placeholder)
            placeholder.style.display = currentSrc ? "none" : "flex";
          input.value = "";
          if (window._dzCallbacks) window._dzCallbacks[id] = null;
        });

      // Show placeholder on img error
      if (img) {
        img.onerror = function () {
          img.style.display = "none";
          img.classList.remove("is-loaded");
          if (placeholder) placeholder.style.display = "flex";
        };
      }

      function showPreview(file) {
        var r = new FileReader();
        r.onload = function (e) {
          if (img) {
            img.src = e.target.result;
            img.classList.add("is-loaded");
          }
          if (placeholder) placeholder.style.display = "none";
          window._dzCallbacks = window._dzCallbacks || {};
          window._dzCallbacks[id] = e.target.result;
        };
        r.readAsDataURL(file);
      }
    });
  }

  function dropzoneImage(label, currentSrc) {
    var id = "dz-" + Math.random().toString(36).slice(2, 8);
    var hasImage = currentSrc && currentSrc.length > 0;
    return (
      '<div class="adm-dz" data-dz-id="' +
      id +
      '">' +
      '<div class="adm-dz-preview">' +
      (hasImage
        ? '<img src="' + esc(currentSrc) + '" alt="preview" class="is-loaded">'
        : '<img src="" alt="preview">') +
      '<div class="adm-dz-placeholder"' +
      (hasImage ? ' style="display:none"' : "") +
      ">" +
      '<span class="adm-dz-icon">+</span>' +
      "<span>Drag &amp; drop gambar di sini<br><small>atau klik untuk pilih file</small></span>" +
      "</div>" +
      "</div>" +
      '<input type="file" accept="image/*" class="adm-dz-input">' +
      '<button type="button" class="adm-btn small" data-dz-clear>Hapus gambar</button>' +
      "</div>"
    );
  }

  function collabCards(existing) {
    if (!existing || !existing.length) {
      return '<div class="adm-collab-list" data-collab-list></div>';
    }
    var html = '<div class="adm-collab-list" data-collab-list>';
    existing.forEach(function (c, i) {
      var name = (c && c.name) || "";
      var role = (c && c.role) || "";
      var img = webpAssetPath((c && c.image) || "");
      html +=
        '<div class="adm-collab-item" data-collab-idx="' +
        i +
        '">' +
        '<div class="adm-collab-photo-row">' +
        '<img class="adm-collab-thumb" src="' +
        esc(img) +
        '" alt="" data-default-src="' +
        esc(img) +
        '">' +
        '<div class="adm-collab-upload"><button type="button" class="adm-btn small" data-collab-upload="' +
        i +
        '">Upload Foto</button>' +
        '<input type="file" accept="image/*" hidden data-collab-file="' +
        i +
        '"></div>' +
        "</div>" +
        '<div class="adm-collab-fields">' +
        '<input type="text" placeholder="Nama lengkap (gelar)" value="' +
        esc(name) +
        '" data-collab-name="' +
        i +
        '">' +
        '<input type="text" placeholder="Peran / spesialisasi" value="' +
        esc(role) +
        '" data-collab-role="' +
        i +
        '">' +
        "</div>" +
        '<button type="button" class="adm-faq-del" data-collab-del="' +
        i +
        '" title="Hapus kolaborator">x</button>' +
        "</div>";
    });
    html += "</div>";
    return html;
  }

  function faqCards(existing, fieldPrefix) {
    if (!existing || !existing.length) {
      return `<div class="adm-faq-list" data-faq-list="${fieldPrefix}"></div>
        <button type="button" class="adm-btn ghost small" data-faq-add="${fieldPrefix}">+ Tambah FAQ</button>`;
    }
    var html = '<div class="adm-faq-list" data-faq-list="' + fieldPrefix + '">';
    existing.forEach(function (f, i) {
      var q = typeof f === "string" ? f : f.question || "";
      var a = typeof f === "string" ? "" : f.answer || "";
      html +=
        '<div class="adm-faq-item" data-faq-idx="' +
        i +
        '">' +
        '<div class="adm-faq-num">' +
        (i + 1) +
        "</div>" +
        '<div class="adm-faq-fields">' +
        '<input type="text" placeholder="Pertanyaan" value="' +
        esc(q) +
        '" data-faq-q="' +
        i +
        '">' +
        '<textarea placeholder="Jawaban" rows="2" data-faq-a="' +
        i +
        '">' +
        esc(a) +
        "</textarea>" +
        "</div>" +
        '<button type="button" class="adm-faq-del" data-faq-del="' +
        i +
        '" title="Hapus FAQ">x</button>' +
        "</div>";
    });
    html += "</div>";
    html +=
      '<button type="button" class="adm-btn ghost small" data-faq-add="' +
      fieldPrefix +
      '">+ Tambah FAQ</button>';
    return html;
  }

  function renderAdminBrandForm() {
    var sel = document.getElementById("adm-brand-select");
    var target = document.getElementById("adm-brand-form");
    if (!sel || !target) return;

    function build(slug) {
      var b = brands.find(function (x) {
        return x.slug === slug;
      });
      if (!b) return;
      var p = b.mainProfile || {};
      var overrides = loadAdminOverrides();
      var edits = overrides.brands[b.slug] || {};
      var faq = (edits.profile && edits.profile.faq) || p.faq || [];
      var collab =
        (edits.profile && edits.profile.collaborators) || p.collaborators || [];
      var sigIng =
        (edits.profile && edits.profile.signatureIngredient) ||
        p.signatureIngredient;
      var imageSrc = webpAssetPath(edits.image || b.image || "");

      target.innerHTML = `
        <div class="adm-section-head">
          <h3>Edit Brand: <span>${esc(b.title)}</span></h3>
          <div class="adm-section-actions">
            <button class="adm-btn danger small" data-adm-reset-brand="${esc(slug)}">Reset</button>
            <button class="adm-btn primary" data-adm-save-brand="${esc(slug)}">Simpan Perubahan</button>
          </div>
          <p class="adm-status" data-adm-status-brand></p>
        </div>

        <div class="adm-panel-grid">
          <!-- KIRI: Teks + Meta -->
          <div class="adm-panel-col">
            <div class="adm-field-group">
              <div class="adm-field-row">
                <label>Nama Brand <span class="req">*</span>
                  <input type="text" data-adm-field="title" value="${esc(edits.title || b.title)}" placeholder="cth: BEAUTY SCAPE">
                </label>
                <label>Kategori / Eyebrow
                  <input type="text" data-adm-field="profile.eyebrow" value="${esc((edits.profile && edits.profile.eyebrow) || p.eyebrow || "")}" placeholder="cth: Premium Skincare">
                </label>
              </div>

              <label>Category (tampil di brand tile)
                <input type="text" data-adm-field="profile.category" value="${esc((edits.profile && edits.profile.category) || p.category || "")}" placeholder="cth: Skincare Premium">
              </label>

              <label>Subheadline
                <textarea data-adm-field="profile.subheadline" rows="2" placeholder="Satu kalimat promo brand">${esc((edits.profile && edits.profile.subheadline) || p.subheadline || "")}</textarea>
              </label>

              <label>Deskripsi Singkat
                <textarea data-adm-field="profile.shortDescription" rows="2" placeholder="Penjelasan singkat brand">${esc((edits.profile && edits.profile.shortDescription) || p.shortDescription || "")}</textarea>
              </label>

              <label>Deskripsi Panjang (paragraf — pisahkan dengan enter ganda)
                <textarea data-adm-field="profile.longDescription" rows="5" placeholder="Deskripsi lengkap brand, pisahkan paragraf dengan baris kosong">${esc((edits.profile && edits.profile.longDescription) || p.longDescription || "")}</textarea>
              </label>

              <div class="adm-field-row">
                <label>Prinsip / Principle
                  <input type="text" data-adm-field="profile.principle" value="${esc((edits.profile && edits.profile.principle) || p.principle || "")}" placeholder="cth: 4 Pilar Formulasi Sinergis">
                </label>
                <label>Target Audiens
                  <input type="text" data-adm-field="profile.targetAudience" value="${esc((edits.profile && edits.profile.targetAudience) || p.targetAudience || "")}" placeholder="cth: Dewasa 20-50+">
                </label>
              </div>

              <label>Tag Pencarian (pisahkan dengan koma)
                <input type="text" data-adm-field="profile.searchTags" value="${esc((edits.profile && edits.profile.searchTags) || p.searchTags || "")}" placeholder="cth: sunscreen, SPF50, anti-aging">
              </label>
            </div>

            <!-- Signature Ingredient -->
            <div class="adm-field-group adm-sub-section">
              <h4>Signature Ingredient</h4>
              <div class="adm-field-row">
                <label>Nama Bahan
                  <input type="text" data-adm-field="profile.signatureIngredient.name" value="${esc((sigIng && sigIng.name) || "")}" placeholder="cth: Niacinamide">
                </label>
                <label>Jumlah Produk Pakai
                  <input type="number" min="0" data-adm-field="profile.signatureIngredient.uses" value="${esc(String((sigIng && sigIng.uses) || ""))}" placeholder="cth: 3">
                </label>
              </div>
              <label>Deskripsi Signature Ingredient
                <textarea data-adm-field="profile.signatureIngredient.description" rows="2" placeholder="Penjelasan bahan signature brand">${esc((sigIng && sigIng.description) || "")}</textarea>
              </label>
            </div>

            <!-- FAQ -->
            <div class="adm-field-group adm-sub-section">
              <h4>FAQ Brand</h4>
              ${faqCards(faq, "brand")}
            </div>

            <!-- Kolaborasi -->
            <div class="adm-field-group adm-sub-section">
              <h4>Kolaborasi (Opsional)</h4>
              <p class="adm-hint">Tampilkan nama profesional/guest expert yang berkolaborasi pada brand ini. Tidak semua brand punya kolaborasi.</p>
              ${collabCards(collab)}
              <div style="display:flex;gap:8px;margin-top:10px;">
                <button type="button" class="adm-btn ghost small" data-collab-add>+ Tambah Kolaborator</button>
              </div>
            </div>
          </div>

          <!-- KANAN: Gambar Cover -->
          <div class="adm-panel-col adm-panel-image">
            <div class="adm-field-group">
              <h4>Cover Image Brand</h4>
              <p class="adm-hint">Gambar yang tampil sebagai hero brand. Rekomendasi: 1280x720px, landscape.</p>
              ${dropzoneImage("cover", imageSrc)}
              <p class="adm-hint" style="margin-top:8px;">Gunakan tombol Hapus gambar untuk reset ke gambar asli.</p>
            </div>

            <!-- Preview Tile -->
            <div class="adm-field-group adm-sub-section">
              <h4>Preview Brand Tile</h4>
              <div class="adm-tile-preview">
                <div class="adm-tile-inner" style="background-image:url(${esc(imageSrc)});">
                  <div class="adm-tile-overlay">
                    <strong>${esc(edits.title || b.title)}</strong>
                    <small>${esc((edits.profile && edits.profile.category) || p.category || "")}</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      bindBrandFormEvents(slug);
      initDropzones();
    }

    sel.value = sel.value || brands[0].slug;
    build(sel.value);
    sel.addEventListener("change", function () {
      build(sel.value);
    });
  }

  function bindBrandFormEvents(slug) {
    // FAQ dynamic add
    document.querySelectorAll("[data-faq-add]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var list = document.querySelector("[data-faq-list]");
        if (!list) return;
        var idx = list.querySelectorAll(".adm-faq-item").length;
        var item = document.createElement("div");
        item.className = "adm-faq-item";
        item.innerHTML =
          '<div class="adm-faq-num">' +
          (idx + 1) +
          "</div>" +
          '<div class="adm-faq-fields">' +
          '<input type="text" placeholder="Pertanyaan" data-faq-q="' +
          idx +
          '">' +
          '<textarea placeholder="Jawaban" rows="2" data-faq-a="' +
          idx +
          '"></textarea>' +
          "</div>" +
          '<button type="button" class="adm-faq-del" data-faq-del="' +
          idx +
          '" title="Hapus FAQ">x</button>';
        list.appendChild(item);
        reindexFAQ(list);
        item.querySelector("input").focus();
      });
    });

    // FAQ delete
    document.querySelectorAll("[data-faq-del]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.closest(".adm-faq-item");
        if (item) {
          item.remove();
          reindexFAQ(item.parentElement);
        }
      });
    });

    // FAQ reindex
    function reindexFAQ(list) {
      if (!list) return;
      list.querySelectorAll(".adm-faq-item").forEach(function (item, i) {
        item.querySelector(".adm-faq-num").textContent = i + 1;
        var oldQ = item.querySelector("[data-faq-q]");
        var oldA = item.querySelector("[data-faq-a]");
        if (oldQ) oldQ.setAttribute("data-faq-q", i);
        if (oldA) oldA.setAttribute("data-faq-a", i);
        var delBtn = item.querySelector("[data-faq-del]");
        if (delBtn) delBtn.setAttribute("data-faq-del", i);
      });
    }

    // ===== Collaboration handlers =====
    function reindexCollab(list) {
      if (!list) return;
      list.querySelectorAll(".adm-collab-item").forEach(function (item, i) {
        var name = item.querySelector("[data-collab-name]");
        var role = item.querySelector("[data-collab-role]");
        var file = item.querySelector("[data-collab-file]");
        var upBtn = item.querySelector("[data-collab-upload]");
        var delBtn = item.querySelector("[data-collab-del]");
        if (name) name.setAttribute("data-collab-name", i);
        if (role) role.setAttribute("data-collab-role", i);
        if (file) file.setAttribute("data-collab-file", i);
        if (upBtn) upBtn.setAttribute("data-collab-upload", i);
        if (delBtn) delBtn.setAttribute("data-collab-del", i);
      });
    }

    document.querySelectorAll("[data-collab-add]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var list = document.querySelector("[data-collab-list]");
        if (!list) return;
        var idx = list.querySelectorAll(".adm-collab-item").length;
        var item = document.createElement("div");
        item.className = "adm-collab-item";
        item.setAttribute("data-collab-idx", idx);
        item.innerHTML =
          '<div class="adm-collab-photo-row">' +
          '<img class="adm-collab-thumb" src="" alt="" data-default-src="">' +
          '<div class="adm-collab-upload"><button type="button" class="adm-btn small" data-collab-upload="' +
          idx +
          '">Upload Foto</button>' +
          '<input type="file" accept="image/*" hidden data-collab-file="' +
          idx +
          '"></div>' +
          "</div>" +
          '<div class="adm-collab-fields">' +
          '<input type="text" placeholder="Nama lengkap (gelar)" data-collab-name="' +
          idx +
          '">' +
          '<input type="text" placeholder="Peran / spesialisasi" data-collab-role="' +
          idx +
          '">' +
          "</div>" +
          '<button type="button" class="adm-faq-del" data-collab-del="' +
          idx +
          '" title="Hapus kolaborator">x</button>';
        list.appendChild(item);
        reindexCollab(list);
        bindCollabItemEvents(item);
        item.querySelector("input[data-collab-name]").focus();
      });
    });

    document.querySelectorAll(".adm-collab-item").forEach(bindCollabItemEvents);

    document.querySelectorAll("[data-collab-del]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.closest(".adm-collab-item");
        if (item) {
          item.remove();
          var list = item.parentElement;
          if (list) reindexCollab(list);
        }
      });
    });

    function bindCollabItemEvents(item) {
      var upBtn = item.querySelector("[data-collab-upload]");
      var fileInput = item.querySelector("[data-collab-file]");
      var thumb = item.querySelector(".adm-collab-thumb");
      if (upBtn && fileInput) {
        upBtn.addEventListener("click", function () {
          fileInput.click();
        });
        fileInput.addEventListener("change", function () {
          var f = this.files && this.files[0];
          if (!f) return;
          var r = new FileReader();
          r.onload = function (ev) {
            if (thumb) {
              thumb.src = ev.target.result;
              thumb.dataset.newSrc = ev.target.result;
            }
          };
          r.readAsDataURL(f);
        });
      }
    }

    // Save
    var saveBtn = document.querySelector("[data-adm-save-brand]");
    if (saveBtn)
      saveBtn.addEventListener("click", function () {
        var o = loadAdminOverrides();
        o.brands[slug] = o.brands[slug] || {};

        var get = function (sel) {
          var el = document.querySelector('[data-adm-field="' + sel + '"]');
          return el ? el.value : "";
        };

        var title = get("title");
        if (title) o.brands[slug].title = title;

        // Profile fields
        var profileFields = [
          "eyebrow",
          "category",
          "subheadline",
          "shortDescription",
          "longDescription",
          "principle",
          "targetAudience",
          "searchTags",
        ];
        var profile = {};
        profileFields.forEach(function (k) {
          var v = get("profile." + k);
          if (v) profile[k] = v;
        });

        // Signature ingredient
        var sigName = get("profile.signatureIngredient.name");
        var sigUses = get("profile.signatureIngredient.uses");
        var sigDesc = get("profile.signatureIngredient.description");
        if (sigName || sigDesc) {
          var sig = {};
          if (sigName) sig.name = sigName;
          if (sigUses) sig.uses = parseInt(sigUses) || 0;
          if (sigDesc) sig.description = sigDesc;
          profile.signatureIngredient = sig;
        }

        // FAQ
        var faqList = document.querySelector("[data-faq-list]");
        if (faqList) {
          var faqItems = [];
          faqList.querySelectorAll(".adm-faq-item").forEach(function (item) {
            var q = item.querySelector("[data-faq-q]");
            var a = item.querySelector("[data-faq-a]");
            if (q && q.value.trim()) {
              faqItems.push({
                question: q.value.trim(),
                answer: a ? a.value.trim() : "",
              });
            }
          });
          if (faqItems.length) profile.faq = faqItems;
        }

        // Kolaborasi
        var collabList = document.querySelector("[data-collab-list]");
        if (collabList) {
          var collabItems = [];
          collabList
            .querySelectorAll(".adm-collab-item")
            .forEach(function (item) {
              var nameInp = item.querySelector("[data-collab-name]");
              var roleInp = item.querySelector("[data-collab-role]");
              var thumb = item.querySelector(".adm-collab-thumb");
              var name = nameInp ? nameInp.value.trim() : "";
              if (!name) return;
              var image =
                thumb && thumb.dataset.newSrc
                  ? thumb.dataset.newSrc
                  : thumb && thumb.dataset.defaultSrc
                    ? thumb.dataset.defaultSrc
                    : "";
              collabItems.push({
                name: name,
                role: roleInp ? roleInp.value.trim() : "",
                image: image,
              });
            });
          profile.collaborators = collabItems;
        }

        if (Object.keys(profile).length) o.brands[slug].profile = profile;

        // Image from dropzone
        var dzData = window._dzCallbacks || {};
        var dzId = document.querySelector(".adm-dz-input");
        if (dzId) {
          var keys = Object.keys(dzData);
          for (var i = 0; i < keys.length; i++) {
            if (dzData[keys[i]]) {
              o.brands[slug].image = dzData[keys[i]];
              break;
            }
          }
        }

        saveAdminOverrides(o);
        var status = document.querySelector("[data-adm-status-brand]");
        if (status) {
          status.innerHTML =
            '<span style="color:#059669;font-weight:700;">&#10003; Tersimpan!</span> Buka tab Brands atau halaman brand untuk lihat perubahan.';
          status.className = "adm-status ok";
        }
      });

    // Reset
    var resetBtn = document.querySelector("[data-adm-reset-brand]");
    if (resetBtn)
      resetBtn.addEventListener("click", function () {
        if (confirm("Reset semua edit untuk brand ini?")) {
          var o = loadAdminOverrides();
          delete o.brands[slug];
          saveAdminOverrides(o);
          renderAdminBrandForm();
        }
      });
  }

  function renderAdminProductForm() {
    var sel = document.getElementById("adm-product-select");
    var search = document.getElementById("adm-product-search");
    var brandFilter = document.getElementById("adm-brand-filter");
    var target = document.getElementById("adm-product-form");
    if (!sel || !target) return;

    function build(id) {
      var p = products.find(function (x) {
        return x.id === id;
      });
      if (!p) {
        target.innerHTML =
          '<div class="adm-empty-state">Pilih produk dari daftar di atas untuk mulai mengedit.</div>';
        return;
      }
      var overrides = loadAdminOverrides();
      var edits = overrides.products[p.id] || {};
      var imageSrc = webpAssetPath(edits.image || p.image || "");
      var faq = edits.faq || p.faq || [];

      target.innerHTML = `
        <div class="adm-section-head">
          <h3>Edit Produk: <span>${esc(edits.name || p.name)}</span></h3>
          <div class="adm-section-actions">
            <a class="adm-btn ghost small" href="${href("product", id)}" target="_blank" style="text-decoration:none;">Preview &#8599;</a>
            <button class="adm-btn danger small" data-adm-reset-product="${esc(id)}">Reset</button>
            <button class="adm-btn primary" data-adm-save-product="${esc(id)}">Simpan Perubahan</button>
          </div>
          <p class="adm-status" data-adm-status-product></p>
        </div>

        <div class="adm-panel-grid">
          <!-- KIRI -->
          <div class="adm-panel-col">
            <!-- Info Dasar -->
            <div class="adm-field-group">
              <h4>Informasi Dasar</h4>
              <div class="adm-field-row">
                <label>Nama Produk <span class="req">*</span>
                  <input type="text" data-adm-field="name" value="${esc(edits.name || p.name)}" placeholder="cth: Acne Recovery Serum">
                </label>
                <label>Kategori
                  <input type="text" data-adm-field="category" value="${esc(edits.category || p.category || "")}" placeholder="cth: Acne Care Serum">
                </label>
              </div>
              <div class="adm-field-row">
                <label>Kode Produk
                  <input type="text" data-adm-field="code" value="${esc(edits.code || p.code || "")}" placeholder="cth: BS-AC-01">
                </label>
                <label>Ukuran / Netto
                  <input type="text" data-adm-field="size" value="${esc(edits.size || p.size || "")}" placeholder="cth: 30 mL">
                </label>
              </div>
              <label>Tagline (1 baris promo)
                <input type="text" data-adm-field="tagline" value="${esc(edits.tagline || p.tagline || "")}" placeholder="cth: Serum untuk kulit berjerawat...">
              </label>
              <label>Card Copy (tampilan di kartu produk)
                <input type="text" data-adm-field="cardCopy" value="${esc(edits.cardCopy || p.cardCopy || "")}" placeholder="cth: Serum untuk kulit berjerawat...">
              </label>
            </div>

            <!-- Deskripsi -->
            <div class="adm-field-group adm-sub-section">
              <h4>Deskripsi</h4>
              <label>Deskripsi Singkat (paragraf utama)
                <textarea data-adm-field="description" rows="3" placeholder="Deskripsi teknis produk">${esc(edits.description || p.description || "")}</textarea>
              </label>
              <label>Detail Copy (marketing panjang, pisahkan paragraf dengan enter)
                <textarea data-adm-field="detailCopy" rows="5" placeholder="Copy marketing detail...">${esc(edits.detailCopy || p.detailCopy || "")}</textarea>
              </label>
              <label>USP (Unique Selling Proposition)
                <input type="text" data-adm-field="usp" value="${esc(edits.usp || p.usp || "")}" placeholder="cth: Kombinasi Niacinamide...">
              </label>
            </div>

            <!-- Target -->
            <div class="adm-field-group adm-sub-section">
              <h4>Target & Keamanan</h4>
              <div class="adm-field-row">
                <label>Target Pengguna
                  <input type="text" data-adm-field="targetUsers" value="${esc(edits.targetUsers || p.targetUsers || "")}" placeholder="cth: Kulit berjerawat, oily...">
                </label>
              </div>
              <label>Safety Notes
                <textarea data-adm-field="safety" rows="2" placeholder="Petunjuk keamanan & warning">${esc(edits.safety || p.safety || "")}</textarea>
              </label>
              <label>Storage / Penyimpanan
                <textarea data-adm-field="storage" rows="2" placeholder="Cara penyimpanan">${esc(edits.storage || p.storage || "")}</textarea>
              </label>
              <label>Storage Extra (PAO, expired)
                <input type="text" data-adm-field="storageExtra" value="${esc(edits.storageExtra || p.storageExtra || "")}" placeholder="cth: Best before 24 bulan...">
              </label>
              <label>Hal yang Harus Dihindari
                <textarea data-adm-field="avoid" rows="2" placeholder="Things to avoid">${esc(edits.avoid || p.avoid || "")}</textarea>
              </label>
            </div>
          </div>

          <!-- KANAN: Ingredients, Benefits, Usage, FAQ, Image -->
          <div class="adm-panel-col">
            <!-- Bahan Aktif -->
            <div class="adm-field-group">
              <h4>Bahan Aktif</h4>
              <label class="adm-label-note">Hero Ingredients — 3 utama (satu per baris)<br><span class="adm-hint-inline">Format: Nama Bahan — Fungsi</span>
                <textarea data-adm-field="heroIngredients" rows="3" placeholder="Niacinamide — mengontrol minyak">${esc((edits.heroIngredients || p.heroIngredients || []).join("\n"))}</textarea>
              </label>
              <label class="adm-label-note">Semua Bahan Aktif (satu per baris)
                <textarea data-adm-field="ingredients" rows="6" placeholder="Niacinamide — mengontrol minyak...">${esc((edits.ingredients || p.ingredients || []).join("\n"))}</textarea>
              </label>
            </div>

            <!-- Benefits -->
            <div class="adm-field-group adm-sub-section">
              <h4>Benefits / Manfaat</h4>
              <label class="adm-label-note">Satu manfaat per baris
                <textarea data-adm-field="benefits" rows="5" placeholder="Mengontrol produksi minyak...">${esc((edits.benefits || p.benefits || []).join("\n"))}</textarea>
              </label>
            </div>

            <!-- FAQ -->
            <div class="adm-field-group adm-sub-section">
              <h4>FAQ Produk</h4>
              ${faqCards(faq, "product")}
            </div>

            <!-- Product Image -->
            <div class="adm-field-group adm-sub-section">
              <h4>Foto Produk</h4>
              <p class="adm-hint">Upload foto produk individual. Jika tidak ada, akan gunakan visual brand sebagai fallback.</p>
              ${dropzoneImage("product", imageSrc)}
            </div>
          </div>
        </div>
      `;

      bindProductFormEvents(id);
      initDropzones();
    }

    // Populate select with search
    function refreshOptions(q, brandSlug) {
      while (sel.options.length) sel.remove(0);
      products.forEach(function (p) {
        var text = p.name + " (" + (p.brand || "") + ")";
        var normText = normalize(text);
        var normQ = normalize(q || "");
        var show =
          (!normQ || normText.includes(normQ)) &&
          (!brandSlug || (p.brandRecord && p.brandRecord.slug === brandSlug));
        if (show) {
          var opt = document.createElement("option");
          opt.value = p.id;
          opt.text = text;
          sel.appendChild(opt);
        }
      });
      if (sel.options.length === 0) {
        var opt = document.createElement("option");
        opt.value = "";
        opt.text = "Tidak ada produk ditemukan";
        opt.disabled = true;
        sel.appendChild(opt);
      }
    }

    refreshOptions("", brandFilter && brandFilter.value);
    sel.value = sel.value || (products[0] && products[0].id) || "";
    build(sel.value);

    sel.addEventListener("change", function () {
      build(sel.value);
    });

    if (search) {
      search.addEventListener("input", function () {
        refreshOptions(search.value, brandFilter && brandFilter.value);
      });
    }
    if (brandFilter) {
      brandFilter.addEventListener("change", function () {
        refreshOptions((search && search.value) || "", brandFilter.value);
      });
    }
  }

  function bindProductFormEvents(id) {
    // FAQ dynamic add
    document.querySelectorAll("[data-faq-add]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var list = document.querySelector("[data-faq-list]");
        if (!list) return;
        var idx = list.querySelectorAll(".adm-faq-item").length;
        var item = document.createElement("div");
        item.className = "adm-faq-item";
        item.innerHTML =
          '<div class="adm-faq-num">' +
          (idx + 1) +
          "</div>" +
          '<div class="adm-faq-fields">' +
          '<input type="text" placeholder="Pertanyaan" data-faq-q="' +
          idx +
          '">' +
          '<textarea placeholder="Jawaban" rows="2" data-faq-a="' +
          idx +
          '"></textarea>' +
          "</div>" +
          '<button type="button" class="adm-faq-del" data-faq-del="' +
          idx +
          '" title="Hapus FAQ">x</button>';
        list.appendChild(item);
        reindexProductFAQ(list);
        item.querySelector("input").focus();
      });
    });

    // FAQ delete
    document.querySelectorAll("[data-faq-del]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.closest(".adm-faq-item");
        if (item) {
          item.remove();
          reindexProductFAQ(item.parentElement);
        }
      });
    });

    function reindexProductFAQ(list) {
      if (!list) return;
      list.querySelectorAll(".adm-faq-item").forEach(function (item, i) {
        item.querySelector(".adm-faq-num").textContent = i + 1;
        var q = item.querySelector("[data-faq-q]");
        var a = item.querySelector("[data-faq-a]");
        var del = item.querySelector("[data-faq-del]");
        if (q) q.setAttribute("data-faq-q", i);
        if (a) a.setAttribute("data-faq-a", i);
        if (del) del.setAttribute("data-faq-del", i);
      });
    }

    // Save
    var saveBtn = document.querySelector("[data-adm-save-product]");
    if (saveBtn)
      saveBtn.addEventListener("click", function () {
        var o = loadAdminOverrides();
        o.products[id] = o.products[id] || {};

        var get = function (sel) {
          var el = document.querySelector('[data-adm-field="' + sel + '"]');
          return el ? el.value : "";
        };

        var getLines = function (sel) {
          var el = document.querySelector('[data-adm-field="' + sel + '"]');
          if (!el) return [];
          return el.value
            .split("\n")
            .map(function (x) {
              return x.trim();
            })
            .filter(Boolean);
        };

        // Text fields
        var textFields = [
          "name",
          "category",
          "code",
          "size",
          "tagline",
          "cardCopy",
          "description",
          "detailCopy",
          "usp",
          "targetUsers",
          "safety",
          "storage",
          "storageExtra",
          "avoid",
        ];
        textFields.forEach(function (k) {
          var v = get(k);
          if (v) o.products[id][k] = v;
        });

        // Array fields
        var arrayFields = ["heroIngredients", "ingredients", "benefits"];
        arrayFields.forEach(function (k) {
          var v = getLines(k);
          if (v.length) o.products[id][k] = v;
        });

        // FAQ
        var faqList = document.querySelector("[data-faq-list]");
        if (faqList) {
          var faqItems = [];
          faqList.querySelectorAll(".adm-faq-item").forEach(function (item) {
            var q = item.querySelector("[data-faq-q]");
            var a = item.querySelector("[data-faq-a]");
            if (q && q.value.trim()) {
              faqItems.push({
                question: q.value.trim(),
                answer: a ? a.value.trim() : "",
              });
            }
          });
          if (faqItems.length) o.products[id].faq = faqItems;
        }

        // Image from dropzone
        var dzData = window._dzCallbacks || {};
        var keys = Object.keys(dzData);
        for (var i = 0; i < keys.length; i++) {
          if (dzData[keys[i]]) {
            o.products[id].image = dzData[keys[i]];
            break;
          }
        }

        saveAdminOverrides(o);
        var status = document.querySelector("[data-adm-status-product]");
        if (status) {
          status.innerHTML =
            '<span style="color:#059669;font-weight:700;">&#10003; Tersimpan!</span> Buka tab produk atau klik Preview untuk lihat perubahan.';
          status.className = "adm-status ok";
        }
      });

    // Reset
    var resetBtn = document.querySelector("[data-adm-reset-product]");
    if (resetBtn)
      resetBtn.addEventListener("click", function () {
        if (confirm("Reset semua edit untuk produk ini?")) {
          var o = loadAdminOverrides();
          delete o.products[id];
          saveAdminOverrides(o);
          renderAdminProductForm();
        }
      });
  }

  function bindExportImport() {
    const exp = document.querySelector("[data-adm-export]");
    const imp = document.querySelector("[data-adm-import]");
    const clr = document.querySelector("[data-adm-clear]");
    const deploy = document.querySelector("[data-adm-deploy]");
    const preview = document.getElementById("adm-export-preview");
    const data = loadAdminOverrides();
    if (preview) preview.textContent = JSON.stringify(data, null, 2);
    if (exp)
      exp.addEventListener("click", () => {
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ray-kb-overrides-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    if (deploy)
      deploy.addEventListener("click", async () => {
        const o = loadAdminOverrides();
        const confirmed = confirm(
          `Download file data-overrides.json?\n\n` +
            `Setelah download, TARUH file di:\n  public/assets/data-overrides.json\n\n` +
            `Lalu deploy ulang ke server.\n\n` +
            `Semua client akan auto-fetch file ini di load berikutnya.\n` +
            `Stats: ${Object.keys(o.brands || {}).length} brand edits, ${Object.keys(o.products || {}).length} product edits.`,
        );
        if (confirmed) await saveServerOverrides(o);
      });
    if (imp)
      imp.addEventListener("change", (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => {
          try {
            const json = JSON.parse(r.result);
            saveAdminOverrides(json);
            alert("✓ Import berhasil. Refresh halaman.");
            location.reload();
          } catch (err) {
            alert("File JSON tidak valid: " + err.message);
          }
        };
        r.readAsText(f);
      });
    if (clr)
      clr.addEventListener("click", () => {
        if (
          confirm("Hapus semua edit admin? Tindakan ini tidak bisa dibatalkan.")
        ) {
          localStorage.removeItem(ADMIN_KEY);
          location.reload();
        }
      });
  }

  function render() {
    const current = route();
    state.productTab = current.name === "product" ? state.productTab : "info";
    window.scrollTo(0, 0);
    if (current.name === "home" || current.name === "") homePage();
    else if (current.name === "brands") brandsPage();
    else if (current.name === "brand") brandPage(current.id);
    else if (current.name === "product") productPage(current.id);
    else if (current.name === "ingredient") ingredientPage(current.id);
    else if (current.name === "search") searchPage(current.params.get("q"));
    else if (current.name === "admin")
      adminPage(current.id || current.params.get("tab"));
    else notFound();
    const title =
      current.name === "product"
        ? products.find((item) => item.id === current.id)?.name
        : current.name === "brand"
          ? currentBrandName(brands.find((item) => item.slug === current.id))
          : "RAY Product Knowledge";
    document.title = `${title || "RAY Product Knowledge"} — RAY`;
  }

  window.addEventListener("hashchange", render);
  if (!location.hash) {
    const serverPage = document.body.dataset.page;
    const serverSlug = document.body.dataset.slug;
    history.replaceState(
      null,
      "",
      serverPage === "brand" && serverSlug
        ? href("brand", serverSlug)
        : "#/home",
    );
  }

  // Initial bootstrap: fetch server overrides, then render.
  // loadServerOverrides() handles both applyAdminOverrides() and render().
  loadServerOverrides();
})();
