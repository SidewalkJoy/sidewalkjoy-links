# sidewalkjoy-links

The website at [map.sidewalkjoy.com](https://map.sidewalkjoy.com), hosted on GitHub Pages. It makes Sidewalk Joy spot links open the iOS app or App Clip, and shows a "Download the app" page with a link preview to everyone else.

This is temporary hosting while the iOS app runs on the Google My Maps data. When the database launches, map.sidewalkjoy.com moves back to the server ([sidewalkjoy-map](https://github.com/noahemmet/sidewalkjoy-staging)), and this repo can be archived.

## What's here

| File | What it does |
|---|---|
| [`.well-known/apple-app-site-association`](.well-known/apple-app-site-association) | Tells iOS that `/spot/*` links open the app (team `29W28ZG86B`) and its App Clip. Keep it matching the server's copy in `pb_hooks/links/`. |
| [`scripts/build-spot-pages.js`](scripts/build-spot-pages.js) | Downloads the map's KML and builds a page per spot at `/spot/<code>/<slug>` (and `/spot/<code>`), with the spot's name, description and photo for previews in Messages. Codes and slugs follow the app's rules (`Spot.shortCode` and `Spot.slug`). |
| [`404.html`](404.html) | The download page with the App Clip card, for any link without a page (an unknown spot, an old slug, `/map`, `/add`). |
| [`index.html`](index.html) | Sends visitors to [sidewalkjoy.com](https://www.sidewalkjoy.com/). |
| [`landing.css`](landing.css) | The download page's look. |
| [`.github/workflows/pages.yml`](.github/workflows/pages.yml) | Builds and publishes the site on every push, every night (for new spots and fresh photo links), and on demand. |

The spot pages aren't committed: the workflow builds them into `_site/` each run.

## Common tasks

Build locally (Node 18+, no dependencies):

```
node scripts/build-spot-pages.js
```

Publish now (for example, after the client adds spots): [Actions → Publish → Run workflow](https://github.com/sidewalkjoy/sidewalkjoy-links/actions/workflows/pages.yml).

Check it's working:

```
curl -sI https://map.sidewalkjoy.com/.well-known/apple-app-site-association | head -1
curl -s https://app-site-association.cdn-apple.com/a/v1/map.sidewalkjoy.com
```

The first should return `200`; the second is Apple's cached copy, which should print the same JSON.

## Setup

- **Pages:** Settings → Pages → Source: *GitHub Actions*, custom domain `map.sidewalkjoy.com`, Enforce HTTPS.
- **Domain:** verified in the [organization's Pages settings](https://github.com/organizations/SidewalkJoy/settings/pages).
- **DNS (Squarespace):** `map` CNAME → `sidewalkjoy.github.io`, plus the `_github-pages-challenge-SidewalkJoy.map` TXT record. To move back to the server, point `map` at `r71zxdla.up.railway.app` and re-add Railway's `_railway-verify.map` TXT record (its value is in the Railway dashboard).
- **App Store ID:** `6824644823`, in `404.html` and `APP_STORE_ID` in the build script.

## Links

- Site: https://map.sidewalkjoy.com
- Pages settings: https://github.com/sidewalkjoy/sidewalkjoy-links/settings/pages
- Publish workflow: https://github.com/sidewalkjoy/sidewalkjoy-links/actions/workflows/pages.yml
- Apple's cached association file: https://app-site-association.cdn-apple.com/a/v1/map.sidewalkjoy.com
- Google My Map: https://www.google.com/maps/d/edit?mid=16gC7wi4LEptziD05ONmbiPyn0DWwjn0
- App Store Connect: https://appstoreconnect.apple.com/apps/6824644823
- Squarespace DNS: https://account.squarespace.com/domains
