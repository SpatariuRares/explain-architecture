# Review mode

Every factual statement in the existing report is a **hypothesis** until the current code confirms it. Reports rot fast: stacks get migrated, tables dropped, features removed. The goal is a report where every line is true today, not one that merely reads plausibly.

Keep the report's language, seniority level and 10-section structure. Apply the "Facts that go stale" rules from [SKILL.md](SKILL.md) throughout.

## 1. Read the report and build the baseline

Read the whole report. Note its `Generated` / `Revised` date. Then collect the baseline yourself, in as few commands as possible:

- versions of every module from its manifests;
- the current product version and the date of the last commit;
- every migration newer than the report's date, grepped for `DROP` / `ALTER ... DROP` / `DELETE FROM` on config tables;
- the current top-level folders of each module, compared against §4.

Done when §2 has been re-checked row by row and you hold a list of everything removed since the report's date.

## 2. Verify in parallel

Group the report into **areas**: one per major module in §4 (merge small modules — tooling, installer, shared libs — into one area), so you end up with 2-4 areas. Cross-cutting statements in §5-§10 belong to the area whose code they describe.

Launch one `general-purpose` agent per area, **all in a single message**. Each prompt contains:

- the report path and the area's module paths;
- the list of removals from step 1, so the agent does not confirm dead things;
- this contract:

> You are a verifier. Do not modify files. Read the report and check against the code EVERY factual statement about your area, in every section: file, class and method names, numbers, versions, flows, reported bugs. Count with a command or script, never estimate. Use `git ls-files` for anything claimed to be committed. Output one line per statement: `[OK | WRONG | PARTIAL | UNVERIFIABLE] — statement (§) — evidence file:line — correct value`, WRONG and PARTIAL first. End with a "Not in the report" section: bugs or relevant facts you found that the report misses.

Done when all agents have reported back.

## 3. Fix the report

Apply each area's fixes as soon as its report lands.

- **Every WRONG and PARTIAL becomes an edit.** UNVERIFIABLE lines stay, and go in the summary.
- A removed entity (table, feature, dependency, file) is purged everywhere: Grep its name across the whole report before moving on.
- Relevant "Not in the report" findings go into §10 with `file:line`.
- ASCII diagrams keep their line width; wrap longer text onto extra lines instead of breaking box borders.
- Update the header with `Revised: <today>`.

Done when a Grep for every term the verifiers refuted (removed names, old versions, wrong counts) finds nothing in the report.

## 4. Chat summary

Report briefly:

- the most significant fixes, grouped by theme rather than by agent;
- the UNVERIFIABLE statements left in place;
- inconsistencies in the repository surfaced along the way (docs citing missing files, dead code), left untouched for the user to decide.

## 5. Offer the goldfish review

The checks above are done by agents that share your instructions and your list of removals. A goldfish review is an independent second look: reviewers with a fresh context and no history re-check the facts against the code, and also judge clarity, structure, writing and the report's conclusions. After the chat summary, ask one question and wait: do you want a goldfish review of the report? If yes, follow [goldfish/PROTOCOL.md](goldfish/PROTOCOL.md).
