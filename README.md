# AiReview (aireveiw.com)

Plain HTML, CSS and JavaScript. No framework, no database, no build step.

## Folder map

```
index.html                   homepage (cards come from data/products.json)
products/                    all-products listing
ai-biz-engine/               AiBizEngine landing page (preserved from the original lp/ project)
about/ contact/ privacy-policy/ terms-and-conditions/ disclaimer/ affiliate-disclosure/
404.html                     "page not found" page
assets/css/global.css        design tokens, header, footer, buttons, cookie notice (every page)
assets/css/components.css    homepage sections, product cards, white article card (every page)
assets/css/affiliate-page.css  shared by review pages: CTA buttons, price box, bonuses, pop-up
assets/css/aibizengine.css  AiBizEngine accent   (ai-prospect-genie.css: AIProspectGenie accent + tweaks)
assets/js/main.js            footer year, mobile menu, cookie notice (every page)
assets/js/products.js        builds product cards from data/products.json
assets/js/bonus-popup.js     bonus pop-up for review pages + LEAD_ENDPOINT setting
data/products.json           the product registry
templates/                   product-template.html + header/footer partials (not deployed)
tools/sync-layout.py         copies the shared header/footer into every page
tools/check-site.py          checks links, assets, SEO tags, sitemap, registry
_internal/systeme-io-connector/   Cloudflare Worker for the bonus form (not deployed)
vercel.json  .vercelignore  robots.txt  sitemap.xml
```

All paths are root-relative (`/assets/...`), so open the site through a local server, not by double-clicking the files.

## Run locally (VS Code)

1. Open the `aireveiw` folder in VS Code.
2. Terminal: `python -m http.server 8000`
3. Browse to http://localhost:8000/ (or install the *Live Server* extension, right-click `index.html`, *Open with Live Server*, with the `aireveiw` folder as the workspace root).
4. Before publishing: `python tools/check-site.py`

## Important: static hosting limitation

`products.json` only feeds the homepage and `/products/` listing. It does **not** create pages. Every published product needs its own real folder and file, e.g. `shop-empire/index.html`. A product is shown publicly only when `"status": "published"`.

## Adding a product (checklist)

1. Copy `templates/product-template.html` to `<slug>/index.html`; fill in verified details only.
2. Put images in `assets/images/`.
3. Add an entry to `data/products.json` (copy the AiBizEngine fields; `status: "published"`).
4. Add the URL to `sitemap.xml`.
5. `python tools/sync-layout.py` then `python tools/check-site.py`.

The shared header/footer live in `templates/partials/`. Edit them there and re-run `sync-layout.py`.

## Deploy to Vercel (nothing is deployed yet)

1. Push the `aireveiw` folder to a GitHub repository (or set it as the Root Directory if the repo contains more).
2. vercel.com > Add New > Project > import the repo. Framework preset: **Other**. No build command, output directory blank.
3. Deploy, then test the `*.vercel.app` URL: `/`, `/ai-biz-engine/`, refresh on a product URL, `/sitemap.xml`, `/robots.txt`.
4. Project > Settings > Domains > add `aireveiw.com` (and `www.aireveiw.com`), then set the DNS records Vercel shows at your domain registrar. Vercel gives HTTPS automatically.

`vercel.json` enforces trailing-slash URLs and redirects the old `.html` legal URLs. Netlify also works without extra config.

## Bonus form (AiBizEngine)

`LEAD_ENDPOINT` in `assets/js/bonus-popup.js` is empty, so emails typed in the pop-up are **not saved** (visitors are still redirected). Follow `_internal/systeme-io-connector/README.txt` and paste the Worker URL there.

## Prompt for adding a product

> Add a new affiliate product to my existing AiReview website. Product name: <NAME>. Slug: <slug>. Official site: <URL>. Affiliate URL: <URL>. Verified description, features, pricing, bonuses and images: <attach/paste>. Inspect README.md, templates/product-template.html, data/products.json, the shared CSS and the AiBizEngine page first. Create /<slug>/index.html using only the verified information (never copy AiBizEngine content, prices, bonuses or links), with its own accent colour in assets/css/<slug>.css if suitable. Add it to products.json and sitemap.xml, run tools/sync-layout.py and tools/check-site.py, test the page on desktop and mobile, and report files created/modified and the checks you actually ran. If essential info or the affiliate URL is missing, ask me. Do not deploy or touch DNS.
