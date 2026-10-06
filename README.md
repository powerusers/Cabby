# Cabby

Cabby is a small desk for a cab operator. Enter your business details once, then fill in a trip and download a receipt PDF. The receipt is issued in your business name.

A trip needs:

- Pickup
- Drop
- Distance in km
- Total amount, including 5% GST

The receipt splits that total into the trip fare and GST. Date, payment method, and rider name are optional. The preview updates as you type.

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

## What the receipt shows

Pickup, drop, distance, date, trip fare, 5% GST, and the total. It also shows the driver, vehicle, payment, and your business details, including GSTIN when you have entered one. The amount you type is the total the rider paid. Trip fare is that total with the GST taken out, and trip fare plus GST equals the total.

The Inter font shipped in `fonts/` is licensed under the SIL Open Font License. See `fonts/OFL.txt`.
