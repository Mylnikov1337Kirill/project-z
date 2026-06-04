# Rules & Skills MLP Subtasks

Use this as the implementation handoff for adding the mandatory `Rules & Skills` chapter. The source plan is `docs/product/rules-and-skills-mlp-plan.md`.

## Global Constraints

- Target is MLP, not MVP: playable, polished, tested and documented.
- New chapter is visible Chapter 5 and sits between current Chapter 4 and current Chapter 5.
- Use the hard-renumbered id for the inserted chapter: `chapter-5`.
- Pre-prod/test databases are disposable, so no legacy progress migration is required.
- Keep the chapter tool-agnostic. Do not teach Codex Skill / `SKILL.md`, Cursor rules or Claude/Codex file formats as the target.
- `playbook` remains the final chapter topic. New chapter may route knowledge to "playbook" as a carrier, but must not teach playbook anatomy in depth.
- New artifacts are two separate files: `rules-inventory.md` and `skill-draft.md`.

## RSK-00: Source And Example Review

Goal: choose concrete example domains for final authored mission copy.

Inputs:

- `docs/product/rules-and-skills-mlp-plan.md`
- existing Project Z docs under `docs/product`
- current chapter 4 and chapter 7 content

Work:

- Review candidates:
  - browser QA for gameplay flows;
  - mission content update;
  - backend API parity check;
  - retry principle update.
- Pick 1-2 examples for authored missions.
- Decide where synthetic examples are safer than real Project Z examples.
- Record the decision in `rules-and-skills-mlp-plan.md` or a short appendix doc.

Acceptance:

- Chosen examples are repeatable, safe, have clear inputs and clear verification.
- Examples teach rules/skills, not just context, verification or playbook rollout.
- No real secrets, PII, raw logs or unsafe data are used.

Suggested checks:

- Read-only docs review is enough.

## RSK-01: Pair Matching Domain Model And Engine

Goal: add the new "соедини пару" mission kind.

Files likely touched:

- `src/shared/types/domain.ts`
- `src/shared/api/content/publicContentProjection.ts`
- `src/entities/mission/lib/missionEngine.ts`
- `src/entities/mission/lib/missionEngine.test.ts`
- `src/entities/chapter/model/chapterCatalog.content.test.ts`

Work:

- Add `pair-matching` to `MissionKind`.
- Add public/authored pair matching types.
- Use answer shape `Record<string, string | null | undefined>`.
- Public projection must expose items/targets but not `acceptedTargetIds`, trap metadata or authored feedback.
- Engine grading:
  - exact pass when all required items match accepted targets;
  - score by matched items;
  - failed answer details show selected wrong items only;
  - no correct-map leakage.
- Support pair matching inside boss rounds.
- Extend content validation for duplicate item ids, duplicate target ids and accepted target references.

Acceptance:

- Unit tests cover correct answer, partial answer, wrong target, missing target and public non-leakage.
- Boss fight can evaluate a pair matching round.
- `npm run validate:content` still passes with existing content before new chapter is added.

Suggested checks:

- `npm run validate:content`
- `npm run test:unit -- src/entities/mission/lib/missionEngine.test.ts`
- `npm run typecheck`

## RSK-02: Pair Matching UI

Goal: render and operate pair matching missions in regular scenes and boss rounds.

Files likely touched:

- `src/features/mission/lib/useMissionSceneState.ts`
- `src/features/mission/lib/missionAnswerHelpers.ts`
- `src/features/mission/ui/MissionInteractionBoards.tsx`
- `src/features/mission/ui/MissionScene.tsx`
- `src/features/mission/ui/MissionScene.css`
- e2e tests under `e2e/project-z.spec.ts`

Work:

- Add controller state for pair assignments.
- Add ready-state logic: all required items assigned.
- Add answer summary for boss dossier.
- Add mission type label, action fallback and context fallback.
- Build pair matching board:
  - desktop: item list + target zones;
  - mobile: assignment rows or one active item with target buttons;
  - click/tap assignment is primary;
  - drag/drop is optional enhancement.
- Ensure no correctness styling before submit.
- Show failed feedback only after evaluation.

Acceptance:

- Pair matching works as a regular mission.
- Pair matching works inside boss.
- Layout is stable on desktop and mobile.
- Failed attempt does not reveal full correct mapping.

Suggested checks:

- `npm run typecheck`
- `npm run lint`
- focused Playwright test for pair matching once test content exists
- browser QA at desktop and mobile viewports

## RSK-03: Multi-Artifact Support

Goal: allow Chapter 5 to produce two separate artifacts.

Files likely touched:

- `src/shared/types/domain.ts`
- `src/shared/api/artifacts/artifactTemplateRegistry.ts`
- `src/shared/api/artifacts/templates/*`
- `src/shared/api/artifacts/markdownArtifactService.ts`
- `src/shared/api/artifacts/markdownArtifactService.test.ts`
- `src/pages/badge/BadgePage.tsx`
- `src/pages/closeout/CourseCloseoutPage.tsx`
- `src/entities/chapter/model/chapterCatalog.content.test.ts`
- e2e tests

Work:

- Add `artifacts: ChapterArtifact[]` support.
- Either migrate all chapters to `artifacts` or keep `artifact` backward compatible behind a helper.
- Add artifact ids:
  - `rules-inventory`
  - `skill-draft`
- Add template factories:
  - `createRulesInventoryMarkdown`
  - `createSkillDraftMarkdown`
- Update badge UI to preview/download multiple artifacts for Chapter 5.
- Update final archive to list both Chapter 5 files.
- Update tests for multi-artifact behavior.

Acceptance:

- Existing single-artifact chapters still work.
- Chapter 5 shows and downloads two distinct markdown files.
- Final course archive includes both files.
- No duplicate artifact ids or filenames in validation.

Suggested checks:

- `npm run validate:content`
- `npm run test:unit -- src/shared/api/artifacts/markdownArtifactService.test.ts`
- focused e2e for badge/archive artifacts

## RSK-04: New Trap Concepts

Goal: add trap vocabulary needed by the new chapter.

Files likely touched:

- `src/shared/types/domain.ts`
- `src/entities/trap/model/trapConcepts.ts`
- any field guide/trap display tests if present

Work:

- Add:
  - `stale-rule`
  - `conflicting-instructions`
  - `prompt-instead-of-skill`
  - `unsafe-always-on-context`
- Write concise labels and descriptions in the existing trap style.
- Use existing traps where they fit instead of overusing new trap ids.

Acceptance:

- Trap field guide renders new concepts.
- New trap ids are valid in authored mission content.
- Copy explains risk without tool-specific references.

Suggested checks:

- `npm run validate:content`
- `npm run typecheck`

## RSK-05: Chapter 5 Authored Content

Goal: add the new playable chapter config.

Files likely touched:

- `src/entities/chapter/model/chapters/chapterFive.ts`
- `src/entities/chapter/model/chapterCatalog.ts`
- `src/entities/chapter/model/missionFeedback.ts`
- `src/entities/chapter/model/chapterCatalog.content.test.ts`

Work:

- Add new chapter after current Chapter 4.
- Use id `chapter-5`, visible order `5`.
- Draft metadata:
  - title: `Rules & Skills`
  - framing in copy: `Управление агентом`
  - badge: `Куратор инструкций`
  - visual: `instruction-router`
- Add 4 regular missions:
  - `knowledge-carrier-match`
  - `rule-scope-gate`
  - `skill-draft-order`
  - `instruction-drift-fix`
- Add boss `instruction-drift` with 4 rounds:
  - `gate-carrier-match`
  - `gate-rule-scope`
  - `gate-skill-anatomy`
  - `gate-release-decision`
- Add prep briefing and curated resources.
- Add recap/reward copy.
- Attach two artifacts.
- Add retry principles that do not reveal hidden correct mappings.

Acceptance:

- Chapter has prep, visual, reward, recap, 4 missions, boss and 2 artifacts.
- Mission copy is tool-agnostic.
- `playbook` appears only as a carrier/next-level workflow, not as a duplicate lesson.
- `npm run validate:content` passes.

Suggested checks:

- `npm run validate:content`
- `npm run test:unit`

## RSK-06: Hard-Renumber Existing Chapters

Goal: insert the new chapter and keep visible chapter numbers, ids, filenames and routes consistent.

Files likely touched:

- `src/entities/chapter/model/chapters/chapterSix.ts`
- `src/entities/chapter/model/chapters/chapterSeven.ts`
- `src/entities/chapter/model/chapters/chapterEight.ts`
- `src/entities/chapter/model/chapterCatalog.ts`
- `src/entities/chapter/model/chapterCatalog.content.test.ts`
- e2e fixtures/tests
- backend parity/api tests

Work:

- Update visible orders:
  - current `chapterSix` -> order `6`;
  - current `chapterSeven` -> order `7`;
  - current `chapterEight` -> order `8`.
- Rename modules/exports/ids so they match visible chapter order.
- Keep validation compatible with `chapter.id === chapter-${chapter.order}`.
- Update tests that hard-code expected 7 chapters or old visible order.
- Update copy/routes/tests that assume current Chapter 7 is final.

Acceptance:

- Catalog has 8 visible chapters in the right order.
- Chapter routes resolve through the hard-renumbered ids.
- Final chapter logic uses `chapters.length`, not hard-coded `chapter-8` assumptions except where testing the actual final chapter.

Suggested checks:

- `npm run validate:content`
- `npm run test:unit`
- `npm run typecheck`

## RSK-07: Map And Landmark Update

Goal: support an 8-node map with the new chapter landmark.

Files likely touched:

- `src/shared/types/domain.ts`
- `src/features/map/WorldMap.tsx`
- `src/features/map/WorldMap.css`
- `src/features/map/lib/mapViewModel.ts`
- `src/features/map/lib/mapViewModel.test.ts`
- `docs/product/map-landmark-icon-style.md`

Work:

- Add `instruction-router` to `ChapterLandmarkId`.
- Design a pixel-style sign icon for "Коммутатор инструкций".
- Update map landmark style contract with preferred read/avoid notes.
- Check route positions and mentor/robot overlap for 8 nodes.
- Update map tests for 8 chapters if they assert counts/order.

Acceptance:

- `/map` shows 8 landmarks/nodes without overlap.
- New landmark reads as instruction routing/control, not generic document.
- Existing map interactions and completed-route state still work.

Suggested checks:

- `npm run test:unit -- src/features/map/lib/mapViewModel.test.ts`
- browser QA `/map` desktop and mobile

## RSK-08: Progress, Content Version And Backend Compatibility

Goal: make the 8-chapter course coherent for local and backend progress.

Files likely touched:

- `src/shared/api/content/contentVersion.ts`
- `src/entities/chapter/lib/chapterProgress.ts`
- `src/entities/chapter/lib/progressMutations.ts`
- `src/entities/chapter/lib/chapterResume.ts`
- `src/entities/chapter/lib/courseCloseout.ts`
- `server/backend/api.ts`
- backend/node parity tests
- database tests if behavior changes

Work:

- Bump `staticContentVersion`.
- Ensure progress reconciliation creates the current 8 hard-renumbered rows.
- Update course completion from 7/7 assumptions to 8/8.
- Update backend tests that build chapter ids from catalog.
- No DB migration is needed for this pre-prod hard-renumbering; test databases can be dropped.

Acceptance:

- New learner starts with 8 progress rows.
- A learner is complete only when all current 8 chapter ids are completed.
- Mission attempts with stale content version are rejected as before.

Suggested checks:

- `npm run test:unit`
- backend api/parity focused tests
- `npm run typecheck`

## RSK-09: Neighbor Chapter Copy Updates

Goal: make the learning sequence coherent without rewriting existing chapters.

Files likely touched:

- `src/entities/chapter/model/chapters/chapterFour.ts`
- current `chapterSix.ts`
- current `chapterEight.ts`
- `src/entities/chapter/model/missionFeedback.ts`

Work:

- Chapter 4: clarify that context is the environment; rules/skills will be managed in the next chapter.
- New visible Chapter 6: mention selecting only relevant rules/skills for context budget.
- New visible Chapter 8: clarify that playbooks compose rules/skills rather than replacing them.
- Avoid deep rewrites unless existing copy becomes contradictory after insertion.

Acceptance:

- Terms flow cleanly across chapters 4 -> 5 -> 6 -> 8.
- Playbook chapter remains focused on team workflows.
- No visible copy still says the course has 7 chapters.

Suggested checks:

- `npm run validate:content`

## RSK-10: Product Docs Update

Goal: update project docs and source maps for the 8-chapter course.

Files likely touched:

- `docs/product/README.md`
- `docs/product/retry-principle-content-matrix.md`
- `docs/product/repo-context-inventory.md`
- `docs/product/verification-and-self-review.md`
- `docs/product/rules-and-skills-content-expansion.md`
- `docs/product/rules-and-skills-mlp-plan.md`

Work:

- Update source map with new Chapter 5.
- Add new mission retry principles.
- Remove or revise old no-eighth-chapter guidance in repo context inventory.
- Update 7/7 references to 8/8 where they describe current product behavior.
- Add education kit placeholders:
  - `modules/08-rules-and-skills.md`
  - `templates/rules-inventory.md`
  - `templates/skill-draft.md`

Acceptance:

- Docs no longer contradict the new 8-chapter plan.
- Retry principles cover all new mission-like targets.
- Future chats can find the plan and subtasks from `docs/product/README.md` or repo context inventory.

Suggested checks:

- `rg "7/7|7 chapters|Chapter 7 is now playable and final" docs/product/README.md docs/product/repo-context-inventory.md docs/product/retry-principle-content-matrix.md src`
- treat dated QA reports and pre-RSK audits as archival snapshots, not current product guidance
- inspect `docs/product/repo-context-inventory.md` for stale eighth-chapter blocker guidance

Result, 2026-06-03:

- Updated active source maps in `docs/product/README.md` and `docs/product/retry-principle-content-matrix.md`.
- Added retry-matrix coverage for all Rules & Skills mission-like targets.
- Revised `docs/product/repo-context-inventory.md`, `docs/product/rules-and-skills-content-expansion.md`, `docs/product/rules-and-skills-mlp-plan.md` and `docs/product/verification-and-self-review.md`.
- Added local education kit placeholders: `modules/08-rules-and-skills.md`, `templates/rules-inventory.md`, `templates/skill-draft.md`.

## RSK-11: E2E And Browser QA

Goal: prove the MLP works end to end.

Files likely touched:

- `e2e/project-z.spec.ts`
- test fixtures in e2e/backend files
- docs QA report after run

Work:

- Add focused pair matching e2e:
  - regular Chapter 5 mission;
  - failed attempt non-leakage;
  - boss pair matching round.
- Update route completion tests from 7 chapters to 8.
- Add Chapter 5 badge/artifact checks for both files.
- Update final archive checks.
- Run browser QA for:
  - `/map`;
  - new Chapter 5 flow;
  - shifted Chapter 6-8 routes;
  - final `/course/complete`.

Acceptance:

- Full local route can complete 8/8.
- Pair matching is usable on desktop and mobile.
- No browser console error-level logs in checked flows.
- Screenshots or QA notes are saved in docs as existing practice.

Suggested checks:

- `npm run test:e2e`
- in-app Browser desktop/mobile QA

Result, 2026-06-03:

- Added focused Playwright coverage for the Rules & Skills pair-matching mission on desktop and mobile, failed-attempt non-leakage, the boss pair-matching dossier round, Chapter 5 two-file badge artifacts, final archive two-file selection, and the active 8/8 route.
- Fixed two layout issues found during QA: mobile pair-matching target taps could be intercepted by the action row, and dense completed badge recap copy could crowd the artifact preview.
- Checks passed: `npm run lint`, `npm run typecheck`, `npm run validate:content`, `npm run build`, focused `npm run test:e2e -- --grep "Rules & Skills|final archive|final closeout"` (8 tests), focused badge layout e2e (1 test), and full `npm run test:e2e` (55 tests).
- Codex in-app Browser direct Vite check at `http://127.0.0.1:5174/?qa=1` showed the expected backend-only fallback with zero error-level console logs; full route browser evidence is covered by Playwright backend fixtures because direct Vite has no `/api/*` backend fixture attached.
- QA notes saved in `docs/qa-rsk-11-e2e-browser-2026-06-03.md`.

## RSK-12: Final Verification And Handoff

Goal: close the implementation with a clean verification record.

Work:

- Run:
  - `npm run validate:content`
  - `npm run test:unit`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `npm run test:e2e`
- Record verification in `docs/product/verification-and-self-review.md`.
- Update `docs/product/repo-context-inventory.md` with new repo truth:
  - 8 chapters;
  - pair matching mission kind;
  - multi-artifact support;
  - Chapter 5 rules/skills.
- Add any known residual risks.

Acceptance:

- All required checks pass or failures are documented with clear blockers.
- Future agents can work from updated docs without rediscovering the expansion.
- Final handoff links to the plan, subtasks, QA evidence and changed source files.

Result, 2026-06-03:

- Required checks passed: `npm run validate:content` (1 file / 4 tests), `npm run test:unit` (20 files / 127 tests), `npm run typecheck`, `npm run lint`, `npm run build`, and approved-local-server `npm run test:e2e` (55 tests).
- The first sandboxed e2e run hit the known `listen EPERM` local-server restriction on `127.0.0.1:5174`; the same command passed after approving local-server permission.
- Updated final handoff/source-map records in `docs/product/verification-and-self-review.md`, `docs/product/repo-context-inventory.md`, `AGENTS.md` and `/Users/kirillmylnikov/Dev/ai/project-z-development-handoff.md`.
- Residual risks remain the existing operational blockers outside the MLP: direct in-app Browser without an `/api/*` fixture cannot exercise the full backend route, and production rollout still needs own-Postgres Docker Compose DB/API/proxy smoke plus Pachca dry-run worker checks.
