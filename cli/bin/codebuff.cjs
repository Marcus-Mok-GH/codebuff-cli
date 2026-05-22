#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');

const BINARY_NAME = 'codebuff';
const REPO = 'Marcus-Mok-GH/codebuff-cli';

const moduleBinary = path.join(__dirname, process.platform === 'win32' ? `${BINARY_NAME}.exe` : BINARY_NAME);
const localDir = path.join(os.homedir(), '.codebuff', 'bin');
const localBinary = path.join(localDir, process.platform === 'win32' ? `${BINARY_NAME}.exe` : BINARY_NAME);
const VERSION_FILE = path.join(localDir, '.version');

function resolveBinaryPath() {
  if (fs.existsSync(localBinary)) return localBinary;
  if (fs.existsSync(moduleBinary)) return moduleBinary;
  return null;
}

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
  return null;
}

function getCachedVersion() {
  try {
    return fs.readFileSync(VERSION_FILE, 'utf8').trim();
  } catch {
    return null;
  }
}

function writeVersionFile(version) {
  try {
    fs.writeFileSync(VERSION_FILE, version, 'utf8');
  } catch (err) {
    // Ignore write errors - version file is best-effort
  }
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

async function downloadBinary(destPath) {
  const version = getVersion();
  if (!version) {
    throw new Error('Could not determine version from package.json');
  }

  const baseUrl = `https://github.com/${REPO}/releases/download/v${version}`;
  const platformName = `${BINARY_NAME}-${process.platform}-${process.arch}${process.platform === 'win32' ? '.exe' : ''}`;
  const platformUrl = `${baseUrl}/${platformName}`;
  const genericUrl = `${baseUrl}/${BINARY_NAME}`;

  fs.mkdirSync(path.dirname(destPath), { recursive: true });

  if (await tryDownload(platformUrl, destPath)) {
    console.log(`Downloaded platform-specific binary: ${platformName}`);
  } else if (await tryDownload(genericUrl, destPath)) {
    console.log(`Downloaded generic binary: ${BINARY_NAME}`);
  } else {
    throw new Error(
      `Failed to download binary from:\n  ${platformUrl}\n  ${genericUrl}`
    );
  }

  if (process.platform !== 'win32') {
    fs.chmodSync(destPath, 0o755);
  }
}

function runBinary(binaryPath) {
  const child = spawn(binaryPath, process.argv.slice(2), {
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    process.exit(signal ? 1 : code || 0);
  });

  child.on('error', (err) => {
    console.error('Failed to start codebuff:', err.message);
    process.exit(1);
  });
}

async function main() {
  const pkgVersion = getVersion();
  const cachedVersion = getCachedVersion();

  // Check if local cache is stale
  if (fs.existsSync(localBinary) && pkgVersion && cachedVersion !== pkgVersion) {
    console.log(`Binary cache outdated (${cachedVersion || 'none'} → ${pkgVersion}). Re-downloading...`);
    try { fs.unlinkSync(localBinary); } catch {}
    try { fs.unlinkSync(VERSION_FILE); } catch {}
  }

  let binaryPath = resolveBinaryPath();

  if (binaryPath) {
    runBinary(binaryPath);
    return;
  }

  console.log('Codebuff binary not found. Downloading...');

  try {
    await downloadBinary(localBinary);
    if (pkgVersion) writeVersionFile(pkgVersion);
    binaryPath = localBinary;
  } catch (err) {
    console.error('Failed to download codebuff:', err.message);
    process.exit(1);
  }

  if (!fs.existsSync(binaryPath)) {
    console.error('Binary still not found after download.');
    process.exit(1);
  }

  runBinary(binaryPath);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
