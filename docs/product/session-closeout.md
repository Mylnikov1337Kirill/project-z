# Agent Trail AI session closeout

Этот чеклист обязателен в конце каждой AI-assisted сессии по Agent Trail. Его задача -- не плодить документы, а держать рабочий контекст свежим для следующего агента.

## Rule

Before the final response, inspect what changed and update the relevant docs in the same session. If no docs need updates, say that explicitly in the final response.

## Update matrix

| If this changed | Update this |
| --- | --- |
| Phase status, completed work, known-good checks, next step or handoff prompt | `/Users/kirillmylnikov/Dev/ai/project-z-development-handoff.md` |
| Commands, stack, important paths, constraints, known pitfalls or missing context | `docs/product/repo-context-inventory.md` |
| Required checks, browser QA, reviewer focus, recurring risks or stop conditions | `docs/product/verification-and-self-review.md` |
| How future agents should behave across the repo | `AGENTS.md` |
| User-visible setup, project status or high-level structure | `README.md` |
| Architecture decision or integration boundary | `docs/adr/*` or a new ADR |

## Required closeout steps

1. Review the diff or changed file list.
2. Decide which rows in the update matrix apply.
3. Update the matching docs before final response.
4. Run a lightweight link/context check:

```bash
rg -n "docs/product|session-closeout|verification-and-self-review|repo-context-inventory|project-z-development-handoff" README.md AGENTS.md docs/product/*.md /Users/kirillmylnikov/Dev/ai/project-z-development-handoff.md
```

5. If source code changed, run the relevant checks from `docs/product/verification-and-self-review.md`.
6. In the final response, include:
   - what changed;
   - what was verified;
   - which docs were updated, or why docs did not need updates.

## Keep docs useful

- Update docs only when repo truth changed.
- Prefer short, concrete changes over broad rewrites.
- Do not paste long session transcripts.
- Do not duplicate the same status in many files unless the file is an entrypoint for future work.
- Keep gameplay implementation details out of player-facing UI; docs and handoffs are the right place for them.

## Examples

- Phase 4 implements badge screen and unlocks Chapter 2: update `/Users/kirillmylnikov/Dev/ai/project-z-development-handoff.md`, `repo-context-inventory.md` if routes/paths changed, and `verification-and-self-review.md` if browser QA changed.
- A new test runner is added: update `README.md`, `repo-context-inventory.md`, `verification-and-self-review.md` and any relevant ADR.
- A docs-only cleanup changes no repo behavior: update only the touched docs and mention that app checks were not run because source code did not change.
