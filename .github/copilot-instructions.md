# Style & Architecture Rules

- **Frameworks:** Next.js 15 (App Router), Tailwind CSS v4, HeroUI v3.
- **Theming:**
  - Brand Color is `accent`. Danger is `danger`.
  - NEVER create `--app-` or `--ill-` variables.
  - Use Tailwind v4 color scales: `text-accent/50`, `bg-danger/10`, `fill-default-200`.
- **Illustrations:**
  - NEVER use `fill="var(--ill-...)"` or any `--ill-*` / `--app-*` custom property.
  - Use `fill="currentColor"` for the primary action shape so it inherits the parent `text-*` class.
  - For multi-tone SVGs apply semantic Tailwind fill utilities directly on `<path>`/`<circle>` elements:
    - Background card tint: `className="fill-accent/10"` (or `fill-danger/10` for error illustrations)
    - Main brand outline: `className="fill-accent"` (or `fill-danger`)
    - Mid-tone surfaces (document body, inner card): `className="fill-default-200"`
    - Decorative dots / lighter mid: `className="fill-default-300"`
    - Muted detail lines / text stubs: `className="fill-default-400"`
    - Light accent stripes: `className="fill-accent/20"`
    - Icon-on-badge inner (checkmark/X background): `className="fill-background"`
  - Pass a status-aware `text-*` class to the component to drive `currentColor` for badge shapes:
    - Success → `text-success`, Error → `text-danger`, In-progress → `text-accent`
  - **SVG authoring rules:**
    - Always use `viewBox` — never set `width`/`height` attributes directly on `<svg>`.
    - Export as a named `function` declaration, not an arrow-function or `SvgComponent` alias.
    - Map raw hex colors to design tokens before committing:
      | Hex | Token |
      |-----|-------|
      | `#6c63ff` | `currentColor` |
      | `#fff` | `var(--surface)` |
      | `#f2f2f2` | `var(--background)` |
      | `#d6d6e3` | `var(--default)` |
      | `#3f3d56` | `var(--default-foreground)` |
      | `#090814` | `var(--default-foreground)` |
- **Logic:**
  - Favor HeroUI semantic props over raw CSS.
  - Differentiation: `accent` for primary growth actions, `danger` (darker red) for destructive actions.
