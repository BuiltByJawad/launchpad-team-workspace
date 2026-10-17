# Security notes — LaunchPad

Reviewed: 2026-10-12.

## Runtime dependencies

`npm audit --omit=dev` reports zero advisories for the frontend production dependency set. Framework/build tools are in `devDependencies`; the final Cloudflare Worker is generated from the build output. `fflate` is pinned to 0.7.5, which clears its ZIP64 denial-of-service advisory in the dependency tree.

## Remaining development-tool advisory

A full `npm audit` still reports seven high findings, all propagated from `braces@3.0.3` through `vinext -> vite-plugin-commonjs -> vite-plugin-dynamic-import -> fast-glob -> micromatch -> braces`. As of this review, npm has no patched braces release; the advisory covers versions through 3.0.3. The upstream issue confirms no fixed release is available: https://github.com/micromatch/braces/issues/84.

`npm audit fix --dry-run` offers a rollback to `vinext@0.2.1` as its only suggested change. I did not apply that framework downgrade without a compatibility review. Recheck the advisory and upstream release before shipping build pipelines. The vulnerable dependency is in development tooling, not the audited production dependency tree, but should still be treated as a build-environment risk.

## API security status

The API requires an HS256 token with issuer, audience, expiration, and subject checks, followed by a workspace membership lookup and role check. Local runtime checks confirmed unauthenticated calls are rejected (401), viewers cannot write (403), unknown workspace IDs do not return task data (404), and task/comment/activity changes persist. Project duplicate keys return 409. D1-backed per-user/workspace limits return 429 after 30 writes/minute or 120 reads/minute. The UI does not yet issue or hold a production session, workspace creation/invitation flows are missing, and the D1 binding is still a local placeholder. Do not deploy the API publicly until those items are complete.
