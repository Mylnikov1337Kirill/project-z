# Module 08: Rules & Skills

Status: Project Z local education kit placeholder.

Use this module as the source stub for visible Chapter 5, `Rules & Skills`.
The chapter is tool-agnostic and teaches agent management through durable
instructions and reusable procedures, not through a specific vendor file format.

## Learning Objective

After the chapter, the learner can:

- distinguish `rule`, `scoped rule`, `skill`, `playbook`, `task brief` and one-off prompt;
- choose the right carrier for project knowledge;
- keep rules short, current, scoped, safe and maintainable;
- describe a skill as a repeatable procedure with inputs, steps, verification and stop conditions;
- detect stale, conflicting and unsafe instructions;
- connect rules and skills to context hygiene and final playbooks.

## Core Rule

Not every piece of knowledge should become a rule. Not every successful prompt
is a skill. Not every skill belongs in every task context.

## Carrier Model

| Carrier | Use when | Do not use when |
| --- | --- | --- |
| Always-on rule | A short safety or architecture boundary is needed almost every time. | The rule is local to one area, stale, broad or task-only. |
| Scoped rule | A convention applies to a specific area, task type or workflow. | The rule would be loaded into unrelated work. |
| Skill | A repeatable procedure has clear inputs, steps, verification and stop conditions. | It is only a lucky phrase, one-off task or broad workflow. |
| Playbook | A team workflow composes brief, rules, skills and verification. | The chapter only needs the anatomy of one reusable procedure. |
| Task brief | The knowledge belongs to one current task and acceptance contract. | It is being promoted to durable memory without repeatable value. |
| Discard | The note is unsafe, stale, personal magic or unverified noise. | It has a clear owner, scope and repeated value. |

## Rule Hygiene

Good rules are short, current, safe, scoped and connected to a source or owner.
Bad rules are slogans, stale commands, real logs, raw personal data, one-off
debug notes or broad demands to "always do better".

## Skill Anatomy

A reusable skill should include:

1. When to use.
2. When not to use.
3. Required inputs.
4. Workflow steps.
5. Forbidden moves.
6. Verification.
7. Stop conditions.
8. Known bad cases and update trigger.

## Maintenance Decisions

When instruction drift appears, choose one of five actions:

- keep the current safety boundary;
- update or remove stale instructions;
- narrow a global rule into a scoped rule;
- extract a repeated workflow into a skill draft;
- keep task-only context in the current brief.
