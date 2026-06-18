import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const datasetPath = path.join(root, 'src/generated/app-data.json');
const outputDir = path.join(root, 'data/sources');
const filesDir = path.join(outputDir, 'files');
const manifestPath = path.join(outputDir, 'manifest.json');

const dataset = JSON.parse(await fs.readFile(datasetPath, 'utf8'));
const sources = dataset.provenance ?? [];

await fs.mkdir(filesDir, { recursive: true });

const archivedAt = new Date().toISOString();
const manifest = [];
let failures = 0;

for (const source of sources) {
  try {
    const response = await fetchBuffer(source.url);
    const extension = extensionFor(source.url, response.headers['content-type']);
    const filename = `${source.id}${extension}`;
    const filePath = path.join(filesDir, filename);
    await fs.writeFile(filePath, response.body);
    const sha256 = crypto.createHash('sha256').update(response.body).digest('hex');
    manifest.push({
      id: source.id,
      title: source.title,
      originalUrl: source.url,
      finalUrl: response.finalUrl,
      statusCode: response.statusCode,
      contentType: response.headers['content-type'] ?? '',
      bytes: response.body.length,
      sha256,
      archivedAt,
      path: `files/${filename}`
    });
    console.log(`${source.id}: ${response.statusCode} ${response.body.length} bytes`);
  } catch (error) {
    failures += 1;
    manifest.push({
      id: source.id,
      title: source.title,
      originalUrl: source.url,
      error: error instanceof Error ? error.message : String(error),
      archivedAt
    });
    console.error(`${source.id}: ${error instanceof Error ? error.message : error}`);
  }
}

await fs.writeFile(manifestPath, `${JSON.stringify({
  generatedAt: archivedAt,
  sourceCount: sources.length,
  archivedCount: manifest.filter((item) => item.path).length,
  sources: manifest
}, null, 2)}\n`);

if (failures > 0) {
  process.exitCode = 1;
}

function fetchBuffer(url, redirectCount = 0) {
  if (redirectCount > 8) {
    return Promise.reject(new Error('too many redirects'));
  }

  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const request = client.get(url, {
      headers: {
        'accept': '*/*',
        'accept-encoding': 'identity',
        'user-agent': 'ROAIHOF source archiver (+https://razv.xyz)'
      },
      timeout: 30000
    }, (response) => {
      const statusCode = response.statusCode ?? 0;
      const location = response.headers.location;
      if ([301, 302, 303, 307, 308].includes(statusCode) && location) {
        response.resume();
        const nextUrl = new URL(location, url).toString();
        resolve(fetchBuffer(nextUrl, redirectCount + 1));
        return;
      }
      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new Error(`HTTP ${statusCode}`));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        resolve({
          finalUrl: url,
          statusCode,
          headers: response.headers,
          body: Buffer.concat(chunks)
        });
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('request timed out'));
    });
    request.on('error', reject);
  });
}

function extensionFor(url, contentType = '') {
  const pathname = new URL(url).pathname.toLowerCase();
  const ext = path.extname(pathname);
  if (ext && ext.length <= 8) {
    return ext;
  }
  const type = contentType.toLowerCase().split(';')[0].trim();
  if (type === 'application/pdf') return '.pdf';
  if (type === 'application/json' || type.endsWith('+json')) return '.json';
  if (type === 'text/html') return '.html';
  if (type === 'text/plain') return '.txt';
  return '.bin';
}
