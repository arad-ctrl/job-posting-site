# Dave Referral Jobs Viewer

Single-page Node.js/Express app that displays **all** roles from Dave's Ashby account (including unlisted / internal postings) in a clean, read-only view. It is designed to be deployed on **Google Cloud Run** and uses an **environment variable** for the Ashby API key.

There are **no application actions** on this page: no apply buttons, forms, or links to apply. It is for informational and internal referral conversations only.

---

## 1. Requirements

- Node.js **18+** (Cloud Run uses a compatible version)
- An Ashby **API key** with access to Dave's job postings
- Access to a GCP project with **Cloud Run** and **Cloud Build** enabled

---

## 2. Environment variables

The app reads the following environment variables:

- `ASHBY_API_KEY` (required): your Ashby API key. **Never commit this to git.**
- `ASHBY_ORGANIZATION_SLUG` (optional): defaults to `dave`.
- `PORT` (optional): port to listen on; defaults to `8080`. Cloud Run will set this automatically.

### Local `.env` file

For local development, create a `.env` file in the project root:

```bash
ASHBY_API_KEY=your-real-ashby-api-key
ASHBY_ORGANIZATION_SLUG=dave
PORT=8080
```

The `.env` file is already in `.gitignore` so it will not be committed.

---

## 3. Running locally

Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm start
```

Then open:

```text
http://localhost:8080
```

On page load, the frontend calls `GET /api/jobs`, which:

- Hits Ashby's GraphQL API with your `ASHBY_API_KEY`
- Requests **all** job postings for the `dave` organization, including unlisted postings
- Returns normalized data to the browser

The UI:

- Shows Dave-branded header and footer
- Displays a clear banner: _"For informational purposes only. Roles listed here are not accepting applications through this page."_
- Lists each role with title, department, location, employment type, compensation range (when present), and full description
- Provides a simple department filter dropdown
- **Does not** render any apply buttons, forms, or links to apply

---

## 4. Building the Docker image

The repository includes a `Dockerfile` suitable for Cloud Run.

From the project root:

```bash
gcloud config set project YOUR_GCP_PROJECT_ID

gcloud builds submit \
  --tag gcr.io/YOUR_GCP_PROJECT_ID/dave-referral-jobs-site
```

This will:

- Build a container image using the provided `Dockerfile`
- Push it to `gcr.io/YOUR_GCP_PROJECT_ID/dave-referral-jobs-site`

---

## 5. Deploying to Cloud Run

Once the image is built, deploy it to Cloud Run (fully managed):

```bash
gcloud run deploy dave-referral-jobs-site \
  --image gcr.io/YOUR_GCP_PROJECT_ID/dave-referral-jobs-site \
  --platform managed \
  --region YOUR_REGION \
  --allow-unauthenticated \
  --set-env-vars ASHBY_API_KEY=your-real-ashby-api-key,ASHBY_ORGANIZATION_SLUG=dave
```

Notes:

- Replace `YOUR_GCP_PROJECT_ID` and `YOUR_REGION` with your actual project ID and Cloud Run region (for example, `us-central1`).
- Cloud Run automatically injects a `PORT` environment variable (usually `8080`); the app reads this value.
- For better security, consider using **Secret Manager** and `--set-secrets` instead of putting the API key directly in `--set-env-vars`.

After a successful deploy, the command will output a URL, e.g.:

```text
https://dave-referral-jobs-site-xxxxxxxxx-uc.a.run.app
```

Open that URL in your browser to access the referral jobs viewer.

---

## 6. Updating the service

When you change code:

1. Rebuild and push a new image:

   ```bash
   gcloud builds submit \
     --tag gcr.io/YOUR_GCP_PROJECT_ID/dave-referral-jobs-site
   ```

2. Re-deploy Cloud Run using the same `gcloud run deploy` command as above.

Your existing environment variables will be preserved unless you change them.

---

## 7. Safety and limitations

- The page is explicitly **read-only**: it surfaces job data from Ashby but does not allow applying.
- The header/footer styling and colors are inspired by Dave's career page and Ashby-hosted board, but there are no application or referral flows here.
- All access to Ashby is server-side via the API key; the key is never exposed to the browser.

