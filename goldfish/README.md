# Goldfish review

A goldfish is a reviewer that runs in a **fresh context with no conversation history**. It sees only the architecture report, the code and its persona file. Because it never saw the author's reasoning, the author cannot anchor it: it reads the report the way a new team member would, and it checks claims against the code instead of trusting them.

The orchestrator (the main agent, the "elephant" in the original model) spawns several goldfish in parallel, one synthesizer merges their findings, and one consolidated report is written to a file. See [PROTOCOL.md](PROTOCOL.md) for how to run it.

A review in the same context as the author is not a goldfish review. Without a subagent tool, do not run one.

## Reviewers

| Persona | File | What it does |
| --- | --- | --- |
| Fact-checker | [agents/codebase-details.md](agents/codebase-details.md) | Tests every checkable claim (counts, paths, versions, flows) against the repository. Lists claim, evidence, verdict. |
| Naive reader | [agents/comprehension.md](agents/comprehension.md) | Paraphrases what a new developer would understand and where they would get lost. |
| Zoom out | [agents/zoom-out.md](agents/zoom-out.md) | Checks scope, simplicity, altitude, coverage and fit to the stated seniority level. |
| Design critic | [agents/design-critic.md](agents/design-critic.md) | Challenges the report's conclusions and pain points: is the evidence enough, what is the strongest counter-argument. |
| Structure | [agents/structural.md](agents/structural.md) | Checks the report against the section layout the skill prescribes, heading hierarchy, tables, diagrams. |
| Style | [agents/style.md](agents/style.md) | Checks plain-English writing, objectivity and calibrated claims. |
| Synthesizer | [agents/synthesizer.md](agents/synthesizer.md) | Merges and deduplicates findings (Blocker / Major / Nit), adds verdicts and a traceability list, writes the review file. |

The standard that `zoom-out` applies is in [standards/zoom-out-standard.md](standards/zoom-out-standard.md).

## Layout

```
goldfish/
  README.md
  PROTOCOL.md
  agents/      one persona file per reviewer, plus the synthesizer
  standards/   zoom-out-standard.md
```

## Not ported

Three personas from the original plugin were left out because they serve other stages of a design-document workflow:

- `bootstrap_orchestrator`: writes directory README files for a codebase. It does not review a report.
- `implementation_readiness`: judges whether an implementation plan is detailed enough to build from. An architecture report of an existing system has no plan.
- `inventive_catalyst`: looks for contradictions to eliminate in a proposed design. A report describes a design that already exists.

## Attribution (NOTICE)

The personas, the synthesizer and the zoom-out standard in this folder are derived from the `egm` plugin, version 0.1.1, licensed under the Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0). The original license text is in the root of that plugin (`LICENSE`).

Changes made:

- Re-aimed from reviewing design documents and implementation plans to reviewing an architecture report of an existing codebase.
- Removed the brainstorm mode, the feature-spec and implementation-plan stages, and the line-range inputs tied to them.
- `codebase-details` became a fact-checker with an explicit evidence method and verdicts (CONFIRMED, REFUTED, PARTIAL, UNVERIFIABLE).
- `design-critic` now targets the report's conclusions and pain points; `structural` checks the layout this skill prescribes.
- Persona files are plain role files, not registered agents; they are loaded by telling a general-purpose subagent to read them.
- The synthesizer no longer spawns reviewers: the orchestrator does.
- Added a traceability list and a fact-check ledger to the review output.
