(function () {
  "use strict";

  const catalog = window.RAY_KNOWLEDGE;
  if (!catalog || !Array.isArray(catalog.brands)) return;

  const collaboratorsByBrand = {
    phytosync: [
      {
        name: "Prof. Dr. apt. Sriwidodo, M.Si.",
        role: "Professor dan Kolaborator Riset Farmasi",
        image: "/assets/collaborators/PHYTOSYNC-1.webp",
      },
      {
        name: "apt. Cahya Khairani, S.Si, M.Farm.",
        role: "Apoteker dan Kolaborator Riset Farmasi",
        image: "/assets/collaborators/PHYTOSYNC-2.webp",
      },
    ],
    mommylatory: [
      {
        name: "Dr. dr. Akhmad Yogi Pramatirta, Sp.OG (K), M.Kes.",
        role: "Dokter Spesialis Obstetri dan Ginekologi Konsultan",
        image: "/assets/collaborators/MOMMYLATORY.webp",
      },
    ],
    "baby-latory": [
      {
        name: "dr. Frecillia Regina, Sp.A, IBCLC",
        role: "Dokter Spesialis Anak dan Konselor Laktasi",
        image: "/assets/collaborators/BABY-LATORY.webp",
      },
    ],
    "sam-sun-and-moon": [
      {
        name: "dr. Frecillia Regina, Sp.A, IBCLC",
        role: "Dokter Spesialis Anak dan Konselor Laktasi",
        image: "/assets/collaborators/SAM SUN AND MOON.webp",
      },
    ],
    volubilis: [
      {
        name: "Prof. Dr. apt. Sriwidodo, M.Si.",
        role: "Professor dan Kolaborator Riset Farmasi",
        image: "/assets/collaborators/VOLUBILIS.webp",
      },
    ],
    dermond: [
      {
        name: "dr. Fajar Arief Noor",
        role: "Dokter dan Kolaborator Pengembangan Produk",
        image: "/assets/collaborators/DERMOND.webp",
      },
    ],
    luecielliderm: [
      {
        name: "dr. Alfrid Asditya, Sp.DVE, M.Ked.Klin",
        role: "Dokter Spesialis Dermatologi, Venereologi, dan Estetika",
        image: "/assets/collaborators/LUECIELLEDERM.webp",
      },
    ],
    eggshellent: [
      {
        name: "SFITB",
        role: "Sekolah Farmasi Institut Teknologi Bandung",
        image: "/assets/collaborators/EGGSHELLENT.webp",
      },
    ],
    anara: [
      {
        name: "Dr. apt. Naniek Widyaningrum, M.Sc.",
        role: "Apoteker dan Kolaborator Riset Farmasi",
        image: "/assets/collaborators/ANARA.webp",
      },
    ],
    coralyst: [
      {
        name: "Dr. apt. Soraya Ratnawulan Mita",
        role: "Apoteker dan Kolaborator Riset Farmasi",
        image: "/assets/collaborators/CORALYST.webp",
      },
    ],
    "upglow-dai": [
      {
        name: "Prof. Dr. apt. Keri Lestari, M.Si.",
        role: "Professor dan Kolaborator Riset Farmasi",
        image: "/assets/collaborators/UPGLOW.webp",
      },
    ],
    dermalink: [
      {
        name: "dr. Novy Oktaviana, Sp.DVE",
        role: "Dokter Spesialis Dermatologi, Venereologi, dan Estetika",
        image: "/assets/collaborators/DERMALINK.webp",
      },
    ],
    "alpha-shield": [
      {
        name: "Dr. apt. Titta Hartyana Sutarna, S.Si, M.Sc",
        role: "Apoteker dan Kolaborator Riset Farmasi",
        image: "/assets/collaborators/ALPHA SHIELD.webp",
      },
    ],
    aquera: [
      {
        name: "Prof. Dr. Sugeng Heri Suseno, S.Pi., M.Si",
        role: "Professor dan Kolaborator Riset Bahan Alam",
        image: "/assets/collaborators/AQUERA.webp",
      },
    ],
  };

  for (const [slug, collaborators] of Object.entries(collaboratorsByBrand)) {
    const brand = catalog.brands.find((item) => item.slug === slug);
    if (!brand) continue;
    brand.mainProfile = brand.mainProfile || {};
    brand.mainProfile.collaborators = collaborators.map((item) => ({ ...item }));
    if (!Array.isArray(brand.profiles) || !brand.profiles.length) {
      brand.profiles = [brand.mainProfile];
    }
    const primaryProfile =
      brand.profiles.find((profile) => profile.mainProfile) || brand.profiles[0];
    primaryProfile.collaborators = collaborators.map((item) => ({ ...item }));
  }

  window.RAY_COLLABORATORS_BY_BRAND = collaboratorsByBrand;
})();
