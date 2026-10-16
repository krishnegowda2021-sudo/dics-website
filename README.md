# DICS website — complete project

Static multi-page site for Digital Instruments & Control Systems, plus a small Cloudflare Worker that receives the enquiry / quote / careers forms.

## Run it

```bash
npm install          # installs wrangler (Cloudflare CLI)
npm run build        # generates dist/ (70 pages)
npm run check        # verifies every internal link resolves
npm run dev          # local preview at http://localhost:8787
npm run deploy       # publish to Cloudflare Workers
```

Only Node 18+ is needed for `build` and `check`. Set `SITE_ORIGIN=https://www.yourdomain.com npm run build` to get canonical URLs and a correct sitemap.

## Structure

```
data/site.json        company details, offices, categories, services, brands, industries
data/products.json    product catalogue (see "Adding all 858 products")
scripts/build.mjs     page generator (templates live here)
src/style.css         all styling
src/app.js            mobile menu, catalogue search/filter/pagination, form submit
src/worker.js         Cloudflare Worker: serves the site + POST /api/enquiry
public/assets/        logo, favicon, photos (copied into dist/ as-is)
wrangler.jsonc        Cloudflare config
```

Pages generated: Home, About, Contact (+ 10 offices), Request a Quote, Industries, Careers, Services (index + 8), Brands (8), Product catalogue, 11 category pages (+2 sub-categories), one page per product, Privacy Policy, 404, sitemap.xml, robots.txt.

## Before you go live — files to add

The original site's images could not be downloaded when this project was built. Copy the originals into `public/assets/` using these names (pages fall back to a blue gradient until you do):

| File | Used for |
|---|---|
| `dics-logo.png` | Your real logo. Then replace `dics-logo.svg` with `dics-logo.png` in `scripts/build.mjs` (2 places). A simple placeholder SVG logo is included. |
| `hero-plant.jpg` | Home hero, Material Handling card |
| `control-panel.jpg` | About section, Careers hero |
| `ind-auto.jpg`, `ind-pharma.jpg`, `ind-food.jpg`, `ind-water.jpg` | Industry cards |

Product photos load straight from `dicsglobal.com/wp-content/uploads/...`, as on the current site. Copy them into `public/assets/products/` and update `image` in `data/products.json` if you want to be independent of that server.

## Forms (important)

Forms post to `/api/enquiry`. Nothing is delivered until you set ONE of these in Cloudflare (Worker → Settings → Variables and Secrets, or `wrangler secret put`):

- `FORM_WEBHOOK_URL` — any HTTPS webhook (Zapier, Make, Slack, your CRM)
- `RESEND_API_KEY` + `MAIL_TO` (+ optional `MAIL_FROM`, must be a verified Resend sender) — emails the enquiry

Until one is set, the form shows an error instead of pretending to send. A hidden honeypot field blocks simple bots.

## Adding all 858 products

`data/products.json` holds 31 products captured from the live pages. Add the rest as objects in the same shape and rebuild:

```json
{"slug":"unique-url-slug","name":"Model","brand":"OMRON","group":"Sub-heading","category":"ac-drives","image":"https://.../photo.jpg"}
```

`category` must be one of the slugs in `data/site.json`. Each entry gets its own `/product/<slug>` page and appears in catalogue search automatically. Category assignments for the 31 included products are best guesses — check them.

## Things to review

- **Styling is a faithful rebuild, not a pixel copy.** Layout, sections and wording follow the live site; colours, fonts and spacing were written fresh in `src/style.css` because the original CSS wasn't available.
- **Service pages:** PLC Services uses the live text. The other seven use the live headings and summaries plus short body text written from them. Edit in `data/site.json`.
- **Privacy Policy** is a generic draft — replace it with your approved text.
- **Brand pages** are minimal (product list + links). Add brand descriptions as needed.

## Deploying on Vercel instead of Cloudflare

The repo also works on Vercel (`vercel.json` + `api/enquiry.js`). Both hosts share the same form logic in `src/enquiry.js`.

1. vercel.com → Add New → Project → import the `DICS` GitHub repo. Leave the framework as "Other"; the settings come from `vercel.json`.
2. Settings → Environment Variables: add `RESEND_API_KEY` and `MAIL_TO` (optionally `MAIL_FROM`), or `FORM_WEBHOOK_URL`. Redeploy after adding them.
3. Note: Vercel's free Hobby plan is for non-commercial use; a company website needs a paid Vercel plan. Cloudflare's free plan allows commercial sites.
