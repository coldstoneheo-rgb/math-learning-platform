# Verified Report Flow Testing

## Core Rule

AI test analysis is a draft. Teacher-verified values are the source of truth for saved scores, item correctness, growth data, feedback loops, study plans, and RAG indexing.

## Regression Coverage

`npm run test:verified-report` compiles the focused TypeScript test target with the repo's TypeScript toolchain, then runs it with Node. It covers the teacher-verified test report flow without calling Gemini or writing to Supabase:

- unchanged teacher verification keeps AI draft guidance but records teacher confirmation
- grading corrections exclude draft-derived guidance from downstream growth data
- regenerated guidance replaces excluded draft guidance and marks regenerated status
- regeneration failure keeps draft guidance excluded and records the failure reason
- regenerated guidance must include all growth-loop sections
- invalid score and ranking values are rejected before save

## Safety Principle

Fallback paths are part of the product, not an edge case. If verified-guidance regeneration fails, the report can still save the teacher-confirmed score and item data, but draft-derived weaknesses, prescriptions, and predictions must not be indexed as growth truth.
