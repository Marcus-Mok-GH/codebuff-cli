# Codebuff CLI — Known Issues & Root Causes

> This document captures all identified issues from the 2026-05-25 investigation, their root causes, and recommended fixes.

---

## 1. "Failed to start agent run" — No Error Details in UI

**Symptom:** When `client.run()` fails (e.g., backend unreachable, 500 error, DNS failure), the TUI shows only a generic banner like "Failed to start agent run" with no actionable detail.

**Root Cause:**
- `handleRunError` in `cli/src/hooks/helpers/send-message.ts` calls `getErrorObject(error, { includeRawError: true })` to build a rich `ErrorObject` containing `message`, `rawError`, `cause`, `url`, `statusCode`, `responseBody`, etc.
- It then logs that full object via `logger.error()` — but the CLI logger writes to a hidden JSONL log file (`log.jsonl`), not to the console or TUI.
- Finally it calls `updater.setError(errorInfo.message)`, passing **only** the top-level message string. The `userError` field in the chat store therefore contains a generic string like "Failed to start agent run", and `UserErrorBanner` renders exactly that.
- The actual backend error, URL that failed, status code, and response body are all lost to the user.

**Fix (APPLIED):**
- Modified `handleRunError` to construct a full diagnostic string from `errorInfo` including:
  - Primary error message
  - Cause chain (nested `cause` fields)
  - URL that was called (for API errors)
  - HTTP status code
  - Response body (truncated)
- Pass that full string to `updater.setError()` so the `UserErrorBanner` displays actionable detail.

**File:** `cli/src/hooks/helpers/send-message.ts`

---

## 2. Hidden Log Files — User Never Sees Them

**Symptom:** When things go wrong, users have no visibility into what actually happened. The CLI appears to swallow errors.

**Root Cause:**
- The CLI logger (`cli/src/utils/logger.ts`) writes structured logs to a local JSONL file (e.g., `log.jsonl`) instead of printing to `stderr` or rendering in the TUI.
- Because the TUI is running in interactive mode, normal `stderr` output would corrupt the display — but as a result, the log file is never surfaced to the user unless they know to go hunt for it on disk.
- In the `handleRunError` flow, the *only* place the full error object lands is that hidden log file.

**Fix (RECOMMENDED):**
- Option A: Print critical errors to `stderr` just before/after the TUI exits or when in non-interactive mode.
- Option B: Add a CLI flag or command (e.g., `--show-logs`, `codebuff logs`) that streams the JSONL log in a human-readable format.
- Option C: Ensure all errors passed to `updater.setError()` are fully descriptive (see Issue #1) so the TUI itself becomes the primary error channel.

---

## 3. Published npm Binary May Still Contain Dead Replit URLs

**Symptom:** The published npm package may reference obsolete Replit deployment URLs instead of the current backend endpoint.

**Root Cause:**
- The compiled/bundled CLI binary may have been cached with old constants (e.g., pointing to a now-defunct Replit app URL).
- `npm publish` does not automatically invalidate or rebuild the binary if the build artifact is checked in or cached in the publish script.
- Users installing from npm may therefore hit a dead URL and get connection errors (which then surface as Issue #1).

**Fix (RECOMMENDED):**
- Verify the latest published tarball on npm contains the correct backend endpoint (`fireworks-api-backend.vercel.app` or current canonical URL).
- If stale, perform a clean build (`rm -rf dist/ && bun run build`) and republish with a patch version bump.
- Consider adding a CI check that greps the built artefact for forbidden/deprecated URLs before publish.

---

## 4. @codebuff/sdk Publish Failed

**Symptom:** Publishing the `@codebuff/sdk` package to npm fails with a 403 or scope-related error.

**Root Cause:**
- The npm access token used in the publish workflow lacks permissions for the `@codebuff` scope.
- Scoped packages (`@org/pkg`) require either:
  - The token owner to be a member of the npm organisation/team that owns the scope, or
  - The package to be explicitly configured as public with `npm publish --access public` and the token having publish rights.

**Fix (RECOMMENDED):**
- Verify the npm token's associated user has publish rights to the `@codebuff` scope.
- If using an automation token, ensure it is granted the "Publish" permission for the organisation.
- Alternatively, create a dedicated npm automation token scoped specifically to `@codebuff/sdk`.
- Confirm `npm whoami` and `npm access list packages @codebuff` from the CI environment.

---

## 5. Backend Endpoint Case-Sensitivity

**Symptom:** The CLI sends `mode: "START"` (uppercase) but the backend originally only accepted `mode: "start"` (lowercase), causing validation failures.

**Status:** ✅ **FIXED**

**Details:**
- Verified on `fireworks-api-backend.vercel.app` that the endpoint now normalises or accepts both `"START"` and `"start"`.
- No further action required on the backend.

---

## Quick Reference

| Issue | Status | Owner | File(s) |
|---|---|---|---|
| 1. UI error detail | **Fixed** | CLI | `cli/src/hooks/helpers/send-message.ts` |
| 2. Hidden logs | Pending | CLI | `cli/src/utils/logger.ts` |
| 3. Dead Replit URLs in npm | Pending | Release | `sdk/scripts/publish.ts`, CI |
| 4. @codebuff/sdk publish | Pending | Release | npm token config |
| 5. Backend case-sensitivity | **Fixed** | Backend | `fireworks-api-backend.vercel.app` |
