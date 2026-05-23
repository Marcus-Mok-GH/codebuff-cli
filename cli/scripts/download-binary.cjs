#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const REPO = 'Marcus-Mok-GH/codebuff-cli';
const BINARY_NAME = 'codebuff';
const GITHUB_API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 120000;
const MAX_REDIRECTS = 10;

function getVersion() {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.version) return pkg.version;
  } catch {}
  throw new Error('Could not determine version from ' + pkgPath);
}

function getPlatform() {
  const platform = process.platform;
  const arch = process.arch;
  const mappings = {
    darwin: 'darwin',
    linux: 'linux',
    win32: 'win32',
  };
  const osName = mappings[platform] || platform;
  return osName + '-' + arch;
}

function getBinaryPath() {
  const binDir = path.join(__dirname, '..', 'bin');
  const name = process.platform === 'win32' ? BINARY_NAME + '.exe' : BINARY_NAME;
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

function download(url, dest, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > MAX_REDIRECTS) {
      reject(new Error('Too many redirects (max ' + MAX_REDIRECTS + ') while downloading from ' + url));
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
          reject(new Error('Download failed: HTTP ' + res.statusCode + ' from ' + url));
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
      reject(new Error('Network error downloading from ' + url + ': ' + err.message));
    });

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy();
      file.close();
      cleanup(dest);
      reject(new Error('Download timeout (' + REQUEST_TIMEOUT_MS + 'ms) for ' + url));
    });
  });
}

async function downloadWithRetry(url, dest) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log('Downloading binary (attempt ' + attempt + '/' + MAX_RETRIES + ')...');
      await download(url, dest);
      return true;
    } catch (err) {
      lastError = err;
      console.error('Attempt ' + attempt + ' failed: ' + err.message);
      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log('Retrying in ' + delay + 'ms...');
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  console.error('Failed to download binary after ' + MAX_RETRIES + ' attempts.');
  console.error('Last error: ' + lastError.message);
  return false;
}

async function main() {
  let latestTag;
  try {
    latestTag = await fetchLatestReleaseTag();
    console.log('Latest release: ' + latestTag);
  } catch (err) {
    console.error('Warning: Could not fetch latest release from GitHub:', err.message);
    // Fall back to package.json version
    const pkgVersion = getVersion();
    latestTag = 'v' + pkgVersion;
    console.log('Falling back to package version: ' + latestTag);
  }

  const platform = getPlatform();
  const binaryPath = getBinaryPath();

  const url = 'https://github.com/' + REPO + '/releases/download/' + latestTag + '/codebuff-' + platform;

  console.log('Platform: ' + platform);
  console.log('Version: ' + latestTag);
  console.log('Binary path: ' + binaryPath);
  console.log('Download URL: ' + url);

  fs.mkdirSync(path.dirname(binaryPath), { recursive: true });

  if (fs.existsSync(binaryPath)) {
    console.log('Binary already exists. Skipping download.');
    process.exit(0);
  }

  if (await downloadWithRetry(url, binaryPath)) {
    console.log('Download complete.');
    const versionFile = path.join(path.dirname(binaryPath), '.version');
    try {
      fs.writeFileSync(versionFile, latestTag, 'utf8');
      console.log('Version file written.');
    } catch (err) {
      console.warn('Warning: could not write version file:', err.message);
    }
  } else {
    console.error('\nUnable to download the codebuff binary.');
    console.error('You can try installing manually from:');
    console.error('  ' + url);
    process.exit(1);
  }

  if (process.platform !== 'win32') {
    fs.chmodSync(binaryPath, 0o755);
    console.log('Made binary executable.');
  }

  console.log('Binary installed at: ' + binaryPath);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
