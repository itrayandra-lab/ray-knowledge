# RAY Knowledge — Pusat Pengetahuan Brand & Produk

Static clone of the [RAY Product Knowledge](https://ray-knowledge.rayandra-3563.chatgpt.site/) site, served by Python's built-in HTTP server.

## Stack

- **Pure HTML/CSS/JS** — no build step, no framework
- Python 3 `serve.py` — threaded static file server on port 8765

## Project structure

```
ray-knowledge/
├── public/                  # served by serve.py
│   ├── index.html
│   └── assets/
│       ├── app.js           # SPA routing + rendering
│       ├── data.js          # brand & product knowledge library
│       └── styles.css
├── _source/                 # pristine snapshot of the GPT clone
├── dokumentasi/             # source PPTs + extracted texts  [not pushed]
├── enrich_data.py           # bulk content enrichment script
├── check_site.py            # smoke test
└── serve.py                 # local dev server
```

## Run locally

```bash
python serve.py 8765
# → http://localhost:8765
```

## Admin

Browse to `/#/admin` and log in with the configured password to edit brand/product content. Changes are saved to `localStorage`. To deploy them persistently, use **Export** to download `data-overrides.json` and copy it to `public/assets/`.

## Customise

- Brand imagery: drop JPEG/PNG files into `public/assets/brands/<slug>.jpeg` (or `.jpg`)
- Brand metadata: edit `public/assets/data.js` (key: `window.RAY_KNOWLEDGE.brands`)
- Product catalog: same file (key: `brands[].products`)
- Colors / fonts: `public/assets/styles.css` (`:root` variables)
