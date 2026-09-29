# RAY Knowledge — Pusat Pengetahuan Brand & Produk

Aplikasi katalog statis untuk pengetahuan brand, produk, bahan aktif, cara pakai, FAQ, dan kolaborator RAY.

## Menjalankan aplikasi

Persyaratan: Python 3 dan Node.js/npm.

```bash
npm run build
npm test
npm run dev
```

Buka `http://localhost:8765`.

## Struktur proyek

```text
ray-knowledge/
├── public/                  # hasil siap tayang; dilayani oleh serve.py
│   ├── index.html
│   └── assets/
│       ├── app.js           # routing dan rendering SPA
│       ├── data.js          # katalog utama brand dan produk
│       ├── collaborator-data.js
│       ├── inovasi-data.js
│       ├── styles.css
│       ├── brands/          # gambar brand (.webp)
│       ├── collaborators/   # foto kolaborator (.webp)
│       └── products/        # gambar produk (.webp)
├── _source/                 # sumber kode/data yang disalin saat build
├── scripts/                 # build, migrasi aset, dan validasi katalog
├── tests/                   # pemeriksaan browser opsional
├── package.json
└── serve.py                 # server lokal
```

## Alur perubahan data

- Daftar brand dan produk resmi: edit `list brand dan produk.md`.
- Isi product knowledge: edit `extracted- product knowledge.md`.
- Bangun ulang katalog dengan `npm run build`; proses ini menjalankan generator Markdown, menyinkronkan hasil ke `public`, lalu memvalidasi katalog.
- `_source/assets/data.js` dan `_source/assets/inovasi-data.js` adalah hasil generator; jangan mengubahnya secara manual.
- Kolaborator: edit `_source/assets/collaborator-data.js`.
- Kode aplikasi dan tampilan: edit file terkait di `_source/assets/`.
- Gambar brand, produk, dan kolaborator: simpan sebagai WebP di folder masing-masing dalam `public/assets/`.
- Jalankan `npm run build` setelah mengubah sumber. Build menyinkronkan sumber ke `public`, menormalkan referensi aset, lalu memvalidasi hasil.
- Jalankan `npm test` sebelum commit atau push.

`public/` tetap disimpan di Git karena merupakan artefak deployment statis. Jangan menambahkan kembali file gambar JPG/JPEG/PNG untuk brand, produk, atau kolaborator.

## Admin lokal

Buka `/#/admin` untuk mengedit konten melalui antarmuka admin. Perubahan tersimpan di `localStorage`. Agar perubahan menjadi permanen, ekspor `data-overrides.json` dan letakkan di `public/assets/`.

## Pemeriksaan browser opsional

Jika Playwright untuk Python dan browser Chromium sudah tersedia, jalankan aplikasi lalu:

```bash
python tests/check_site.py
```
