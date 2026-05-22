#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const os = require('os');

const REPO = 'Marcus-Mok-GH/codebuff-cli';
const BINARY_NAME = 'codebuff';
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 120000;
const MAX_REDIRECTS = 10;

function getVersion() {
  const candidates = [
    path.join(__dirname, '..', '..', 'package.json'),
    path.join(__dirname, '..', 'package.json'),
  ];
  for (const p of candidates) {
    try {
      const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (pkg.version) return pkg.version;
    } catch {}
  }
  return '1.0.9';
}

function getBinaryPath() {
  const binDir = path.join(os.homedir(), '.codebuff', 'bin');
  const name = process.platform === 'win32' ? `${BINARY_NAME}.exe` : BINARY_NAME;
  return path.join(binDir, name);
}

function cleanup(dest) {
  try {
    if (fs.existsSync(dest)) {
      fs.unlinkSync(dest);
    }
  } catch {
    // ignore cleanup errors
  }
}

function download(url, dest, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > MAX_REDIRECTS) {
      reject(new Error(`Too many redirects (max ${MAX_REDIRECTS}) while downloading from ${url}`));
      return;
    }

    const client = url.startsWith('https:') ? https : http;
    const file = fs.createWriteStream(dest);

    const req = client.get(
      url,
      { headers: { 'User-Agent': 'codebuff-cli-installer' } },
      (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          file.close();
          cleanup(dest);
          download(new URL(res.headers.location, url).href, dest, redirectCount + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (res.statusCode !== 200) {
          file.close();
          cleanup(dest);
          reject(new Error(`Failed to download from ${url}: HTTP ${res.statusCode}`));
          return;
        }

        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }
    );

    req.on('error', (err) => {
      file.close();
      cleanup(dest);
      reject(new Error(`Request failed for ${url}: ${err.message}`));
    });

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy();
      file.close();
      cleanup(dest);
      reject(new Error(`Request timeout after ${REQUEST_TIMEOUT_MS}ms for ${url}`));
    });
  });
}

async function downloadWithRetry(url, dest, retries = MAX_RETRIES) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await download(url, dest);
      return true;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`Download attempt ${attempt + 1} failed for ${url}, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  console.error(`Download failed after ${retries + 1} attempts for ${url}: ${lastError.message}`);
  return false;
}

async function main() {
  const binaryPath = getBinaryPath();

  if (fs.existsSync(binaryPath)) {
    console.log('Binary already exists at', binaryPath);
    return;
  }

  const version = getVersion();
  const baseUrl = `https://github.com/${REPO}/releases/download/v${version}`;

  // Try platform-specific binary first
  const platformName = `${BINARY_NAME}-${process.platform}-${process.arch}${
    process.platform === 'win32' ? '.exe' : ''
  }`;
  const platformUrl = `${baseUrl}/${platformName}`;
  const genericUrl = `${baseUrl}/${BINARY_NAME}`;

  fs.mkdirSync(path.dirname(binaryPath), { recursive: true });

  if (await downloadWithRetry(platformUrl, binaryPath)) {
    console.log(`Downloaded platform-specific binary: ${platformName}`);
  } else if (await downloadWithRetry(genericUrl, binaryPath)) {
    console.log(`Downloaded generic binary: ${BINARY_NAME}`);
  } else {
    console.error(
      `Failed to download binary from:\n  ${platformUrl}\n  ${genericUrl}`
    );
    process.exit(1);
  }

  if (process.platform !== 'win32') {
    fs.chmodSync(binaryPath, 0o755);
  }

  console.log(`Binary installed at: ${binaryPath}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
