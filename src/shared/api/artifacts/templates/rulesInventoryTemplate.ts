export function createRulesInventoryMarkdown() {
  return `# Rules Inventory

Статус: черновик

Используйте этот файл как рабочую инвентаризацию инструкций для агента. Цель -- решить, какие знания должны жить как короткие rules, какие нужно ограничить областью, а какие нельзя класть в постоянный контекст.

## Always-on rules

| Rule | Why it matters | Source / owner | Update trigger |
| --- | --- | --- | --- |
| TODO: короткое правило безопасности или качества. | TODO: какой риск снижает. | TODO: документ, владелец или команда. | TODO: когда пересмотреть. |

## Scoped rules

| Scope | Rule | When loaded | Source / owner |
| --- | --- | --- | --- |
| TODO: frontend / backend / docs / QA. | TODO: правило только для этой области. | TODO: какие задачи требуют правило. | TODO |

## Rules to delete

| Candidate | Why remove | Replacement |
| --- | --- | --- |
| TODO: устаревшее, слишком широкое или непроверяемое правило. | TODO: что ломает или засоряет. | TODO: удалить, переписать, сузить или перенести в brief. |

## Unsafe examples that must not become context

- TODO: secrets, tokens, raw logs, PII, production dumps or sensitive customer data.
- TODO: sanitized replacement example, if one is safe and useful.

## Source / owner

- Primary owner: TODO
- Review rhythm: TODO
- Source of truth: TODO

## Update trigger

- [ ] Project architecture changed.
- [ ] Safety boundary changed.
- [ ] A rule caused a wrong or risky agent action.
- [ ] A repeated workflow should become a skill instead of another rule.
- [ ] A one-off task note was accidentally promoted into durable context.

## Next cleanup

\`\`\`text
TODO: the smallest safe cleanup action for this instruction set.
\`\`\`
`
}
