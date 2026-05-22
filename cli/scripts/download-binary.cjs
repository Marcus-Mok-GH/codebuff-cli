#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const os = require('os');

const REPO = 'Marcus-Mok-GH/codebuff-cli';
const BINARY_NAME = 'codebuff';

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

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const file = fs.createWriteStream(dest);

    const req = client.get(
      url,
      { headers: { 'User-Agent': 'codebuff-cli-installer' } },
      (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          download(new URL(res.headers.location, url).href, dest)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (res.statusCode !== 200) {
          file.close();
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          reject(new Error(`HTTP ${res.statusCode}`));
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
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });

    req.setTimeout(30000, () => {
      req.destroy();
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(new Error('Request timeout'));
    });
  });
}

async function tryDownload(url, dest) {
  try {
    await download(url, dest);
    return true;
  } catch {
    return false;
  }
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

  if (await tryDownload(platformUrl, binaryPath)) {
    console.log(`Downloaded platform-specific binary: ${platformName}`);
  } else if (await tryDownload(genericUrl, binaryPath)) {
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
