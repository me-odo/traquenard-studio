---
name: regression-verification
description: Run and interpret the complete Traquenard Studio verification suite after meaningful code, schema, runtime, or UI changes.
---

# Regression Verification

Run `pnpm run doctor` for environment context, then `pnpm verify`. If Chromium is not installed, install it with `pnpm exec playwright install chromium` rather than silently skipping E2E. Regenerate axiom docs first when the registry changed.

Diagnose a failure at its owning layer; do not retry nondeterministic tests without finding the cause, lower coverage, weaken types, bypass validation, or delete assertions. Report each command actually run and its result, including environment-based skips. Check `git diff --check` and inspect the final diff for leaked secrets, generated drift, and forbidden dependency directions.

Only after the complete local verification passes should commits be pushed, normally in one final batch. GitHub CI independently confirms the push; it is not the primary test or debugging environment.

When provisioning a missing prerequisite, limit changes to tools required by this repository. Do not remove, upgrade, clean up, or reconfigure unrelated developer tooling without strict necessity and explicit authorization. Avoid package-manager auto-cleanup and never edit shell profiles as part of project verification.
