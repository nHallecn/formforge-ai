# FormForge semantic-label benchmark v1

Five independently specified React snippets keep the existing three-field repair contract. They vary contextual hints, label absence, placeholders and button wording.

## Execute genuine model calls

```bash
npm install
OPENAI_API_KEY=... npm run benchmark
```

Optionally set `FORMFORGE_MODEL`. The runner sends five source excerpts to the configured OpenAI API model and saves `benchmark-results/latest.json`, ignored by git. The report records model, case IDs, latency, token counts when returned, a SHA-256 of the case definitions, individual failures and an overall pass rate. No model outputs or private source strings are embedded in the report.

**No credentials?** `npm run test:benchmark` tests the evaluator with handwritten fixture artifacts, but **does not measure AI performance**. The benchmark runner deliberately refuses a mock flag and fails closed without API credentials.

## Measurement scope

- Contract validity: generated JSON obeys the locked allowed-field schema.
- Semantic label agreement: each generated label matches independently specified acceptable synonyms for its fixture.
- Failures: failed requests or malformed candidate artifacts count as attempts, not skipped cases.
- Browser accessibility and functional correctness are **separate** checks in `npm test`, using a known candidate artifact in CI.

This is a limited semantic-label test, not a real-world repair success rate. Exact accepted synonyms can create false negatives for otherwise reasonable labels and false positives for insufficiently descriptive labels. The cases share the same fields and cannot establish performance on arbitrary form schemas. Never claim WCAG conformance from these results.

## Go/no-go

Do not claim general repair effectiveness or move to repository patch execution until multiple **live** model benchmark runs are recorded, reviewed for semantic grading limitations, and paired with browser validation. Candidate acceptance must remain human-reviewed.
