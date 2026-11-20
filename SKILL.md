---
name: explain-architecture
description: Analyzes the codebase, explains its architecture tailored to the user's seniority level, and writes a detailed markdown report file — or reviews an existing report against the current code and fixes it. Use when user asks "how does this codebase work", "explain the architecture", "walk me through the code", "explain this project", "generate an architecture report", wants an overview of the system, or asks to review, verify, check or update docs/architecture.md, or asks for a goldfish review of the architecture report.
---

# Explain Architecture

## Workflow

### Step 0 — Pick the mode

- **Review mode**: the user asks to review, verify, check or update an existing architecture report (`docs/architecture.md` or a path they name). Follow [REVIEW.md](REVIEW.md) and skip the steps below.
- **Create mode**: everything else. Continue with Step 1. If `docs/architecture.md` already exists, ask whether to regenerate it or review it.

### Step 1 — Ask seniority + subagent preference

Before analyzing anything, ask two questions in one message:

> **1. What's your experience level with [detected framework/stack]?**
> - **Beginner** — new to the framework, need analogies and simple concepts
> - **Intermediate** — know the basics, want patterns and why decisions were made
> - **Senior** — know the stack well, want trade-offs, non-obvious design choices, and pain points
>
> **2. Should I use parallel subagents to analyze all modules simultaneously?**
> - **Yes, use subagents** — faster and more thorough; each module gets a dedicated agent (recommended for large codebases with 4+ services)
> - **No, analyze sequentially** — simpler, single-agent walkthrough

Wait for both answers before proceeding.

---

### Step 2 — Analyze the codebase

#### Without subagents (sequential)

Explore in this order:
1. Root files: `README`, `CLAUDE.md`, `pom.xml` / `package.json` / `build.gradle` — identify stack, modules, build tool
2. Top-level directory structure — identify layers per service
3. Entry points — `main()`, `Application.java`, `index.ts`, `App.tsx`
4. Key cross-cutting concerns — auth, error handling, logging, messaging, DB access
5. One representative end-to-end flow (e.g. "create resource" or "fetch list") traced top to bottom

#### With subagents (parallel)

Spawn one `Explore` subagent per major module **in parallel**. Each agent must return:
- Module purpose (1-2 sentences)
- Package structure (layers found)
- Key classes / entry points
- External dependencies (DB, Kafka, REST calls to other services)
- Non-obvious patterns or constraints
- One representative end-to-end flow within the module

Also spawn a dedicated agent for cross-cutting concerns: auth, Kafka topics, shared base classes, error handling.

Collect all results before proceeding to Step 3.

#### Facts that go stale

Whatever the mode, take these from the source of truth, never from READMEs, `CLAUDE.md` files or memory:
- versions: the manifests (`package.json` dependencies and `engines`, `.nvmrc`, `pom.xml`, lockfiles);
- the live schema: replay the migrations, newest last — a recent `DROP TABLE` invalidates whole features;
- counts (lines, files, routes, tables): count them with a command or script, never estimate.

---

### Step 3 — Generate the architecture report

Write the report to a file at the root of the project: **`docs/architecture.md`** (create `docs/` if it doesn't exist).

The report must contain all sections below, adapting depth and language to the user's seniority level.

```markdown
# Architecture Report — [Project Name]

> Generated: [date]  
> Seniority level: [Beginner / Intermediate / Senior]

## 1. Project Overview
One paragraph: what the system does, who uses it, the business domain.

## 2. Technology Stack
Table: technology | version | purpose | why chosen (if inferable)

## 3. High-Level Architecture
- Architecture style: monolith / microservices / modular monolith
- ASCII diagram showing all services, their connections, and data flows
- Description of each service (1-2 sentences each)

## 4. Module Breakdown
For each module/service:
### [Module Name]
- **Purpose**: what it owns
- **Package structure**: layers and their responsibilities
- **Key classes**: the 3-5 most important files with a one-line description each
- **Database**: what it reads/writes, schema highlights
- **External calls**: which other services it talks to and how (REST / Kafka)

## 5. Cross-Cutting Concerns
### Authentication & Authorization
How auth works, token validation, permission model.

### Messaging / Events
Kafka topics, producers, consumers, event flow diagram (ASCII).

### Shared Code (commons)
What lives in the commons module and why. Base classes every service extends.

### Error Handling
How errors propagate from repository to HTTP response.

### Logging & Observability
Logging conventions, metrics endpoints, tracing if present.

## 6. Data Model
Key entities, their relationships, and which service owns them.
Include an ER-style ASCII diagram if there are more than 5 entities.

## 7. End-to-End Request Flow
Trace one representative operation (e.g. "User creates a resource") through every layer:
- Browser → Gateway → Service → Manager → Service → Repository → DB
- Include real class names and file paths.

## 8. Key Design Patterns
List patterns in use (Repository, CQRS, Saga, etc.) with a concrete example of each.

## 9. Non-Obvious Constraints & Conventions
Bullet list of rules a new developer must know that aren't obvious from reading the code.
(Examples: "no JPQL queries", "always paginate", "never call internal endpoints from the frontend")

## 10. Potential Pain Points
(Intermediate / Senior only)
Areas with high coupling, missing abstractions, scaling risks, or known tech debt.
```

---

### Step 4 — Chat summary + offer follow-up

After writing the file, print a brief summary in chat (not the full report):
- File written to: `docs/architecture.md`
- Modules covered: [list]
- Key insight: one surprising or non-obvious thing found

End with exactly one question, then stop and wait:
> "Want me to run a goldfish review of this report? Independent reviewers with fresh context will check its facts against the code and judge clarity, structure and conclusions."

If the user accepts, follow [goldfish/PROTOCOL.md](goldfish/PROTOCOL.md). If the user declines, or asks about a module, flow or design decision instead, answer that. Ask no other question.
