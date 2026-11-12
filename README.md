# LUMØRA — brand studio website

Plain static HTML/CSS/JS. No build step, no server needed: **double-click `index.html`** to open it.
To publish, upload this whole folder to any static host (Netlify, Cloudflare Pages, GitHub Pages, Vercel, cPanel…).

## Files
```
index.html                    Home
work.html                     Work (project carousel)
studio.html                   Studio
lab.html                      Lab
contact.html                  Contact (form)
journal.html                  Journal list (filterable by category)
journal-strategy-first.html   Journal articles (4):
journal-living-stories.html     strategy-first, living-stories,
journal-quiet-motion.html       quiet-motion, built-to-last
journal-built-to-last.html
support.html                  Support / contact info
privacy-policy.html           Privacy policy
404.html                      Not-found page (used by most hosts)
assets/css/site.css           All styles (design tokens at the top, in :root)
assets/js/main.js             All interactions (smooth scroll, intro, reel, menu, scroll effects, forms…)
assets/js/rock.js             3D moss rock (home page), uses assets/js/three.min.js
assets/img/                   Photos from Unsplash (reel, work, proj, journal, article, studio, lab…)
```

## Editing
- Text: edit it directly in the `.html` files. Header, menu, footer and cookie notice are repeated in every page —
  when you change them (e.g. email, social links), use find-and-replace across all `.html` files.
- Colours / sizes: `:root` variables at the top of `assets/css/site.css` (`--bg`, `--fg`, `--lime`, `--pink`, `--pad`, fonts, easings, `--t-*` type sizes).
- Page `<title>` tags follow the pattern `Page | LUMØRA` — update them along with the brand name.
- Images: replace a file in `assets/img/` with one of the same name, or change the `src` in the HTML.

## Placeholders to replace
- Brand name (LUMØRA) and legal name (Lumora Studios LLC), email `hello@lumora.studio` (used in the contact form message,
  support and privacy pages), HQ cities, social links (generic x.com / linkedin / instagram).
- Placeholder `https://example.com/` links (e.g. the "Mara Lind" credit on the home and contact pages, and the press post in the journal).
- Client/project names, testimonials and people are fictional; logos on project images are text placeholders.
- Contact form and newsletter are demo only (they validate and show a message, nothing is sent) — connect them to a
  form service or backend before going live.
- All four internal journal posts share the same article body; the "press" post links to example.com.

Fonts (Sora, DM Mono) load from Google Fonts, so an internet connection is needed for the exact typography.
