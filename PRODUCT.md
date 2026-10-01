# Product

## Register

product

## Users

One person: a young adult in Mexico learning to manage their own money. Pays with several credit cards (with different closing and due dates), debit and cash; has subscriptions, utilities, installment purchases (MSI) and a salary paid every fortnight plus occasional freelance income.

Two usage moments:
- **Right after spending**, on the phone, often standing or on the go: log the expense in seconds.
- **Reviewing**, on a laptop on a weekend or at night on the phone in bed: "how am I doing this month, what do I owe and when, did my statement match".

The job: stop being surprised at month end. Know what falls in each card statement, what's left after income, and where impulse spending is leaking.

## Product Purpose

Valo is a self-hosted personal finance tracker running on the user's homelab. It mirrors how credit cards really bill (cycles, due dates, installments), records fixed charges and income automatically, and reconciles against the bank statement so totals always match.

Success: at any moment the user can answer "how much do I have to pay, by when, and how much is left this month" in under five seconds, and the bank statement matches what Valo says. It is also a portfolio piece, so craft is visible.

## Brand Personality

**Clear, honest, calm.** Valo tells the truth about the numbers without scolding or alarming. It states facts plainly ("Te pasaste $150"), points to the next action, and never moralizes. Precision over decoration; quiet confidence like a well-made tool.

References: **Stripe Dashboard** (impeccable numbers, clear hierarchy, serious without being cold) and **Copilot Money / YNAB** (personal budgeting that feels approachable, progress you can read at a glance).

## Anti-references

- **Traditional bank apps** (BBVA, Santander web): heavy, bureaucratic, endless menus.
- **Crypto / trading apps**: neon on black, aggressive charts, casino energy, gamified urgency.
- **Generic SaaS templates**: identical icon cards, purple gradients, anything that reads "made by AI".
- **Spreadsheets with colors**: dense tables with no hierarchy or guidance about what to look at.

## Design Principles

1. **Answer first.** Each screen leads with the one number or status that answers its question; detail comes after.
2. **Honest, not alarming.** Bad news is stated plainly with what to do next; color supports the words, never replaces them.
3. **Seconds to log.** Capturing a movement must be faster than forgetting it: one tap, sensible defaults, remembered choices.
4. **Mirror reality.** Model money the way the bank does (cycles, due dates, installments, reconciliation) so nothing needs mental translation.
5. **Calm density.** Show enough to decide without hunting, separated by space and rules rather than boxes.

## Accessibility & Inclusion

WCAG 2.2 AA: text contrast ≥ 4.5:1 in light and dark mode, touch targets ≥ 44px, visible focus, full keyboard use (including the `N` shortcut). Status never conveyed by color alone (icon + text), safe for color-vision deficiency. Respects `prefers-reduced-motion`. Spanish (es-MX) copy and number formats.
