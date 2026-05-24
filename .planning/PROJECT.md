# secan — Project

## What This Is

secan is a self-hosted Elasticsearch/OpenSearch cluster management UI built with Rust (Axum) backend and React (Mantine 8, Tanstack Query 5, Monaco Editor, react-router-dom 7) frontend. Single-binary deployment via rust-embed.

## Current State

**Shipped: v9.0.0 — Templates & Aliases** (2026-05-24)

Full CRUD support for index templates, component templates, and index aliases is live on the `templates-and-aliases` branch, ready for PR to main. All management surfaces are tabs within the Indices view (not scattered nav items), matching the PRD's intended IA.

**What's working:**
- Index Templates: list, create, delete, detail modal (Monaco tabs + simulate diff + dnd-kit compose)
- Component Templates: list, create, delete
- Aliases: list, create, delete
- Templates/Component Templates/Aliases accessible as tabs in Indices view (`?indicesTab=`)
- Template detail modal URL-shareable via `?templateModal=<name>`
- Both `cargo build` and `npm run build` pass cleanly

## Core Value

Operators can manage index templates, component templates, and aliases through a consistent secan UI — eliminating the need to drop into curl or Kibana for routine ES cluster configuration.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tabs in Indices view (not separate nav items) | PRD intent — index management under Indices, not scattered nav | ✓ Implemented via `?indicesTab=` query param |
| dnd-kit for component selector | Best-in-class React DnD, already referenced in PRD | ✓ Sortable display-only reorder |
| react-diff-view for simulate diff | Lightweight unified diff renderer with CSS theming | ✓ Before/after JSON diff |
| Query-param routing for modals | Matches existing codebase patterns; URL-shareable | ✓ `?templateModal=<name>` |
| TemplateDetailsModal read-only first | Simpler MVP; inline editing deferred to v2 | ✓ Read-only Monaco tabs |
| `embedded` prop on page components | Skip FullWidthContainer when rendering as tabs inside ClusterView | ✓ No layout double-wrapping |
| Back-compat redirects for old routes | Preserve any bookmarked `/templates`, `/aliases`, `/component-templates` URLs | ✓ Navigate redirects |

## Tech Debt

- BACK-02: Task Master task 2 status not updated programmatically (minor)
- dnd-kit Composed tab is display-only reorder — no PUT to save order (deferred to v2)
- Inline JSON editing in TemplateDetailsModal not yet available (deferred to v2)
- No integration tests for alias/template route handlers (TEST-01, TEST-02 in v2 requirements)

## Constraints

- **Tech stack**: Mantine 8 only — no new UI libraries beyond approved additions
- **Pattern conformance**: New pages follow established page/modal/form patterns
- **Build gates**: `cargo build` and `npm run build` must pass clean before any commit

## Context

- **Stack**: Rust (Axum, tokio) + React 19 (Mantine 8, Tanstack Query 5, Monaco, dnd-kit, react-diff-view)
- **Branch**: `templates-and-aliases` — 11 TMPL-001 commits ahead of main
- **Deployed**: Ready for PR to main; production deployment follows standard release process
- **npm deps added this milestone**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `react-diff-view`, `diff`

---

*Last updated: 2026-05-24 — v9.0.0 shipped*
