# RPNA Decks

Static client-facing decks for RPNA. Each subfolder is a self-contained deck.
Served via Netlify at decks.therpna.co.uk.

## Decks

- `ai-accountability/` AI Accountability for Public Sector Suppliers, 2026

## Apps

- `health-tracker/` **Vitals** — personal health tracker for exercise, sleep, diet and
  body composition. Self-contained static app (no build step), local-first storage in the
  browser with JSON backup/restore.
  - **Manual entry** for all four domains, with edit/delete.
  - **Importers:** CSV (auto-maps columns), Apple Health `export.xml` (workouts, sleep,
    weight, body-fat), and Vitals JSON backups.
  - **Dashboard:** latest weight/body-fat/sleep/exercise stats plus trend charts.
  - **Connections** page documents the data-source roadmap:
    - *Strava* and *Oura* — real OAuth2 auto-pull, switched on once a backend holds the
      API secrets (cloud-sync phase).
    - *Apple Health* — no cloud API; manual `export.xml` import now, webhook-based
      Health Auto Export later.
    - *ScanFit scales* — no public API; manual entry / CSV import.

  Next step for live auto-pull: add a small serverless backend (e.g. Netlify Functions +
  a free Postgres) to hold OAuth secrets, refresh tokens, and sync on a schedule.
