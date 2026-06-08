# IBUKI Deck Brand Assets

Place brand files here. They are loaded at runtime by `src/infra/deck/deck.assets.ts`.

## Required / optional files

| File | Description | Used for |
|------|-------------|----------|
| `ibuki-logo.png` | IBUKI circular gold logo (transparent bg preferred) | Cover page + offer page corner |
| `product-plate.jpg` | Sizzling wagyu plate photo | Future: photo page |
| `product-raw.jpg` | Raw A5 wagyu block (marbling detail) | Future: cut-fit page |
| `product-grill.jpg` | Yakiniku grill shot | Future: offer page |

## Notes
- Logo should be ~300×300 px minimum, PNG with transparent background
- All files committed here are bundled with the Railway deploy
- Fallback: if `ibuki-logo.png` is absent, the renderer draws a vector text logo
