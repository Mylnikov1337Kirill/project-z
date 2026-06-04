# Map Landmark Icon Style Contract

Use this contract before changing the inner pictograms on the world map landmark signs. The goal is to keep the map readable as a retro game object, not a set of tiny UI screenshots.

## Scope

This applies to the decorative chapter landmarks rendered by `src/features/map/WorldMap.tsx` and styled in `src/features/map/WorldMap.css`.

The shared station-sign canvas is intentionally reusable:

- 64x64 SVG viewBox, rendered around 74px on the map.
- A sign frame, header bar, post and shadow from `LandmarkStation`.
- A small inner pictogram that changes by `chapter.visual.landmarkId`.

Do not redesign the shared sign frame when the task is only to fix one chapter's inner icon.

## Visual Language

- Use crisp pixel SVG shapes: `rect`, orthogonal `path`, simple `polygon` and square-capped strokes.
- Use whole-number coordinates. Avoid fractional coordinates, CSS rotation and subpixel transforms.
- Keep visible interior details at least 3 viewBox units wide/tall. Anything smaller will turn into noise at map size.
- Prefer one strong silhouette over several small objects. The viewer should read the object first, then the chapter theme.
- Use the existing classes first: `landmark-line`, `landmark-main`, `landmark-symbol-fill`, `landmark-icon-stroked`, `landmark-icon-wire`.
- Keep the frame and pictogram visually related: the icon should feel printed/painted on the sign, not pasted over it.
- Avoid gradients, blur, shadows, opacity tricks or illustrative details inside the pictogram.

## Composition

- Keep the inner pictogram inside roughly `x=18..50` and `y=20..43`.
- Leave breathing room from the sign frame; the pictogram should not touch the frame stroke or post.
- Align the icon optically to the sign center, not only mathematically. A right-pointing arrow or check mark may need less rightward mass.
- Use at most one primary object plus two small support marks such as sparks, ticks or short lines.
- Avoid nested mini-frames unless the chapter concept truly needs a screen/window. Double frames read as broken artifacts at this size.
- Avoid diagonal check marks over other objects. They often look like collision or damage on the sign.
- Avoid text, letters, tiny document lines, tiny UI controls and multi-column layouts.

## Chapter Metaphors

The icon should express the chapter skill, not merely a literal artifact filename.

| Chapter landmark | Preferred read | Avoid |
| --- | --- | --- |
| `diff-forge` | forge/anvil/refined diff; author takes responsibility and shapes the change before review | stacked paper plus checkmark; tiny diff UI; checkmark crossing content |
| `brief-tower` | brief, speech bubble, bounded task note | generic chat app, too many text rows |
| `plan-gate` | gate, sequence, next step, plan before action | indistinct bars or a plain play button without the gate idea |
| `context-archive` | folder/archive/project context pack | overloaded file tree or many tiny tabs |
| `instruction-router` | routing switch, instruction control, scoped rule/skill branching | generic document, tiny flowchart labels, dense wiring that turns into line soup |
| `attention-window` | focused window, attention frame, centered signal | abstract rectangle with no focal point |
| `verification-lab` | evidence, lab check, tested result | checkmark dominating a weak object |
| `playbook-relay` | playbook/manual plus reusable handoff signal | spreadsheet, generic open book with no playbook/relay cue |

## Acceptance Checklist

Do not hand off a map landmark icon change until all of these are true:

- The full `/map` desktop view shows all eight landmarks with comparable visual weight, density and alignment.
- A 90-110px crop around the changed landmark reads as one intentional object without needing its label.
- The icon still reads after a quick squint check: no line soup, accidental tangles, or collision between symbol parts.
- The pictogram uses a simple silhouette: one primary object and no more than two support marks.
- No interior detail is smaller than 3 viewBox units in its narrow dimension.
- No diagonal mark crosses and obscures another object.
- The icon stays inside the sign face and does not collide with the frame, post or shadow.
- The landmark remains decorative and non-interactive; chapter nodes stay the only clickable route targets.
- The changed landmark does not overlap nodes, route line, mentor bubble or chapter ribbon in the desktop/fullscreen-first map view.
- A landmark may tuck behind the robot at an avatar stop, but the robot must not fully cover it; enough of the sign should remain visible to read as an intentional object.
- Browser console has no error-level messages after loading `/map`.

## QA Evidence

For source changes, run the normal project checks:

```bash
npm run lint
npm run build
```

For visual changes, also use the Codex in-app browser when available:

1. Open `/map` at a desktop/fullscreen-first viewport.
2. Capture or inspect the full map.
3. Capture or inspect a close crop of each changed landmark at its rendered size.
4. Compare the changed icon against neighboring landmark icons for weight, density and clarity.
5. Report browser QA evidence in the final response or in `docs/product/verification-and-self-review.md`.

Stop and revise instead of reporting done if the icon only makes sense after reading an explanation.
