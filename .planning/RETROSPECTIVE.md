# Retrospective: v9.0.0 — Templates & Aliases

**Date:** 2026-05-24
**Branch:** templates-and-aliases
**Duration:** Single day

---

## What Went Well

- **Wave execution worked cleanly** — 4 sequential waves kept each subagent focused; no cross-wave conflicts
- **Build gates caught real issues** — unused Rust imports (`delete`, `put`, `Router` in templates.rs; `serde_json::Value` in server.rs) were caught before the CI gate would have failed
- **Phase 1 recovery** — Phase 1 work existed in git but STATE.md showed it as not-started; recognizing the true state from git log and updating STATE.md before planning Phase 2 saved a full re-execution
- **`embedded` prop pattern** — clean solution for page components that need to render both as standalone full-page routes and as tab panels inside an existing layout

## What Could Be Better

- **IA mismatch caught post-implementation** — Templates/Component Templates/Aliases were initially wired as separate sidebar nav items and routes. The PRD intent (tabs in Indices view) wasn't surfaced during planning. A quick PRD re-read before Phase 1 would have caught this. The fix was straightforward but added an unplanned refactor pass.
- **STATE.md diverged from git state** — Phase 1 commits existed but STATE.md still showed Phase 1 as not-started. STATE.md should be updated atomically with each commit, not as a separate step that can be skipped.
- **NumberInput spinner overflow** — a small Mantine 8 gotcha (`hideControls` not set by default on NumberInputs in modals) required a polish fix pass. Worth checking modal boundaries for all numeric inputs during implementation.

## Key Decisions Made Under Uncertainty

- **SIM-04 display-only reorder**: dnd-kit Composed tab reorders component templates visually but doesn't save the order via PUT. Accepted as MVP scope — the drag interaction demonstrates the capability without requiring a full save flow.
- **diff package selection**: Used `diff` (v9.0.0) + `react-diff-view` for the simulate output. `createTwoFilesPatch` → `parseDiff` → `<Diff>/<Hunk>` pipeline works well for this use case.

## Tech Debt Accepted

| ID | Description | Priority |
|----|-------------|----------|
| BACK-02 | Task Master task 2 status not updated programmatically | Low |
| ADV-01 | Inline JSON editing in TemplateDetailsModal | Medium |
| TEST-01 | Integration tests for alias/template Rust route handlers | Medium |
| TEST-02 | Frontend component tests for Templates, Aliases, ComponentTemplates | Medium |
| SIM-04-v2 | Save dnd-kit reorder order via PUT _index_template/:name | Low |

## Next Milestone Candidates

- Inline editing for TemplateDetailsModal (ADV-01)
- Integration test coverage for new route handlers (TEST-01/02)
- ILM policy management (separate feature, high operator value)
- Index lifecycle visualization

---

*Written: 2026-05-24*
