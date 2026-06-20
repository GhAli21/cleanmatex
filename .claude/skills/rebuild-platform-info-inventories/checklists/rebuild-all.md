# Checklist — rebuild-all (quarterly / major release)

- [ ] `npm run rebuild:platform-info-inventories`
- [ ] Review full `GENERATED_GATE_MATRIX.md`
- [ ] Triage `DRIFT_REPORT.md` — repair high-signal items; shrink `KNOWN_EXCEPTIONS.json`
- [ ] Run `npm run check:platform-info-inventories`
- [ ] Optional: `PLATFORM_INVENTORIES_STRICT=1 npm run check:platform-info-inventories` before release branch cut
- [ ] Document any remaining allowlisted items with reason + target fix phase
