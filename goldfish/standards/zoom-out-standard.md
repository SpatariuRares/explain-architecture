# Zoom Out Standard (architecture report)

Adapted from the `egm` plugin v0.1.1 (Apache 2.0). See `../README.md`.

This standard defines the quality bar for an architecture report of an existing codebase, read from a high-altitude perspective.

## Core Principle

A report passes if a reader at the stated seniority level can build a correct mental model of the system from it, at the right altitude: components, boundaries, data flows and the reasons behind them, without drowning in code-level detail and without leaving out what the reader needs to work safely in the codebase.

## 0. Context Sufficiency (Prerequisite Check)

*   **Objective**: The report must say what the system does, who uses it, and which seniority level it targets. If the reviewer cannot tell what the report is meant to help the reader do, fail the review immediately with a request for context.

## 1. Reader Fit

*   **Seniority match**: Beginner reports explain concepts and give analogies. Intermediate reports explain patterns and the reasons for decisions. Senior reports give trade-offs, non-obvious choices and pain points. Flag content aimed at the wrong level.
*   **Sections the level requires**: the pain-points section is expected for Intermediate and Senior, optional for Beginner.

## 2. Simplicity

*   **Minimal explanation path**: Each concept is explained once, in the place where the reader first needs it. Flag repetition and detours.
*   **No speculative content**: Flag sections that describe things "that may be added" or "could be useful" instead of what exists.
*   **Right-sized diagrams**: A diagram shows the components and flows the text discusses, no more. Flag diagrams that need a legend the report does not give.

## 3. Anti-Weeds (Altitude Control)

*   **Premature detail**: High-level sections (overview, architecture, data model) focus on components, interfaces and data flows, not on helper functions, loop variables or per-line behavior.
*   **Right placement**: Detail belongs in the module breakdown or the end-to-end flow, not in the overview.
*   **Concrete anchors**: Altitude control does not mean vagueness. Each module and flow still names the real files or classes a reader should open first.

## 4. Coverage

*   **Nothing important missing**: Every top-level module, service or deployable in the repository appears in the report. Search the repository to check; report omissions.
*   **Cross-cutting concerns**: Authentication, messaging, error handling and logging are covered if the code has them.
*   **Conventions**: The non-obvious rules a new developer must know are listed, and each one is backed by something in the code.
