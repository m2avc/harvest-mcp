## Summary

<!-- What changed and why. Keep Marketplace-facing PRs draft until CoS smoke + Mike GO. -->

## Security checklist (world-shared Marketplace plugin)

- [ ] No `HARVEST_ACCESS_TOKEN` / Harvest account secrets in committed `mcp.json` or examples (placeholders only; host env only)
- [ ] `DANGEROUS_SEND` default unset/off; email / `event_type=send` / payment thank-you are Mike-GO only
- [ ] Default User-Agent is `m2avc-harvest-mcp/<semver> (mn@m2avc.com)` from root `package.json`; `HARVEST_USER_AGENT` override is documented; never derived from the end-user Harvest email/company
- [ ] Honor Harvest `429` `Retry-After` in `harvest-client` ([Overview](https://help.getharvest.com/api-v2/introduction/overview/general/))
- [ ] Docs state PAT vs OAuth least privilege; never log tokens or Account IDs
- [ ] CoS live smoke on a **throwaway draft** / **M2 internal client** before merge of release-affecting tools (see `servers/harvest-rest/COS-RUNBOOK.md`)
- [ ] **Mike human GO** required before Marketplace publish or a public version tag

## Tests

- [ ] CI unit tests pass (`servers/harvest-rest`: headers, `DANGEROUS_SEND` block, payment notes verbatim, no secrets in fixtures)

## Notes for reviewers

<!-- Link `docs/API_V2_GAP_MATRIX.md` if this touches API coverage. Do not paste tokens. -->
