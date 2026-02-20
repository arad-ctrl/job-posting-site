# Job Posting Site

A lightweight public-facing job listing site that mirrors your internal job board data and deliberately does **not** accept applications.

## Source adapter layer (what you need to fill in)

The app now supports a provider-based source layer via environment variables.

### 1) Ashby internal board (default)

Use this when your source is an Ashby internal board URL.

```bash
export SOURCE_PROVIDER="ashby-internal"
export ASHBY_BOARD_ID="329606d8-b9c8-4e09-a75e-1125a5651162"  # fill with your board UUID
# optional overrides:
export SOURCE_URL="https://app.ashbyhq.com/internal/job-board/<your-board-id>"
export SOURCE_TOKEN=""  # only if your upstream requires bearer auth
```

What you must fill in:
- `ASHBY_BOARD_ID` (if not using the current default board)
- optionally `SOURCE_URL` if you want explicit full URL control
- optionally `SOURCE_TOKEN` if your board/API requires bearer auth

### 2) Generic JSON/HTML source

Use this for any non-Ashby endpoint that returns JSON or HTML with embedded job JSON.

```bash
export SOURCE_PROVIDER="generic-json"
export SOURCE_URL="https://your-source.example.com/jobs"
export SOURCE_TOKEN=""  # optional bearer token
```

What you must fill in:
- `SOURCE_URL`
- optional `SOURCE_TOKEN`

## Other runtime settings

```bash
export REFRESH_INTERVAL_MS=900000
npm install
npm start
```

Open `http://localhost:3000`.

## API output

`GET /api/jobs` returns:
- `jobs`, `fetchedAt`, `error`
- `provider` and `source` (so you can verify adapter configuration)
- informational `notice`

## Notes

- If upstream access is blocked (403/internal ACL/network), the endpoint returns the error in `error` for diagnostics.
- Legacy env vars `JOB_BOARD_API_URL` and `JOB_BOARD_API_TOKEN` still work as fallbacks for compatibility.

# job-posting-site

