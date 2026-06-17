# Stitched Up

A single-page pledge campaign site. Australians pledge not to vote for any
politician who supports the CGT changes, and send the question — *"Are you in
on it?"* — directly to their state's senators.

This implements the **Stitched Up** design (handed off from Claude Design as
`Stitched Up.dc.html`) as a dependency-free static site.

## Run it

It's plain HTML/CSS/JS — no build step. Open `index.html` directly, or serve
the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Files

- `index.html` — page markup (nav, hero, explainer, timeline shell, senator
  wall, dashboard, pledge form, evidence, "who's fighting it", footer).
- `styles.css` — global styles, animations, and the mobile-first responsive
  layer (mobile is the primary interface).
- `app.js` — all logic: deterministic 76-senator dataset, live national +
  per-senator + state counters, the tap-to-expand state accordion, postcode →
  state lookup, pledge-form validation, the auto-generated senator email
  preview, and social share.

## What works now

- **Live counters** — national ticker, per-senator counts, and the state-by-
  state dashboard all tick live and persist (`localStorage`).
- **Senator wall** — 76 senators grouped by state in a tap-to-expand accordion
  with IN / UNKNOWN / FIGHTING tallies and a proportion bar per state.
- **Pledge flow** — "Ask them" pre-fills and targets a senator; submitting
  validates the fields, maps postcode → state, increments the counters, and
  shows the personalised senator email as a "case file" preview, then offers
  share.

## Before launch (placeholders to replace)

The design is a high-fidelity prototype. To go live you still need to:

1. **Real senator data.** `app.js` generates *illustrative* senators
   (fictional names) so no real person is falsely labelled. Replace
   `makeSenators()` with the real 76-senator database — name, party, state,
   **email**, **photo URL**, and declared position. Each card already renders
   `photo` over the placeholder silhouette when a URL is present.
2. **Serverless form handling.** `submit()` in `app.js` currently only updates
   the UI. POST the submission to a serverless endpoint that records the entry
   and sends the personalised, per-senator emails (see the marked `NOTE`).
3. **Real-time counters** backed by the database rather than `localStorage`.
4. Privacy policy page and authorisation details.

## Notes on scope

- "Who's fighting it" uses the public positions from the brief (Coalition /
  Pocock / Lambie).
- The chat transcript mentions a possible post-form **donor page** ($26 / $65 /
  $265 / $550 / $1500) — that work was interrupted in the design tool and is
  **not** part of the final `Stitched Up.dc.html`, so it isn't built here.
  Say the word and I'll add it.
