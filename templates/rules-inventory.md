# Rules Inventory

Status: Agent Trail local education kit placeholder.

Use this template to separate persistent rules from scoped rules, unsafe
examples and stale notes. Keep examples synthetic.

## Always-on Rules

| Rule | Source / owner | Why always-on | How to verify |
| --- | --- | --- | --- |
|  |  |  |  |

## Scoped Rules

| Scope | Rule | Source / owner | When loaded |
| --- | --- | --- | --- |
|  |  |  |  |

## Rules To Delete

| Rule or note | Why it should leave durable instructions | Replacement |
| --- | --- | --- |
|  |  |  |

## Unsafe Examples That Must Not Become Context

| Unsafe example type | Safe replacement |
| --- | --- |
| Secrets / tokens | Synthetic token-shaped sample |
| Raw logs with PII | Sanitized or synthetic log excerpt |
| Customer data | Domain-safe mock data |

## Source / Owner

- Owner:
- Source of truth:
- Review cadence:

## Update Trigger

- Project command changed.
- Source of truth changed.
- A scoped rule was used globally by mistake.
- A real incident revealed an unsafe example or stale rule.
