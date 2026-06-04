# Chip Ordering Mission Audit

## Summary

- Total chip-ordering missions: 12
- Keep: 5
- Rewrite and keep: 6
- Replace with pair-matching: 1
- Replace with scenario-decision: 0
- Replace with chip-picker: 0

## Findings

| Chapter | Mission id | Mission title | Current role | Checklist result | Recommendation | Rationale |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | self-review-assembly | Собери самопроверку перед ревью | Self-review protocol/document order | Pass: 1,2,3,5,6. Risk: 4. | Rewrite and keep | The self-review protocol is visible, but `remove-noise` and `sensitive-data` are both boundary checks and can honestly swap without more copy. |
| 2 | assemble-task-brief | Собрать бриф | Task brief document order | Pass: 1,2,3,4,5,6. | Keep | The order matches the task brief template: goal, scope, exclusions, examples, acceptance, verification. |
| 3 | small-diff-loop | Провести маленькое изменение | Plan-first session protocol | Pass: 1,2,3,4,5,6. | Keep | The sequence has real dependencies: read-only work precedes plan, human decision precedes code, checks precede summary. |
| 3 boss | gate-closeout-order | Раунд 4: закрыть сессию | Plan-first closeout protocol | Pass: 1,2,3,5,6. Risk: 4. | Rewrite and keep | Strict order is defensible, but `run-verification` and `name-checks` are easy to read as duplicate evidence steps unless action vs report is clearer. |
| 4 | context-inventory-order | Собрать inventory | Repository context inventory document order | Pass: 1,2,3,5,6. Risk: 4. | Rewrite and keep | The 8-card document order is taught, but middle layers like commands, conventions, examples and pitfalls are categories more than hard dependencies. |
| 5 | skill-draft-order | Собрать skill | Skill draft document order | Pass: 1,2,3,4,5,6. | Keep | The order matches the skill draft anatomy and each neighboring step has a clear dependency. |
| 5 boss | gate-skill-anatomy | Раунд 3: анатомия skill | Skill draft boss protocol | Pass: 1,2,3,4,5,6. | Keep | The same protocol was already practiced in the chapter and is reinforced by retry principle copy. |
| 6 | token-checklist-order | Собрать чек-лист | Token hygiene checklist order | Pass: 1,2,3,4,5,6. | Keep | The mission assembles a checklist from mode choice through task size, context, exclusions, checks and stop rule. |
| 6 boss | gate-checklist-order | Раунд 4: финальный чек-лист | Long-session closeout checklist | Pass: 1,2,3,5. Fail: 4. Risk: 6. | Replace with pair-matching | The player can identify all closeout roles, but `save-workflow` and `capture-bad-case` do not need a strict relative order. |
| 7 | reviewer-note-order | Собрать заметку ревьюеру | Reviewer note document order | Pass: 1,2,3,5,6. Risk: 4. | Rewrite and keep | The note structure is visible, but evidence, domain source, risk and review focus are writing sections whose exact middle order needs a stronger rubric. |
| 7 boss | gate-review-note | Раунд 4: заметка ревьюеру | Reviewer note boss protocol | Pass: 1,2,3,5,6. Risk: 4. | Rewrite and keep | The boss reuses a taught note shape, but the `summary -> evidence -> oracle -> risk -> focus` dependency should be made explicit. |
| 8 boss | gate-playbook-order | Раунд 3: собрать документ | Team playbook document order | Pass: 1,2,3,5,6. Risk: 4. | Rewrite and keep | The playbook shape is taught, but this is the first strict ordering version and 8 cards make adjacent blocks like acceptance, mistakes and examples debatable. |

## Per-Mission Notes

### Chapter 1 / self-review-assembly

- Teaches: pre-review self-review for AI-assisted changes.
- Source of order: chapter prep checklist, chapter recap, and `ai-pr-self-review.md` artifact shape.
- Passes: visible protocol, document-style sequence, clear prompt and mentor hint, distinct card roles, useful failure feedback.
- Fails / risks: adjacent boundary checks are debatable.
- Debatable adjacent steps: `remove-noise` before `sensitive-data`; either can be framed as the first boundary pass.
- Recommended action: Rewrite and keep.
- Suggested replacement or rewrite: frame the sequence as "responsibility -> diff boundary -> data boundary -> evidence -> handoff" and make clear that data safety is a separate boundary gate, not a generic cleanup step.

### Chapter 2 / assemble-task-brief

- Teaches: task brief structure for an agent.
- Source of order: `task-brief.md` artifact, earlier chapter missions on goal, boundaries and examples.
- Passes: all checklist items.
- Fails / risks: none material.
- Debatable adjacent steps: low risk; `acceptance` and `verification` are distinct because criteria define done and verification proves it.
- Recommended action: Keep.
- Suggested replacement or rewrite: no change needed.

### Chapter 3 / small-diff-loop

- Teaches: plan-first loop for a small AI-assisted change.
- Source of order: chapter prep, `plan-first-checklist.md`, and previous missions about plan review and human decision.
- Passes: all checklist items.
- Fails / risks: none material.
- Debatable adjacent steps: low risk; each step unlocks the next.
- Recommended action: Keep.
- Suggested replacement or rewrite: no change needed.

### Chapter 3 / gate-closeout-order

- Teaches: closing a plan-first session before review.
- Source of order: chapter protocol and closeout block in `plan-first-checklist.md`.
- Passes: taught protocol, document/action order, clear mentor hint, distinct roles, failure feedback names the principle.
- Fails / risks: neighboring evidence cards can blur.
- Debatable adjacent steps: `run-verification` and `name-checks`; one is doing checks, the other is reporting checks, but card labels are close.
- Recommended action: Rewrite and keep.
- Suggested replacement or rewrite: label the cards as "execute evidence" and "write evidence trail" or split the mission into "do before note" and "write in note" phases.

### Chapter 4 / context-inventory-order

- Teaches: repository context inventory / AGENTS.md starter structure.
- Source of order: chapter prep, context inventory mission copy, and `agents-context-starter.md`.
- Passes: visible document order, explicit "top-down" sorting rule, distinct roles, helpful failure feedback.
- Fails / risks: 8 cards create a wide middle where categories are not strict dependencies.
- Debatable adjacent steps: `commands` vs `conventions`; `examples` vs `pitfalls`; `pitfalls` vs `sensitive-data`.
- Recommended action: Rewrite and keep.
- Suggested replacement or rewrite: make the sorting rule "identity -> map -> navigation -> executable checks -> rules -> examples -> risk -> safe pilot" and align card labels with that layer model.

### Chapter 5 / skill-draft-order

- Teaches: reusable skill anatomy.
- Source of order: chapter prep, `skill-draft.md`, retry principle, and authored `orderFeedback`.
- Passes: all checklist items.
- Fails / risks: the engine currently does not display `orderFeedback`, but mission-level failure and retry copy still teach the order.
- Debatable adjacent steps: low risk; each section depends on earlier scope and inputs.
- Recommended action: Keep.
- Suggested replacement or rewrite: no content change required; a separate engine improvement could surface `orderFeedback`, but that is outside this audit.

### Chapter 5 / gate-skill-anatomy

- Teaches: same reusable skill anatomy under boss pressure.
- Source of order: prior regular mission `skill-draft-order`, chapter recap, and `skill-draft.md`.
- Passes: all checklist items.
- Fails / risks: none material.
- Debatable adjacent steps: low risk; `verification`, `stop-conditions` and `update-trigger` have different roles.
- Recommended action: Keep.
- Suggested replacement or rewrite: no change needed.

### Chapter 6 / token-checklist-order

- Teaches: context hygiene checklist before an agent task.
- Source of order: chapter prep, `token-hygiene-checklist.md`, and earlier missions on mode choice, budget and blind retry.
- Passes: all checklist items.
- Fails / risks: none material.
- Debatable adjacent steps: low risk; the mission's prompt gives the exact rubric from mode to stop rule.
- Recommended action: Keep.
- Suggested replacement or rewrite: no change needed.

### Chapter 6 / gate-checklist-order

- Teaches: closing a long AI-assisted session without preserving noise.
- Source of order: token hygiene artifact and boss copy.
- Passes: taught closeout topic, checklist/document role, clear prompt, distinct card roles.
- Fails / risks: strict order is not necessary for the memory/update cards, and failure feedback does not explain why `save-workflow` must precede `capture-bad-case`.
- Debatable adjacent steps: `record-checks` vs `save-workflow`; `save-workflow` vs `capture-bad-case`.
- Recommended action: Replace with pair-matching.
- Suggested replacement or rewrite: map each card to a closeout role: result state, diff cleanup, evidence, reusable memory, known bad case.

### Chapter 7 / reviewer-note-order

- Teaches: reviewer note that carries proof, source, risk and review focus.
- Source of order: verification matrix artifact, chapter missions on evidence and domain source, and mission copy.
- Passes: visible document order, explicit prompt and mentor hint, distinct roles, feedback points to proof and risk.
- Fails / risks: several note sections are valid in more than one order.
- Debatable adjacent steps: `commands` vs `oracle`; `remaining-risk` vs `review-focus`.
- Recommended action: Rewrite and keep.
- Suggested replacement or rewrite: make the rubric "change story -> factual evidence -> rule source -> uncovered risk -> reviewer ask" and adjust failure feedback to name this story order.

### Chapter 7 / gate-review-note

- Teaches: final PR note in the verification boss.
- Source of order: regular mission `reviewer-note-order`, verification matrix artifact, and boss copy.
- Passes: taught document shape, clear prompt and mentor hint, distinct cards, failure feedback mentions evidence and risk.
- Fails / risks: exact middle order is still a convention rather than a dependency.
- Debatable adjacent steps: `evidence` vs `oracle`; `risk` vs `focus`.
- Recommended action: Rewrite and keep.
- Suggested replacement or rewrite: mirror the regular rewrite and make the boss prompt say that the note is written from "result to proof, source, remaining risk and review request."

### Chapter 8 / gate-playbook-order

- Teaches: team playbook document structure.
- Source of order: chapter prep, playbook anatomy mission, prompt assembly mission, and `team-playbook-draft.md`.
- Passes: visible document/protocol order, explicit prompt and mentor hint, distinct roles, useful feedback.
- Fails / risks: this is the first strict ordering form of the playbook, and 8 cards make middle sections feel more like categories than dependencies.
- Debatable adjacent steps: `acceptance` vs `mistakes`; `mistakes` vs `examples`.
- Recommended action: Rewrite and keep.
- Suggested replacement or rewrite: either reduce the boss round to 6 larger phases or add an explicit document rubric: "purpose -> applicability boundaries -> required inputs/rules/skills -> launch prompt -> workflow -> acceptance/verification -> known bad cases -> examples/update."
