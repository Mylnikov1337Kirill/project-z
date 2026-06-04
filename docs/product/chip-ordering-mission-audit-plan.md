# Chip Ordering Mission Audit Plan

## Goal

Audit every current `chip-ordering` mission and boss round to decide whether it
should stay as a strict sequence mission or be replaced/reworked.

The audit must answer, for each mission:

- what the mission is trying to teach;
- whether the strict order is fair and discoverable for the player;
- what passes the checklist;
- what does not pass;
- recommended action: keep, rewrite, replace with `pair-matching`, replace with
  `scenario-decision`, or replace with `chip-picker`.

The final deliverable must be a table of all `chip-ordering` missions with a
short rationale for each recommendation.

## Source Files

Use the authored mission catalog:

- `src/entities/chapter/model/chapters/*.ts`

Relevant implementation context:

- `src/shared/types/domain.ts`
- `src/entities/mission/lib/missionEngine.ts`
- `src/features/mission/ui/MissionInteractionBoards.tsx`
- `src/shared/api/content/publicContentProjection.ts`

Do not change code during this audit. This is a content/product assessment.

## How To Find Missions

Search for:

```bash
rg -n "kind: 'chip-ordering'|correctOrder" src/entities/chapter/model/chapters
```

Include both regular missions and boss fight rounds. Boss rounds are especially
important because a sequence can feel unfair if the ordering protocol appears
for the first time inside the final fight.

## Checklist

For each `chip-ordering` mission, answer these six questions.

### 1. Was The Order Already Taught?

Check whether the player already saw this order in:

- chapter prep;
- previous mission copy;
- artifact/template structure;
- mentor hint;
- retry principle;
- chapter takeaway.

Pass if the order is grounded in a visible course protocol.

Fail if the mission expects the player to infer the author's private philosophy.

### 2. Is This A Protocol/Document Order?

Strict sequence is appropriate when the mission assembles a known protocol or
document, for example:

- self-review;
- task brief;
- plan-first loop;
- repo context inventory;
- skill draft;
- token hygiene checklist;
- reviewer note;
- playbook document.

Strict sequence is risky when the mission asks for a general strategy such as
"how to work with an agent correctly" without a stable artifact structure.

### 3. Does Prompt Or Mentor Hint Give A Sorting Rule?

The player should see a principle before the first attempt, such as:

- "from task frame to evidence and handoff";
- "from goal and scope to acceptance and verification";
- "before code: read-only, plan, human decision; after code: change, checks,
  summary";
- "from purpose and boundaries to inputs, workflow, verification and update".

Pass if the mission copy gives a clear ordering rubric without revealing exact
answer ids.

Fail if the player must guess why one valid-looking step comes before another.

### 4. Are Neighboring Steps Non-Interchangeable?

Strict order is fair only when adjacent steps have a clear dependency.

Fail if two neighboring steps can honestly swap places without changing the
workflow meaning.

Common red flags:

- two evidence/checking cards that differ only by wording;
- "record checks" and "name checks" both present without a clear distinction;
- "risk", "focus", and "summary" cards where several orders could be defended;
- 7-8 cards where middle steps are categories rather than dependencies.

### 5. Do Cards Have Distinct Roles?

Pass if each card has a visibly different role.

Good examples:

- goal;
- scope;
- out of scope;
- examples;
- acceptance;
- verification.

Fail if the cards read like similar rituals, status notes, or synonyms.

If the important skill is recognizing each card's role, consider
`pair-matching` instead of `chip-ordering`.

### 6. Does Failure Feedback Teach The Principle?

A wrong attempt should help the player understand the ordering principle without
leaking the exact answer.

Pass if failure feedback, retry principle, or answer details explain the
protocol-level reason.

Fail if the feedback effectively says only "the order is wrong" and the player
still cannot tell how to improve.

## Decision Rules

Use these recommendations consistently.

### Keep As `chip-ordering`

Choose this when:

- the order is a visible protocol or document structure;
- the protocol was taught before or in the mission text;
- adjacent steps have meaningful dependencies;
- the prompt/mentor hint gives a clear sorting rubric;
- failure feedback reinforces the principle.

### Rewrite And Keep As `chip-ordering`

Choose this when:

- strict order is defensible;
- the mission is grounded in a chapter protocol;
- but current prompt, mentor hint, card labels, or feedback do not make the
  ordering rule clear enough.

Recommended rewrite direction:

- frame it as "assemble the chapter protocol";
- add an explicit "from X to Y" ordering rubric;
- clarify confusing adjacent cards;
- avoid presenting the order as a universal engineering truth.

### Replace With `pair-matching`

Choose this when:

- roles are more important than exact order;
- adjacent steps are debatable;
- the mission is really about mapping concepts to functions or phases.

Example targets:

- card -> `before changes`;
- card -> `human control point`;
- card -> `evidence`;
- card -> `handoff`;
- card -> `stop condition`;
- card -> `update/maintenance`.

This is the default replacement for sequence missions that feel like a
philosophical workflow rather than a concrete protocol.

### Replace With `scenario-decision`

Choose this when:

- the mission is about choosing the next action in a concrete situation;
- there is a scenario, risk, and several possible moves;
- linear ordering is less important than judgment.

### Replace With `chip-picker`

Choose this when:

- the player needs to choose which elements belong in a good protocol;
- exact order is not important;
- there are useful and harmful elements.

## Output Format

Produce a markdown report with this structure.

```markdown
# Chip Ordering Mission Audit

## Summary

- Total chip-ordering missions:
- Keep:
- Rewrite and keep:
- Replace with pair-matching:
- Replace with scenario-decision:
- Replace with chip-picker:

## Findings

| Chapter | Mission id | Mission title | Current role | Checklist result | Recommendation | Rationale |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | self-review-assembly | Собери самопроверку перед ревью | Protocol/document order | Pass: 1,2,3,5,6. Risk: 4. | Rewrite and keep | The self-review protocol is visible, but adjacent evidence/handoff copy should be made less debatable. |

## Per-Mission Notes

### Chapter N / mission-id

- Teaches:
- Source of order:
- Passes:
- Fails / risks:
- Debatable adjacent steps:
- Recommended action:
- Suggested replacement or rewrite:
```

Keep rationale short and specific. Do not write broad commentary like "seems
fine" or "could be better" without naming the failed checklist item.

## Audit Priority

Review in this order:

1. Boss `chip-ordering` rounds.
2. Missions with 7-8 cards.
3. Missions where prompt/mentor hint does not explicitly say "from X to Y".
4. Missions with repeated evidence/check/risk/summary-style cards.
5. Remaining regular protocol/document sequence missions.

## Red Flag

The strongest reason to replace a mission:

> The player can understand that a card belongs in the workflow, but cannot
> reasonably prove why it must be exactly step 3 rather than step 4.

If this is true, prefer `pair-matching` unless the copy can be rewritten to make
the dependency obvious.

## Non-Goals

- Do not redesign the mission engine.
- Do not expose `correctOrder` to the client.
- Do not weaken answer-key privacy.
- Do not use failed feedback to reveal the exact correct sequence.
- Do not replace all sequence missions by default.

## Expected Final Recommendation

The likely target shape is:

- keep strict sequence for concrete templates and artifacts;
- rewrite sequence copy to say "chapter protocol" where needed;
- replace ambiguous workflow-order missions with `pair-matching`;
- reserve `scenario-decision` for contextual judgment calls;
- reserve `chip-picker` for membership/composition checks.
