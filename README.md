# Transit Map — Toronto in motion

Version 0.1.0. Independent, non-commercial SAC project for Magnus. No account, database, AI API, analytics or paid service required by the code.

## Current state

First edition built with route search, vehicle-number search, bus/streetcar filters, device-local favourite routes, route polylines, vehicle details, optional location, live following and explicit stale/offline states. Arrival predictions and subway trains are not included.

`public/config.js` has an empty API URL, so the public interface is in clearly labelled **recorded snapshot mode**. This is actual TTC data captured during development, not a simulation. It must not be described as a live deployment until a relay is configured and verified. `public/data/snapshot.json` preserves its capture and upstream report timestamps.

## Why a relay?

The official HTTPS vehicle endpoint responded successfully but supplied no Access-Control-Allow-Origin header when tested from the GitHub Pages origin. Browser JavaScript on GitHub Pages therefore cannot read it directly. `api/vehicles.js` fetches the fixed official endpoint, decodes GTFS-Realtime, validates positions, preserves timestamps and responds with browser-readable JSON. No arbitrary upstream URLs are accepted.

## Deployment

1. Owner creates a public `transit-map` repository, initialized with a README. Upload these files, preserving `package-lock.json`.
2. Connect that repository to a **Vercel Hobby** account to serve the prepared relay, subject to its personal/non-commercial terms and free usage caps. Confirm the plan before deployment. No paid upgrade is authorized. Use Node 22; the supplied `vercel.json` serves `public/` plus `/api/vehicles`.
3. Verify the relay returns a fresh `feedTimestamp`, real vehicle positions and `Access-Control-Allow-Origin: *`. The response uses 30-second shared caching, but free-tier capacity still needs monitoring. Do not remove deployment protection on other projects.
4. Set `apiUrl` in `public/config.js` to the relay's HTTPS `/api/vehicles` URL.
5. Enable GitHub Pages with **GitHub Actions** as source. The supplied workflow publishes only `public/`. Run it and verify desktop/mobile access, data refreshes and stale/failure states.
6. A custom domain is deferred. No DNS change is needed for development.

Alternatively, serving both the frontend and relay on Vercel works by setting `apiUrl` to `/api/vehicles`, but GitHub Pages is the owner's preferred frontend host. No Vercel project has yet been created by this build.

## Update and recovery

- `npm ci` installs pinned dependencies; `npm test` runs data and DOM interaction checks.
- `npm run snapshot` captures a real report for explicitly labelled previews only. Never run it on a schedule as a substitute for live updates.
- Obtain the current **SurfaceGTFS.zip** from the official source below; run `python scripts/import_schedule.py /path/to/SurfaceGTFS.zip`. Do not substitute the merged GTFS: the live feed uses matching surface IDs. Upstream updates are approximately every six weeks according to TTC metadata. Refresh manually when route names/IDs no longer match.
- `public/data/network.json` includes source feed metadata and import time. Route shapes are simplified scheduled variants, not predicted vehicle paths.
- Positions older than three minutes display as older. In live mode, missing timestamps and positions older than 15 minutes are hidden. Feed age is evaluated independently of fetch time. Hidden tabs stop polling. No simulated movement or inferred arrival times.
- Favourites remain in localStorage. No user location is sent to the relay; OSM map tiles necessarily load from a third-party service.
- Restore the repository at a known commit, run checks, and redeploy. No database restore needed. Owner guide and relay are in the same repo for handoff.

## Sources and limitations

- Official vehicle feed: https://bustime.ttc.ca/gtfsrt/vehicles
- Feed catalogue: https://open.toronto.ca/dataset/ttc-bustime-real-time-next-vehicle-arrival-nvas/
- Matching schedule: https://open.toronto.ca/dataset/surface-routes-and-schedules-for-bustime/
- Catalogue pages link Open Government Licence – Toronto; API metadata currently says `license_id: notspecified`. Preserve this discrepancy for review before public launch, and include attribution. Do not claim TTC endorsement.
- Contains information licensed under the Open Government Licence – Toronto.
- Map tiles © OpenStreetMap contributors; use normal interactive browsing only, no prefetch/bulk/offline tile downloads. Tile policy: https://operations.osmfoundation.org/policies/tiles/
- Leaflet 1.9.4 vendored with its licence. GTFS-Realtime bindings are pinned via npm.
- Vercel: https://vercel.com/docs/plans/hobby ; https://vercel.com/docs/functions
- Data may be delayed, incomplete, or temporarily unavailable. Use TTC for official travel information.

## Verification

Live upstream retrieval and protobuf decoding were checked. Automated tests cover coordinates, missing timestamps, relay failures, route selection, filtering, favourites, search/reset, vehicle details, stale feeds and offline behaviour. Visual browser QA and deployed end-to-end checks remain pending; no preview browser is available in this session.
