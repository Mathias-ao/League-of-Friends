# Fixed-alignment social evidence — E2E integration gate

**Status: read-only, inactive candidate-only PR.** This does not change the active Chronicle, Reputation, Relationship, Firebase, scoring, game/result processing, War Room, or staging browser. It exists to test the replay-evidence side before active read-path integration.

## Source chain for the E2E rehearsal

`Recordings -> canonical / Recorded Events -> existing statistics -> pairSocialEvidence + episodeContext -> read-only family preview -> candidate-only output`.

- Reuse the existing *raid and engagement* detectors. Do not introduce new attack semantics, an independent parser, or automatic personal Hostility.
- The new `social_three_families_preview.py` is a deliberately small **source-admission check** over the already shipped Pair Social Evidence V1. It is separate from the richer unmerged three-family design draft and does not qualify substantive deeds, league identity, results, credit or historical order.
- Run `python -m unittest discover -s replay-tools/tests -p test_social_three_families_preview.py -v` as an early CI smoke. The final test reuses `test_pair_social_evidence.ledger(raid_actions())` and therefore exercises existing Raid V3, Skirmish and Engagement V4 fixture processing end-to-end.
- The complete local family, Chronicle and directional-ledger prototype also ships in the proposal, but it is **not** wired into production readers.

## Required authentic E2E cases before authoritative integration

1. 1v1 official fixed-opponents: source-sha/roster/chronology verified, raid and local contest collapse to *one deed*; only directionally supported preview candidates. Ordinary combat does not become Hostility.
2. Locked-team game: assistance produces helper-to-recipient candidate, not reverse Bond. Shared-target participation is *not* Bond. One defensive clash may have pressure and support annotations but not multiple manufactured deeds.
3. Locked-diplomacy FFA: pair-specific targeting/pressure only, no all-to-all Rivalry or shared-team Bond.
4. Incomplete/corrupted source event ordering, changed source revision, ambiguous identity, or pending official result: fail closed for authoritative publication.
5. Corrected Game or disputed Battle: old revision is excluded from current history; any existing submitted player judgment has separate correction and privacy rules.
6. Chronicle outcome: ordinary Battle is one line, including correct team/FFA wording; no extra narrative from mere detected commands. A source-linked qualified *credited* social movement can add at most one curated highlighted sentence, once authenticated and authorized.

## Main consolidation and E2E coordination — 15 October 2026

This review branch now includes the consolidated `main` snapshot `8e8fb386a7fcb3ad9909fa68796bf72b0b6d8e52` through a non-conflicting merge, retaining this proposal as **add-only, inert modules and tests**. The former staging recording E2E was explicitly stopped as incomplete: see `docs/testing/staging-manual-e2e-closeout-2026-10-15.md`. No successful live upload-to-READY or deployed social-system interaction may be inferred. A future coordinated E2E must independently verify the authenticated active-source/read path and candidate family results. **Merging these inactive files is neither deployment nor feature activation.**

## Release blockers

- Independent source-event clock and active-source attestation in the authenticated server path.
- Durable incident identity across result corrections and historical Event order completeness.
- Verified eligible league identities, Event Battle eligibility, and participant AI/guest handling.
- Real recorded corpus validation across all required modes and source representations.
- Explicit substantive qualifications, separate versioned Reputation and Relationship rules, and historical credit receipts.
- Chronicle editorial rule execution only from authenticated credited changes and qualified acknowledged testimony.
- No automatic Forward Castle qualification without unique completed-instance queue provenance and the five-minute operational deadline.

**No production readiness is claimed by this document or CI success alone.**