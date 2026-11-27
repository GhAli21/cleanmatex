# S2 seed script (zone catalog and CLDR country defaults)

`gen_seed.py` produced the values in `supabase/migrations/0842_cmx_dt_clock_api.sql` (zone catalog seed) and `0843_cmx_dt_settings.sql` (country clock defaults) on 2026-11-27. It is kept so the `0851` refresh (S13) can reproduce and diff them.

Inputs (official files, downloaded on the agent's machine; paths at the top of the script):
- IANA tzdb **2026f**: `zone.tab`, `zone1970.tab`, `backward`, `version` (https://www.iana.org/time-zones).
- Unicode CLDR **49**: `common/main/en.xml`, `common/main/ar.xml` (exemplar cities, metazone names), `common/supplemental/metaZones.xml`, `common/supplemental/supplementalData.xml` (`timeData`, `weekData`) (https://cldr.unicode.org).
- Offsets: Python `zoneinfo` on system tzdata 2026f (same release), sampled daily over 2026; `isdst` decides standard vs daylight.

Rules: canonical = `zone.tab` ∪ `zone1970.tab` ∪ `UTC` (D32); aliases = `backward` links whose name is not canonical and has the `Area/Location` shape, plus the 17 UTC-family names → `UTC`. Hour cycle: `h`, `hb`, `hB`, `K` → `H12`; `H`, `Hb`, `HB`, `k` → `H23` (D29). Week start: CLDR `firstDay` → 0 = Sunday … 6 = Saturday. A territory without its own entry inherits `001`.

Output summary: `summary.json` (counts and spot rows). Never hand-edit a seeded value; re-run the script and write a new migration.
