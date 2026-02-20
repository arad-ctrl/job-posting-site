import http from "http";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const PORT = process.env.PORT || 3000;
const REFRESH_INTERVAL_MS = Number(process.env.REFRESH_INTERVAL_MS || 900000);

const SOURCE_PROVIDER = process.env.SOURCE_PROVIDER || "ashby-internal";
const SOURCE_URL = process.env.SOURCE_URL || process.env.JOB_BOARD_API_URL || "";
const SOURCE_TOKEN = process.env.SOURCE_TOKEN || process.env.JOB_BOARD_API_TOKEN || "";
const ASHBY_BOARD_ID = process.env.ASHBY_BOARD_ID || "329606d8-b9c8-4e09-a75e-1125a5651162";
const DEFAULT_ASHBY_INTERNAL_URL = `https://app.ashbyhq.com/internal/job-board/${ASHBY_BOARD_ID}`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

let cache = {
  fetchedAt: null,
  jobs: [],
  error: "No sync has run yet."
};

const normalizeJobs = (payload) => {
  const jobs = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.jobs)
      ? payload.jobs
      : [];

  return jobs.map((job, index) => ({
    id: String(job.id ?? job._id ?? job.requisitionId ?? index),
    title: String(job.title ?? "Untitled Role"),
    team: String(job.team ?? job.department ?? job.departmentName ?? "General"),
    location: String(job.location ?? job.locationName ?? "Flexible"),
    type: String(job.type ?? job.employmentType ?? "Full-time"),
    summary: String(job.summary ?? job.description ?? "Description coming soon.")
  }));
};

const parseJsonFromHtml = (html) => {
  const nextDataMatch = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch) {
    return JSON.parse(nextDataMatch[1]);
  }

  const jsonLdMatches = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  if (!jsonLdMatches.length) {
    return null;
  }

  return jsonLdMatches.map((match) => JSON.parse(match[1]));
};

const extractJobsFromHtmlJson = (parsedJson) => {
  const jobCandidates = [];

  const visit = (value) => {
    if (!value || typeof value !== "object") {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (Array.isArray(value.jobs)) {
      jobCandidates.push(...value.jobs);
    }

    if (Array.isArray(value.jobPostings)) {
      jobCandidates.push(...value.jobPostings);
    }

    if (value["@type"] === "JobPosting") {
      jobCandidates.push({
        id: value.identifier?.value,
        title: value.title,
        department: value.hiringOrganization?.name,
        location: value.jobLocation?.address?.addressLocality,
        description: value.description
      });
    }

    Object.values(value).forEach(visit);
  };

  visit(parsedJson);

  return jobCandidates;
};

const fetchJsonOrHtmlJobs = async ({ url, token }) => {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Upstream API returned ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return await response.json();
  }

  const html = await response.text();
  const parsedJson = parseJsonFromHtml(html);
  const jobs = parsedJson ? extractJobsFromHtmlJson(parsedJson) : [];

  if (!jobs.length) {
    throw new Error("Unable to parse job listings from upstream response.");
  }

  return { jobs };
};

const providers = {
  "ashby-internal": {
    describe: () => ({
      provider: "ashby-internal",
      source: SOURCE_URL || DEFAULT_ASHBY_INTERNAL_URL
    }),
    fetch: async () => {
      const url = SOURCE_URL || DEFAULT_ASHBY_INTERNAL_URL;
      return await fetchJsonOrHtmlJobs({ url, token: SOURCE_TOKEN });
    }
  },
  "generic-json": {
    describe: () => ({
      provider: "generic-json",
      source: SOURCE_URL || null
    }),
    fetch: async () => {
      if (!SOURCE_URL) {
        throw new Error("Set SOURCE_URL (or JOB_BOARD_API_URL) for generic-json provider.");
      }
      return await fetchJsonOrHtmlJobs({ url: SOURCE_URL, token: SOURCE_TOKEN });
    }
  }
};

const resolveProvider = () => {
  const selected = providers[SOURCE_PROVIDER];
  if (selected) {
    return selected;
  }

  throw new Error(`Unsupported SOURCE_PROVIDER: ${SOURCE_PROVIDER}. Supported values: ${Object.keys(providers).join(", ")}`);
};

const syncJobs = async () => {
  try {
    const provider = resolveProvider();
    const payload = await provider.fetch();
    cache = {
      fetchedAt: new Date().toISOString(),
      jobs: normalizeJobs(payload),
      error: null
    };
  } catch (error) {
    cache = {
      ...cache,
      fetchedAt: new Date().toISOString(),
      error: error.message
    };
  }
};

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { "Content-Type": mimeTypes[".json"] });
  res.end(JSON.stringify(payload));
};

const sendFile = async (res, filePath) => {
  try {
    const ext = path.extname(filePath);
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain; charset=utf-8" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
};

await syncJobs();
setInterval(syncJobs, REFRESH_INTERVAL_MS);

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/jobs") {
    sendJson(res, 200, {
      ...cache,
      ...resolveProvider().describe(),
      notice: "This public site is informational only and does not accept applications."
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/jobs/refresh") {
    await syncJobs();
    sendJson(res, 200, {
      ok: true,
      fetchedAt: cache.fetchedAt,
      count: cache.jobs.length,
      error: cache.error
    });
    return;
  }

  if (req.method === "GET") {
    const safePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = path.normalize(path.join(publicDir, safePath));
    if (!filePath.startsWith(publicDir)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    await sendFile(res, filePath);
    return;
  }

  res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Method not allowed");
});

server.listen(PORT, () => {
  const details = resolveProvider().describe();
  console.log(`Job posting site running on http://localhost:${PORT}`);
  console.log(`Provider: ${details.provider}`);
  console.log(`Source: ${details.source}`);
});
