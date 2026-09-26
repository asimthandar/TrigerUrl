# BERLIN X PANEL — Design System

This layer follows the uploaded UI/UX Pro Max skill's design-system principles while keeping the existing dashboard runtime intact.

## Token architecture
Primitive → Semantic → Component.

- `assets/design-tokens.json` is the source-of-truth token map.
- `assets/design-tokens.css` exposes reusable CSS variables.
- Existing `css/styles.css` remains the preserved dashboard stylesheet.

## UX quality bar
- 44px minimum interactive target.
- Visible keyboard focus.
- Labels remain visible on forms; errors should be near the field.
- Mobile-first layouts at 375/768/1024/1440px.
- Do not rely on color alone for status.
- Respect `prefers-reduced-motion`.
- Use consistent iconography rather than emoji as UI icons.
- Keep typography readable; 16px is the body baseline.
- Avoid horizontal overflow on mobile.

## Architecture
The original panel's JavaScript execution order is preserved. New admin/user functionality is isolated behind `server.py`, `admin.html`, and `submit.html`.

## Data boundary
Firebase configuration submitted by a user is treated as metadata. It is not permission to access private Firebase data.
