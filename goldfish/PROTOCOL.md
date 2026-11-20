# Goldfish review protocol

How the orchestrator (the main agent) reviews an architecture report with goldfish reviewers. Read [README.md](README.md) first if you have not.

## 0. Preconditions

- **A subagent tool is required** (in Claude Code: `Agent`, with the `general-purpose` type). A goldfish runs in a fresh context with no conversation history. If there is no subagent tool, stop and tell the user: a review in the same context is not a goldfish review, because it inherits your reasoning. Do not run the review yourself as a fallback.
- The personas in `agents/` are **not registered agents**. Spawn a `general-purpose` subagent and tell it to read its persona file first.
- Write for the reader in plain English: no buzzwords, no promotional adjectives (*seamless*, *robust*, *blazingly fast*), no decorative adverbs (*obviously*, *literally*, *drastically*).
- No flattery. Do not call anything "great", "correct" or "excellent". Critique first, even when the report is strong. Do not apologise when corrected: state the right fact or trade-off.

## 1. Inputs

| Input | Meaning |
| --- | --- |
| `TargetFile` | The architecture report. Default `docs/architecture.md`, or the path the user names. If it does not exist, say so and stop. |
| `RepoRoot` | The repository the report describes. Default: the current working directory. Reviewers verify claims against it. |
| `Context` (optional) | Extra files that help a reader (a glossary, an ADR folder). Only files the user names, plus nothing else. |
| `ReviewFile` | Output path: `<report-name>.review.md` next to the report, for example `docs/architecture.review.md`. |

## 2. Spawn the reviewers (parallel)

Send **all six reviewers in a single message**, one subagent call each:

| Persona file | Reads |
| --- | --- |
| `agents/codebase-details.md` | the report and the code |
| `agents/design-critic.md` | the report and the code |
| `agents/zoom-out.md` | the report, the standard, and the repository layout |
| `agents/comprehension.md` | the report only |
| `agents/structural.md` | the report only |
| `agents/style.md` | the report only |

Prompt template, passed **verbatim** with the placeholders filled in and nothing else added (do not add your opinion of the report, a summary of the conversation, or hints about what is wrong):

```
You are a goldfish reviewer. You have no conversation history.
First read your persona file in full and follow it: <absolute path to goldfish/agents/<name>.md>
TargetFile (the architecture report to review): <absolute path>
Repository root (verify claims against this code): <absolute path>
Context files: <list, or "none">
Standard: <absolute path to goldfish/standards/zoom-out-standard.md, only for zoom-out; otherwise omit this line>
Rules: you are read-only. Do not edit any file. Verify claims with commands, Grep and Read against the repository. Cite path:line for every piece of evidence. Count with a command, never estimate. Take versions from manifests and lockfiles, never from READMEs. Reply with your report in plain English.
```

For `comprehension`, `structural` and `style`, the repository root line may stay: they read the report, and only use the code as their persona allows.

**Reviewer failures.** A reviewer that times out, fails, or returns no report did not review. Retry it once. If it fails again, record it as `not run` in the review file. Never count it as a reviewer with zero findings.

## 3. Synthesize

When all reviewers have returned, spawn **one** `general-purpose` synthesizer subagent. Its prompt:

```
You are the synthesizer. You have no conversation history.
First read your persona file in full and follow it: <absolute path to goldfish/agents/synthesizer.md>
Report under review: <TargetFile>
Write the consolidated review to: <ReviewFile>
Repository root: <RepoRoot>
Reviewer reports follow, one per section, each headed by the reviewer name and its status (completed or not run).
<paste each reviewer's full report verbatim>
```

The synthesizer merges and deduplicates findings, ranks them 🔴 Blocker / 🟡 Major / 🟢 Nit, classifies each factual finding as CONFIRMED / REFUTED-by-code / UNVERIFIABLE, and writes the traceability list.

## 4. Deliver

- The review goes to `ReviewFile`. **Never paste the review into chat.** Tell the user the file path, the status of each reviewer, and the severity counts.
- If a reviewer is `not run`, say so in the chat message.
- Do not edit the architecture report yet.

## 5. Fix, only with approval

1. Read `ReviewFile`. Re-check any Blocker or Major finding you doubt yourself by running the same command or reading the same `path:line`. A reviewer can be wrong: do not apply a fix you could not reproduce. Say so when a finding fails your check.
2. Go through the findings that need a report edit **one decision at a time**: state the finding, the proposed edit, and ask the user whether to apply it. One question per turn, then wait. A finding the user declines stays in the review file as an accepted trade-off.
3. Batching is allowed only when the user says "apply all fixes" for a stated set (for example "all REFUTED-by-code findings"). Otherwise ask per finding.
4. Apply approved edits to the report. After each factual edit, Grep the whole report for the refuted term (old version, removed name, wrong count) and fix every other occurrence. Keep ASCII diagrams at their line width.
5. If the report changed, update its header with `Revised: <today>`.

## 6. Re-audit (at most one)

After fixes, you may offer **one** re-audit: spawn the reviewers again on the edited report, with a fresh synthesizer writing to `<report-name>.review-2.md`. Use only the reviewers whose findings caused edits, plus `codebase-details`. A re-audit happens at most once per review. If problems remain after it, list them as residual findings in the chat message and stop.

## 7. Classification of findings

Each factual finding carries one verdict:

| Verdict | Meaning |
| --- | --- |
| `CONFIRMED` | A reviewer showed code evidence (`path:line` or a command result) that supports the finding. |
| `REFUTED-by-code` | The code shows the report's statement is false. The report must change. |
| `UNVERIFIABLE` | The repository cannot decide it (runtime state, an external system, a deployed value). The statement stays, and it is listed in the summary. |

Findings about writing, structure or reader level carry no verdict.
