# The Real Windy City — Unified Civic Broadcast, Palantir Gotham/Foundry & Speaker Video Vault (2008–2026)

**Live `$0/mo` Deployment:** <https://therealwindycity.github.io/real-windy-city-tv/>  
**Full-Stack Next.js 16 + Drizzle + PostgreSQL 17 Server:** [`./nextjs-postgres-foundry/`](./nextjs-postgres-foundry/)

## Zero-Gap Primary Public Record Totals
- **1,615 Complete Government Episodes (`2008-05-27` – `2026-11-23`)** across all 10 City of Cheyenne municipal bodies (`0` empty episodes).
- **19 Synchronized Analytical Lenses** (`Foundry Docs Vault`, `Gotham Link Graph`, `Speaker Turn Videos`, `Provenance Films`, `Plain-English Story`, `Front Page Tabloid`, `Cast & Crew`, `Run of Show`, `Vote Lab`, `Cheyenne Map`, `History Compare`, `Follow the Money`, `Jargon Decoder`, `Legal IRAC`, `Fact-Check Desk`, `Analytics`, `Verbatim Record`, `Screenplay`, `Evidence Locker`) with **Swipe**, **Side-by-Side Split**, **19-Lens Mosaic**, and **Draggable Floating Windows**.
- **6,371 Palantir Foundry Agendas & Supporting Document PDFs** (`4,929` `cheyenne-archives-*` PDFs + `1,081` SHA-1 `ai-record-ocr` scanned page streams).
- **2,483 Individual `<= 3-Min` Historical Speaker Video Turns** across **246 Speakers** — organizable by **Speaker**, **Sitting Date**, **Ordinance (1st → Final Reading)**, **Civic Theme**, and **Emotional Impact**, with **1-click Speaker `.ZIP` Archive Downloads** and **Facebook Post Studio**.
- **275 Multi-Reading Ordinance Arcs** — playable chronologically from First Reading (`Pilot`) through Committee, Amendments, and Final Enactment Vote (`Finale`).
- **14 Manual Click-Path Provenance Screen-Recording Films** (`provenance-showcase.mp4`, `provenance-manual-run.mp4`, `provenance-timelapse.mp4`, `clip-01..11.mp4`) + **121-Row Verification Ledger**.

## Running the Full-Stack Next.js 16 + PostgreSQL 17 Server Locally
```bash
cd nextjs-postgres-foundry
docker compose up --build
# Or with an existing PostgreSQL 17 instance:
cp .env.example .env
npm install
npx drizzle-kit push
npm run build && npm run start
```
