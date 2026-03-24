#!/usr/bin/env node
/**
 * fetch-jobs.js
 * ─────────────────────────────────────────────────────────────
 * Fetches all open job postings from the Ashby internal board,
 * strips sensitive / internal-only fields, and writes jobs.json
 * to the repo root so the static frontend can consume it.
 *
 * Required env var:
 *   ASHBY_API_KEY  — stored as a GitHub Secret (never committed)
 * ─────────────────────────────────────────────────────────────
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const API_KEY = process.env.ASHBY_API_KEY;
console.log(`🔑 Key loaded: ${API_KEY ? API_KEY.slice(0,4) + "****" : "MISSING"}`);

if (!API_KEY) {
  console.error('❌  ASHBY_API_KEY environment variable is missing.');
  console.error('    Add it as a GitHub Secret: Settings → Secrets → Actions → New secret');
  process.exit(1);
}

console.log(`🔑  API key loaded: ${API_KEY.slice(0, 4)}${'*'.repeat(API_KEY.length - 4)}`);

// ── Fields to remove from every posting before writing to disk ──
const STRIP_FIELDS = [
  'hiringTeam',
  'hiringManager',
  'recruiter',
  'coordinator',
  'sourcers',
  'teamMembers',
  'applicationFormDefinition',
  'internalNotes',
  'customFields',
  'surveyForms',
  'jobRequisitions',
  'interviewPlan',
];

// ── Ashby REST helper (basic auth: API key as username, no password) ──
function ashbyPost(endpoint, body = {}) {
  return new Promise((resolve, reject) => {
    const auth    = Buffer.from(`${API_KEY}:`).toString('base64');
    const payload = JSON.stringify(body);

    const options = {
      hostname : 'api.ashbyhq.com',
      path     : `/${endpoint}`,
      method   : 'POST',
      headers  : {
        Authorization  : `Basic ${auth}`,
        'Content-Type' : 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let raw = '';
      console.log(`   HTTP status: ${res.statusCode}`);
res.on('data', (chunk) => { raw += chunk; });
res.on('end',  () => {
  console.log(`   Raw response: ${raw.slice(0, 300)}`);
  try   { resolve(JSON.parse(raw)); }
        catch { reject(new Error(`Non-JSON response from Ashby: ${raw.slice(0, 200)}`)); }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Remove all sensitive fields from a single posting object ──
function sanitize(posting) {
  const out = { ...posting };
  STRIP_FIELDS.forEach((f) => delete out[f]);

  // Also scrub any nested job object that might carry hiring team data
  if (out.job) {
    STRIP_FIELDS.forEach((f) => delete out.job[f]);
  }

  return out;
}

// ── Page through jobPosting.list until no more cursors ──
async function fetchAllPostings() {
  const all    = [];
  let   cursor = null;
  let   page   = 1;

  console.log('📡  Connecting to Ashby API…');

  do {
    const body = { limit: 50 };
    if (cursor) body.cursor = cursor;

    const resp = await ashbyPost('jobPosting.list', body);

    if (!resp.success) {
      throw new Error(`Ashby API returned an error: ${JSON.stringify(resp)}`);
    }

    const batch = resp.results ?? [];
    all.push(...batch);
    cursor = resp.nextCursor ?? null;

    console.log(`   Page ${page}: ${batch.length} postings (running total: ${all.length})`);
    page++;
  } while (cursor);

  return all;
}

// ── Main ──
async function main() {
  try {
    const allPostings = await fetchAllPostings();

    // Keep only open postings; remove confidential / draft / closed
    const open = allPostings
      .filter((p) => {
        const status = (p.status ?? '').toLowerCase();
        return status === 'open' || status === 'active' || status === 'published';
      })
      .map(sanitize);

    console.log(`\n✅  ${open.length} open postings after filtering`);

    const output = {
      fetchedAt : new Date().toISOString(),
      count     : open.length,
      jobs      : open,
    };

    // Write to repo root (one level up from /scripts)
    const dest = path.resolve(__dirname, '..', 'jobs.json');
    fs.writeFileSync(dest, JSON.stringify(output, null, 2));
    console.log(`💾  jobs.json written → ${dest}`);

  } catch (err) {
    console.error('❌  fetch-jobs failed:', err.message);
    process.exit(1);
  }
}

main();
