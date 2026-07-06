
## Goal
Tumia glass components (`GlassCard`, `GlassPanel`, `GlassButton`, `GlassScrollContainer`, `GlassItemButton`, `GlassOverlay`) katika UI nzima ya dashboard ili kila page ionekane premium na consistent na Welcome page. Structure haitabadilika — ni presentation tu.

## Changes per file

### 1. `src/pages/Dashboard.tsx`
- Badilisha kila `Card` / `<div class="...bg...">` (isipokuwa hero card) kuwa `GlassCard`.
- Modules grid, stat tiles, quick actions → `GlassCard variant="interactive"` au `GlassItemButton`.
- Buttons kubwa (View Reports, Manage Members, n.k.) → `GlassButton`.
- Hero card ibaki na `hero-bg` bila kuguswa.

### 2. `src/pages/Members.tsx`
- Membership details view (baada ya kuchagua branch) — sasa haitumii glass. Badilisha kontena kuu na sub-cards za member details kuwa `GlassPanel` / `GlassCard`.
- Search input container, filter chips → `GlassCard variant="subtle"`.
- Member row cards → `GlassCard variant="interactive"` au `GlassItemButton`.
- Action buttons → `GlassButton`.

### 3. `src/pages/Reports.tsx`
- Wrapper kuu → `GlassPanel`.
- KPI / stat cards → `GlassCard`.
- Chart wrappers (Recharts) → weka ndani ya `GlassCard`; rangi za chart bars/lines badilishe kuwa `rgba(255,255,255,0.7)` / accents nyeupe ili zisipoteze look ya glass. Axis/tick text nyeupe.
- Filter bar & export → `GlassButton`.

### 4. `src/pages/Leadership.tsx`
- Section wrappers → `GlassPanel`.
- Leader cards → `GlassCard variant="interactive"`.
- Add / Edit dialog inner sections → `GlassCard`.
- Buttons → `GlassButton`.

### 5. `src/pages/Hierarchy.tsx`
- Panel iliyopo tayari inatumia glass — extend kwa top-level tree wrapper → `GlassPanel`.
- Node cards → `GlassItemButton`.

### 6. `src/pages/AuditLogs.tsx`
- Table wrapper → `GlassPanel`.
- Filter bar → `GlassCard variant="subtle"`.
- Table rows: badilisha `bg` classes ziwe transparent; header row itumie `bg-white/10`.
- Pagination buttons → `GlassButton`.

### 7. `src/pages/Auth.tsx` (Sign in / Sign up)
- Card kuu ya form → `GlassPanel`.
- Inputs zibaki lakini wrapper glass; submit → `GlassButton`.

## Technical notes
- Import path: `@/components/glass`.
- `GlassCard` defaults ni compatible na existing padding — ondoa `Card`/`CardHeader` boilerplate ambapo inawezekana; sehemu ngumu tuwrap tu kwa `GlassCard` bila kuvunja layout.
- Recharts: pitisha `stroke="rgba(255,255,255,0.8)"`, `fill` gradient ya white translucent; `CartesianGrid` `stroke="rgba(255,255,255,0.15)"`; tooltip `contentStyle` glassy.
- Hakuna business logic itakayoguswa — data fetching, state, na routes zote zinabaki kama zilivyo.
- Hero card ya Dashboard (`.hero-bg`) haitabadilishwa.

## Verification
- Run `tsgo` (auto) na tembelea kila route kwa Playwright screenshot ili kuthibitisha look ni glass consistent.
