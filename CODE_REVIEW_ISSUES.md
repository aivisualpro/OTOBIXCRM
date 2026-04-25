# Otobix CRM — Code Review Findings

Date: 2026-04-25
Reviewer: AI deep-dive across `app/`, `server/`, root configs

Issues are grouped by severity. Critical and High items should be fixed before more features land.

---

## CRITICAL

### 1. There is no real server-side authentication
- `app/middleware/auth.global.ts` only checks whether the cookie `isLoggedIn` has any value. The cookie is set client-side in `app/components/auth/SignIn.vue` (`isLoggedIn.value = 'true'`). Anyone can open DevTools, set `isLoggedIn=true`, paste a fake `userData` cookie, and reach every page.
- The `authToken` returned by `/api/users/login` is generated with `crypto.randomUUID()` and never stored, indexed, or validated server-side. It is decorative.
- Server endpoints like `/api/leads`, `/api/cars`, `/api/users`, `/api/workspaces`, `/api/dropdowns` have **no auth check at all** — they read straight from Mongo for any caller, authenticated or not.
- The few endpoints that do "RBAC" (`server/api/leads/index.get.ts`, `counts.get.ts`, `cars/index.get.ts`, `cars/facets.get.ts`, `cars/counts.get.ts`) do it by reading the unsigned `userData` cookie and trusting whatever role string it contains. An attacker can set `userData={"userRole":"Admin","email":"x"}` and unlock everything.

Fix direction: store sessions server-side (e.g. `sessions` collection keyed by `authToken`), validate on every request via a server middleware in `server/middleware/`, and never derive identity or role from a client-set cookie.

### 2. Plain-text password storage and accept-anything fallback
`server/api/users/login.post.ts`:
```ts
isValidPassword = (user.password === body.password)
```
The login flow accepts a literal `password` string match if no bcrypt hash is present. Combined with `server/api/users/add.post.ts` and `update.put.ts`, every new/updated user has both `password: rawPassword` (plaintext) **and** `passwordHash` written to Mongo. So your DB stores cleartext passwords next to the hash.

Fix: stop writing `password`, drop the cleartext fallback in login, and run a one-time migration to null the field on existing rows.

### 3. Database credentials live in a plain `.env` and are exposed to the client config
- The `.env` file in the repo root contains the production MongoDB URI with username + password (`AmitParekh:OtoBixAuctionApp@…`). Even though `.env` is gitignored, it sits in a folder you actively share. Rotate that DB user and password now.
- `nuxt.config.ts` only declares `runtimeConfig.mongodbUri` (no default), which is fine, but `productionMongodbDbName: 'otobix_auction_app'` is hard-coded in the config. Move it to env.
- Multiple root scripts (`test_db.js`, `check-db.ts`, `backfill_*.mjs`, `updateApprovalStatus.mjs`, `listCollections.js`, `test-bids-agg.mjs`, etc.) read `MONGODB_URI` from `.env` and connect to production directly. These should not ship with the app — move them to a `scripts/` folder outside the build, or delete.

### 4. Login endpoint returns the full user document including the password hash
```ts
const safeUser = { ...user, id: user._id.toString() }
return { token, user: safeUser, message: 'Login successful' }
```
That object is then JSON-stringified into a cookie (`userData`) and sent to the browser, exposing `password`, `passwordHash`, internal flags, and bid history of the staff member. `/api/users` (`index.get.ts`) explicitly comments "keeping all fields including password" and returns every password and hash to whoever calls it.

Fix: whitelist the fields you actually need (`id`, `userName`, `email`, `userRole`, `image`, `workspaces`, etc.) before returning.

### 5. NoSQL injection on every search field
Most list endpoints feed user input straight into `$regex`:
```ts
filter.make = { $regex: new RegExp(filterMake, 'i') } // cars/index.get.ts
const q = { ownerName: { $regex: search, $options: 'i' } } // leads/index.get.ts
filter.$and.push({ addedBy: { $regex: filterAddedBy, $options: 'i' } })
```
Crafted regex like `^(.*a){50}$` against a large collection causes a ReDoS that pins your Mongo CPU. The login regex in `users/login.post.ts` is the only one that escapes its input. Apply the same `replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` everywhere before passing user strings into `$regex`.

### 6. `cookieOptions.secure` is computed against client globals on the server
`auth.global.ts`:
```ts
secure: import.meta.server ? import.meta.env.PROD : globalThis.location.protocol === 'https:'
```
With `ssr: false` in `nuxt.config.ts`, `import.meta.server` is always false at runtime, so this only ever falls through to the browser branch. That's mostly fine for SPA mode, but when the cookie is also written from `SignIn.vue` you don't pass `secure` at all — so login cookies will be issued without `Secure` even in production. Add `secure: true` for prod cookies and `httpOnly: true` for `authToken`/`userData` (those should not be readable by JS at all — this is part of why issue #1 is so bad).

---

## HIGH

### 7. `mongodb` driver is on a non-existent major version
`"mongodb": "^7.1.0"`. The current major is 6.x; v7 is not published yet. Either you're locked to a release-candidate cache or the install will pick a 6.x your lockfile pins. Explicitly pin a stable 6.x and run `pnpm up`.

### 8. `@types/node` is on `^25.2.3` while `engines.node` is `22.x`
Mismatched type definitions can mask real issues (new APIs your runtime doesn't have, removed ones you still call). Pin `@types/node` to `^22.x` to match the runtime.

### 9. Vercel config typo
The file is named `verce.json` (missing the final `l`), so Vercel never reads it. Rename to `vercel.json`.

### 10. Auth middleware silently re-assigns cookies to renew them
The "rolling renewal" relies on `cookie.value = cookie.value` — that pattern only works because `useCookie` is a writable proxy, but the comment chain (`// eslint-disable-next-line no-self-assign` on three lines) is a smell. Wrap it in a single helper that actually re-`setCookie`s with fresh `maxAge`, otherwise some browsers won't refresh the expiry.

### 11. SSE endpoint has no per-user filter or auth
`server/api/live-sync.get.ts` streams every change for every collection (`leads`, `cars`, `users`, `workspaces`) to anyone who connects. A retailer logged into one workspace receives admin user creates/updates including everything in the broadcast payload. Filter the stream by user role/workspace, and require auth before subscribing.

### 12. Unbounded ring buffer growth and event loss
- `_eventBuffer` keeps only 500 events. On a busy CRM that's seconds of history; reconnecting clients silently miss data and never realize.
- The buffer is per-process. With Vercel/Render serverless or multi-instance deploys, each instance has its own counter, so `eventId` collides and clients see out-of-order updates.

If you keep the SSE design, move to a Redis pub/sub or a Mongo change stream so all instances share state.

### 13. `cars_output.json` (2.6 MB) is committed at the repo root
That file plus the half-dozen `test_*.js`, `fix_*.py`, `tmp_fix_logs.cjs`, `dummy.jpg`, `dummy.mp4`, `test.png` clutter the repo and slow installs. Delete or move to `tools/`.

### 14. README is empty
`README.md` is 0 bytes. New devs (or future-you) have nothing to onboard from.

### 15. Type holes in the server layer
`getLeadsDb(event: any)`, `_currentUser: Record<string, any>`, `body: any`, `updateFields: any`, plus `({ _id: counterId } as any)` casts to defeat the driver's typings. This is the source of subtle bugs — for example `leads/update.put.ts` tries to compute diffs with `JSON.stringify(oldVal) ?? '""'`, but `JSON.stringify(undefined)` is `undefined` (not `''`), so a deleted field reads as the string `"undefined"` and you log a phantom change. Tighten types and add a runtime validator (zod is already a dep).

---

## MEDIUM

### 16. `SignIn.vue` writes `userData` as a JSON string into a cookie
Cookies are size-limited (~4KB per cookie, ~16KB total per domain). Stuffing the entire user document in there will bite you when permissions arrays grow. Store only an opaque session id and fetch the user from `/api/me` on boot.

### 17. Login `$regex` allows partial-match attacks via empty input edge cases
The regex is anchored (`^…$`), good. But the `phoneNumber` branch is an exact string match against the unsanitized input — calling `findOne({ phoneNumber: { $gt: '' } })` style queries is blocked by Nuxt's body parsing for top-level objects, but worth adding a `typeof === 'string'` guard regardless.

### 18. `leads/index.get.ts` mixes filter logic and broadcast scope
The "Under Review" branch silently filters by `qcBy === currentUserEmail` for non-admins. Because the role is read from the (spoofable) cookie, a non-admin who deletes the cookie becomes an admin from this code's perspective. Tie this to a real session.

### 19. Duplicate filter logic across `index.get.ts` and `counts.get.ts`
The leads list and counts endpoints reimplement the same filter parser. Any change to one drifts. Extract a `buildLeadsFilter(query, currentUser)` util in `server/utils/`.

### 20. `cars/update.put.ts` accepts arbitrary `_push` payloads
```ts
const { _id, id, _push, ...updateFields } = body
if (_push)
  updateQuery.$push = _push
```
That's "push anything into any array on a car document," driven by the request body. Whitelist allowed `$push` fields.

### 21. Heavy pages (1000+ lines) in `app/pages/`
`settings/workspaces.vue` (1178), `banners.vue` (973), `dropdowns.vue` (872), `people/[category]/[id].vue` (847), `timeline.vue` (755), `index.vue` (694). They are hard to test, slow to mount, and likely have copy-pasted logic that belongs in composables. Refactor into smaller components.

### 22. `useApiEnvironment.ts` is a no-op
Returns `currentEnv` as a fixed `'production'` and `setEnvironment` does nothing. Either delete it or wire staging back up — keeping a dead toggle is worse than having none.

### 23. SSE keep-alive interval and socket cleanup
`live-sync.get.ts` does `socket.setTimeout(0)` and a 30s ping but writes to `event.node.res` without checking `writableEnded`. After client disconnect there's a small window where `listener` can still try to write and throw — caught silently, so you'll never see why ghost connections leak. Add `if (event.node.res.writableEnded) return` before each `write`.

### 24. `useState` in `useLiveSync.ts` for an `EventSource`
Storing a non-serializable `EventSource` in `useState` works in CSR-only mode but breaks the moment you re-enable SSR. Use `ref`/`useNuxtApp` shared state instead.

---

## LOW / HOUSEKEEPING

### 25. `.npmrc` only contains a comment
Either configure the registry/auth you actually want, or delete the file.

### 26. `console.log`/`console.warn` peppered through API handlers
You log filter JSON and modified counts from many endpoints. In production this floods your hosting logs and may include PII (`customerContactNumber`, emails). Gate behind a debug flag.

### 27. Debug endpoints shipped to production
`server/api/debug-leads.get.ts` and `server/api/leads/debug.get.ts` are publicly callable and dump documents. Move to dev-only or remove.

### 28. `app/router.options.ts`, `app/types/*`, and constants are fine but untested
There are no unit tests in the repo (no `tests/`, no Vitest config, the only `test_*.js` files at root are ad-hoc scripts). Add at least a smoke test for the auth middleware once it's hardened.

### 29. ESLint disable-next-line peppering in middleware
Three `// eslint-disable-next-line no-self-assign` in one function is a sign the abstraction is wrong (see #10).

### 30. `nuxt.config.ts` `vite.server.watch.usePolling: true` with 1s interval
That's a CPU drain in dev and unnecessary unless you're inside Docker on macOS. Make it conditional on an env var.

---

## Suggested fix order

1. Rotate the Mongo password leaked in `.env` and remove the file from any backups.
2. Add a `server/middleware/auth.ts` that validates a real session token against a `sessions` collection; reject every protected route without it.
3. Strip `password`, `passwordHash`, and other internals from anything returned by `/api/users` and `/api/users/login`.
4. Stop writing `password` (cleartext) in `users/add.post.ts` and `users/update.put.ts`; remove the cleartext fallback in `users/login.post.ts`.
5. Escape all `$regex` user input in list/search endpoints.
6. Pin `mongodb` to a real version (`^6.x`) and align `@types/node` with Node 22.
7. Rename `verce.json` → `vercel.json`.
8. Delete or relocate the root-level test scripts and `cars_output.json`.

Once those are done, tackle the High/Medium list.
