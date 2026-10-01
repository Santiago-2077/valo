# Design

The visual system for Valo lives in **[design-system/valo/MASTER.md](design-system/valo/MASTER.md)**: tokens (OKLCH, light + dark), typography (Geist + Geist Mono), base components, interaction and accessibility rules, chart guidance and anti-patterns. Strategy and voice are in [PRODUCT.md](PRODUCT.md).

Quick reference:
- Theme: "fintech baby blue" (Twitter #1DA1F2 family), flat and calm, light + dark (follows system, override in Settings).
- Tokens only (`bg-surface`, `text-muted`, `bg-primary`…), defined in `web/src/index.css`.
- One filled primary action per view; selection = primary border + soft fill.
- Money in `.num` (tabular mono); status always icon/text + color, never color alone.
