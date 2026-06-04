export function createSkillDraftMarkdown() {
  return `# Skill Draft

Статус: черновик

Используйте этот файл для повторяемой процедуры, которую другой разработчик сможет запустить без личной магии автора. Это tool-agnostic черновик: он описывает поведение, входы, проверки и условия остановки.

## Skill name

\`\`\`text
TODO: короткое имя одной повторяемой процедуры.
\`\`\`

## When to use

\`\`\`markdown
- TODO: задача повторяется.
- TODO: есть понятные входы и критерии приёмки.
- TODO: результат можно проверить.
\`\`\`

## When not to use

\`\`\`markdown
- TODO: задача разовая.
- TODO: нужны secrets, PII, raw logs or production dumps.
- TODO: нет проверки результата.
- TODO: процедура конфликтует с текущими rules.
\`\`\`

## Required inputs

\`\`\`markdown
- [ ] Task brief with goal and boundaries.
- [ ] Relevant files or examples.
- [ ] Acceptance criteria.
- [ ] Verification command or manual QA route.
- [ ] Sensitive data removed or sanitized.
\`\`\`

## Steps

\`\`\`markdown
1. Read the brief and active rules.
2. Confirm scope and stop conditions.
3. Inspect only the relevant sources.
4. Make the smallest useful change or draft.
5. Run verification or record why it is unavailable.
6. Summarize result, risks and follow-up.
\`\`\`

## Forbidden moves

\`\`\`markdown
- Do not widen scope without a new brief.
- Do not copy secrets, raw logs or personal data into context.
- Do not turn a lucky one-off prompt into a durable skill.
- Do not skip verification silently.
\`\`\`

## Verification

\`\`\`text
Automated:
TODO

Manual:
TODO

Evidence to keep:
TODO
\`\`\`

## Stop conditions

\`\`\`markdown
- The required input is missing.
- Active rules conflict and precedence is unclear.
- Verification fails for reasons outside the task scope.
- The procedure needs sensitive data that cannot be safely sanitized.
\`\`\`

## Known bad cases

| Case | Symptom | Response |
| --- | --- | --- |
| TODO | TODO | TODO |

## Update trigger

- [ ] The procedure failed on a real task.
- [ ] A verification command changed.
- [ ] A rule or safety boundary changed.
- [ ] The workflow became broad enough to compose into a playbook.

## Pilot notes

\`\`\`markdown
- Tried on:
- Result:
- What changed:
- Next review:
\`\`\`
`
}
