# zpl-designer

A browser-based canvas for designing Zebra labels — text, shapes, barcodes,
QR codes, and raw ZPL escape hatches — compiled to real ZPL and printed
over CUPS.

**[blog.shaishav.kr/zpl-designer](https://blog.shaishav.kr/zpl-designer/)** — static demo of the
designer UI. It has no backend attached, so Save / Load / View ZPL / Print
don't work there; see below for running the full thing.

## Layout

- `frontend/` — React + Vite canvas editor (the part deployed to the demo above)
- `backend/` — FastAPI app: ZPL compiler, document store (SQLite), CUPS printing
- `docs/zpl-notes.md` — hardware notes gathered against a real Zebra ZD230
  (ZPL quirks around `^PW`/`^LL`, rotation, raw CUPS printing)

## Running it locally

Backend:

```
cd backend
uv sync            # or: pip install -e .
uvicorn app.main:app --port 8731 --reload
```

Frontend:

```
cd frontend
yarn install
yarn dev            # proxies /api -> http://127.0.0.1:8731
```

Printing requires a CUPS-registered Zebra queue reachable from wherever the
backend runs.

## Roadmap

See the in-app Roadmap tab. Short version: a JS-only printer client (no
Python backend needed) and Partsbox-style printing for Mac via a Raspberry
Pi CUPS bridge.

Want a Docker image before it's published? Reach out — see the in-app
About tab.
