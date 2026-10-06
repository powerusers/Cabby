# Cabby

Cabby is a small desk for a cab operator. Enter your business details once, then fill in a trip and download an Ola-style or Uber-style receipt as a PDF. The receipt is issued in your business name.

A trip needs:

- Pickup
- Drop
- Distance in km
- Total amount

Date, payment method, and rider name are optional extras. The preview updates as you type.

## Run locally

```bash
npm install
npm start
```

Open http://localhost:3000.

```bash
npm test
```

## Deploy on Railway

This repo includes a `Dockerfile`. Railway will build it and run `node server.js`. The app listens on the `PORT` Railway provides.

1. Create a new Railway project from this GitHub repository.
2. Wait for the deploy, then open **Settings → Networking → Generate domain**.
3. Add a volume so operator details survive restarts:
   - Mount path: `/data`
   - Variable: `DATA_DIR=/data`
4. Optional: set `APP_PIN` to a private word or code. When it is set, the site asks for that PIN before anyone can view or change receipts.

Without a volume, operator details are stored on the container disk and are cleared on the next deploy. You can enter them again from the Operator button.

Use one replica. The details are a single file, not a shared database.

## Environment

| Variable | Purpose |
| --- | --- |
| `PORT` | Set by Railway. Defaults to `3000` locally. |
| `DATA_DIR` | Folder for `operator.json`. Defaults to `./data`. |
| `APP_PIN` | Optional lock for the whole desk. |

## Receipt styles

**Ola style** uses a dark header, a lime bar, and a compact fare block. **Uber style** uses an open layout with a thank-you line and a payments row. Both show your business, driver, vehicle, pickup, drop, distance, and total.

The Inter font shipped in `fonts/` is licensed under the SIL Open Font License. See `fonts/OFL.txt`.
