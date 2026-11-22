# MindMetrics

A front-end study-balance companion for students. Daily check-in, 0–100 stress score, weekly and monthly trends, focus timer, deadline list and a searchable library of 500 wellness tips.

Web Development mini-project, Bennett University. Front-end only: no server, no database.

**Live site:** https://panditshashwattripathi17.github.io/mindmetrics/

## Pages

| Page | Purpose |
| --- | --- |
| `index.html` | Public landing page with a preview carousel |
| `login.html` | Log in / Sign up (demo accounts kept in localStorage) |
| `dashboard.html` | Weekly and monthly stress score, comparison tables, deadlines, tip of the day (login required) |
| `timer.html` | Focus timer: 25 / 50 / 90 min or custom, automatic break length (login required) |
| `checkin.html` | Daily mood and six sliders, score breakdown and advice (login required) |
| `tips.html` | Tips library: search, theme filter, favourites, show more |
| `about.html` | Purpose, scoring method, tech used, team |
| `contact.html` | Validated contact form, saved in the browser |

## Folder structure

```
mindmetrics/
├── index.html  login.html  dashboard.html  timer.html
├── checkin.html  tips.html  about.html  contact.html
├── css/style.css
├── js/script.js      # all logic (ES6+)
├── js/tips.js        # the 500-tip data bank
└── assets/images/    # logo.svg, favicon.svg
```

## Tech

HTML5 semantic elements · CSS3 (custom properties, Grid, Flexbox, media queries at 1100 / 980 / 700 / 480 px) · JavaScript ES6+ (const/let, arrow functions, template literals, destructuring, spread, optional chaining, async/await) · localStorage · GitHub Pages.

## Stress score

0 = very relaxed, 100 = very stressed. Stress 30, mood 20, sleep 20 (8 h or more adds 0), workload 15, low energy 15, minus up to 5 for exercise (30 min = full). Low below 34, Moderate 34–66, High 67+.

## Run locally

Open `index.html` in a browser. No build step.

## Notes

- Accounts and data are stored only in the visitor's browser. The login is a demo (salted SHA-256 hash) and is not real security.
- Not medical advice.
