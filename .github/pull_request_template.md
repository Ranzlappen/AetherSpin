## Summary

Briefly describe what this PR changes and why.

## Area

- [ ] Math engine (simulator / books / RTP)
- [ ] Frontend (web client)
- [ ] Shared definitions / schema
- [ ] CI / scripts / tooling

## Changes

-
-

## Validation

- [ ] `python -m pytest math/tests -q` passes
- [ ] `python math/scripts/validate_rtp.py --game <game> --sims 150000 --tol 0.05` passes
- [ ] `pnpm --filter @aetherspin/frontend run check` passes
- [ ] `pnpm --filter @aetherspin/frontend test` passes
- [ ] `pnpm --filter @aetherspin/frontend build` succeeds
- [ ] Prettier + ESLint clean

## Notes for reviewers

Anything reviewers should pay special attention to (RTP impact, breaking changes, follow-ups).
