# Nurse Ashthetics — clinic site

Single-page site for **Nurse Ashthetics**, nurse-led aesthetics in Atherton, Manchester.
Static HTML/CSS/JS — no build step, no dependencies. Hosted on GitHub Pages:
**https://harky39.github.io/nurse-ashthetics/**

## What's in it

| Section | Notes |
|---|---|
| Hero | Interactive before/after drag slider (jaw & chin filler) |
| Treatments | Data-driven cards with "Add to quote" quick buttons |
| Results | Before/after photo pairs, shared-with-consent disclaimer |
| Offer | 20% first-visit offer bar + section (toggleable in admin) |
| Booking | Date-grouped open slots → pre-filled WhatsApp request |
| Quote builder | Live estimated total with discount, opens WhatsApp with a filled-in message |
| Clinic admin | Footer link → password panel to edit prices, slots, offer and contact settings |

## Updating the site (no code needed)

All content lives in **one file: `data/site-data.json`** — treatments & prices,
the special offer, open time slots, WhatsApp number and Instagram handle.

1. Open the live site → footer → **Clinic admin** (password: see below).
2. Edit prices / add or remove slots / change the offer / update contact details.
3. Click **Save changes** to preview instantly in your browser.
4. Click **Download site-data.json**, replace `data/site-data.json` in this repo, commit & push. Done — live for everyone.

> Admin edits are stored per-browser (localStorage) so the clinic can preview
> safely; publishing happens by committing the exported JSON file. This is what
> makes it work on static hosting where a database isn't available.

### Changing the admin password

Edit `ADMIN_PASSWORD` at the top of [`js/main.js`](js/main.js). It's client-side —
a gate for casual visitors, not real security (same trade-off as any static site).

## Important: set the real contact details

- **WhatsApp number** is currently `447505764766` (the number used across the
  other sites). If the clinic has its own line, change it in admin → Settings,
  or edit `"settings" > "whatsapp"` in `data/site-data.json`.
- **Instagram handle** is `@nurseashthetics` — update if different.

## Structure

```
index.html            page + embedded fallback data (used if the JSON fetch fails)
css/styles.css        design system (Fraunces + Manrope, porcelain/ink/rose)
js/main.js            rendering, quote builder, slider, admin panel
data/site-data.json   ← single source of truth for all editable content
images/               before/after photos (cropped from the original composites)
```

## Local preview

Any static server works:

```bash
python -m http.server 8080
# → http://localhost:8080
```
