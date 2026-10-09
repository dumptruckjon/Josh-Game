# Phase 5 running todo
- [x] per-place layout fingerprint (engine + 2 node tests, mutation-checked A/B/C red)
- [ ] floor marks seeded by place id (renderer done) -> needs a browser test: same ground, two places, different floor marks
- [ ] look-tables both-ways law (block/bridge/track/flow/portal looks; dead: bridge `stone`, track `wire`)
- [ ] multi-key latent defect (R.keys keeps only the last key)
- [ ] door ring may show a stale run after a site update changed that place (until opened) — decide
- [x] door label contrast law (darkHex one owner in hole-render; node law; mutation red)
- [x] save coalesced to once per frame (saveRun) + browser test (mutations A/B red)
- [ ] door ring stale after a re-layout -> data print `d`? decide
- [ ] look-tables both-ways law: derive drawable block/bridge looks from exported tables, flow/track/portal looks from the draw branches; every declared look drawable, every drawable look used (dead today: bridge stone, track wire)
