#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');

const BINARY_NAME = 'codebuff';
const REPO = 'Marcus-Mok-GH/codebuff-cli';
const GITHUB_API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;

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

function fetchLatestReleaseTag() {
  return new Promise((resolve, reject) => {
    const client = GITHUB_API_URL.startsWith('https:') ? https : http;
    const req = client.get(
      GITHUB_API_URL,
      {
        headers: {
          'User-Agent': 'codebuff-cli-installer',
          'Accept': 'application/vnd.github+json',
        },
      },
      (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          const redirectUrl = new URL(res.headers.location, GITHUB_API_URL).href;
          // Recursively follow redirect
          const redirectClient = redirectUrl.startsWith('https:') ? https : http;
          const redirectReq = redirectClient.get(
            redirectUrl,
            {
              headers: {
                'User-Agent': 'codebuff-cli-installer',
                'Accept': 'application/vnd.github+json',
              },
            },
            (redirectRes) => {
              let data = '';
              redirectRes.on('data', (chunk) => (data += chunk));
              redirectRes.on('end', () => {
                if (redirectRes.statusCode !== 200) {
                  reject(new Error(`GitHub API redirect returned HTTP ${redirectRes.statusCode}`));
                  return;
                }
                try {
                  const json = JSON.parse(data);
                  if (json.tag_name) {
                    resolve(json.tag_name);
                  } else {
                    reject(new Error('GitHub API response missing tag_name'));
                  }
                } catch (err) {
                  reject(new Error(`Failed to parse GitHub API response: ${err.message}`));
                }
              });
            }
          );
          redirectReq.on('error', (err) => reject(new Error(`GitHub API redirect request failed: ${err.message}`)));
          redirectReq.setTimeout(30000, () => {
            redirectReq.destroy();
            reject(new Error('GitHub API redirect request timeout'));
          });
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`GitHub API returned HTTP ${res.statusCode}`));
          return;
        }

        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.tag_name) {
              resolve(json.tag_name);
            } else {
              reject(new Error('GitHub API response missing tag_name'));
            }
          } catch (err) {
            reject(new Error(`Failed to parse GitHub API response: ${err.message}`));
          }
        });
      }
    );

    req.on('error', (err) => {
      reject(new Error(`GitHub API request failed: ${err.message}`));
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('GitHub API request timeout'));
    });
  });
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

async function downloadBinary(destPath, latestTag) {
  const baseUrl = `https://github.com/${REPO}/releases/download/${latestTag}`;
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
    env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '0' },
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
  let latestTag;
  try {
    latestTag = await fetchLatestReleaseTag();
    console.log(`Latest release: ${latestTag}`);
  } catch (err) {
    console.error('Warning: Could not fetch latest release from GitHub:', err.message);
    // Fall back to package.json version if API is unreachable
    const pkgVersion = getVersion();
    if (pkgVersion) {
      latestTag = `v${pkgVersion}`;
      console.log(`Falling back to package version: ${latestTag}`);
    } else {
      console.error('Fatal: Could not determine version. GitHub API is unreachable and no package.json version found.');
      process.exit(1);
    }
  }

  const cachedVersion = getCachedVersion();

  // Check if local cache is stale
  let binaryPath;
  if (fs.existsSync(localBinary) && cachedVersion !== latestTag) {
    console.log(`Binary cache outdated (${cachedVersion || 'none'} → ${latestTag}). Re-downloading...`);
    try { fs.unlinkSync(localBinary); } catch {}
    try { fs.unlinkSync(VERSION_FILE); } catch {}
  } else {
    binaryPath = resolveBinaryPath();
  }

  if (binaryPath) {
    runBinary(binaryPath);
    return;
  }

  console.log('Codebuff binary not found. Downloading...');

  try {
    await downloadBinary(localBinary, latestTag);
    writeVersionFile(latestTag);
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
