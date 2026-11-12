# FormForge AI

FormForge repairs web forms and independently tests whether the repaired workflow works.

## Current scope

- **Broken baseline:** a React scholarship application with unnamed fields and a nonworking submit button.
- **Reference repair:** manually written working form, used as a control.
- **Model candidate:** an OpenAI API model reads the broken JSX and generates a **strictly validated JSON form-repair artifact**, not executable JavaScript.
- **Safe renderer:** approved field identifiers and values are rendered into working React controls, including labels, native validation, and submission confirmation.
- **Verification:** unit tests reject malformed or unauthorized artifacts; Playwright + axe-core test the generated form in a browser.

The model chooses form semantics and labels; the renderer supplies predefined functional behavior. This is a limited single-fixture repair proof of concept, **not a general-purpose source-code patcher**, GitHub PR agent, backend submission integration, or full WCAG certification. Successful local client-side submission does not persist an application on a server.

## Start

```bash
npm install
npx playwright install chromium
npm run dev
```

Open `/?variant=broken`, `/?variant=repaired`, and `/?variant=candidate`.

## Generate a real AI candidate

```bash
export OPENAI_API_KEY=... # local environment only; never commit secrets
npm run repair
npm run build
npm run test:contract
npm test
```

The generator reads only the known broken component from `src/main.jsx`, sends that excerpt to the API, validates an allowlisted schema, and writes `public/repair-candidate.json`. The JSON is ignored by git. The model's output cannot add fields, callbacks, scripts, arbitrary URLs, or new code through this interface. The candidate page uses fixed React behavior.

In CI, `CI=true npm run repair -- --mock=known` uses a **handwritten test fixture**, never an AI response. This proves the pipeline and browser oracle, not model success. Real model runs require an API key and independent, documented execution.

## Security boundary

Do not ingest arbitrary external repositories, execute untrusted code, or commit model output without isolated workers and human review. For this milestone, the model receives an explicitly limited source excerpt and produces data, not executable code. The OpenAI API receives the excerpt, so use only authorized nonsecret code.

## Next milestone

Benchmark several independently constructed broken forms; record genuine model run outcomes versus deterministic controls. Only after this gate should we build isolated repository editing and approved GitHub pull requests.

## Benchmark v1: independent semantic-label grading

`benchmarks/cases.json` defines five varied broken React forms and a separate set of acceptable semantic labels. `scripts/benchmark.mjs` calls the **real** model once per case (no mock mode), grades contract validity and expected label meaning, counts failures in the denominator, and records per-case evidence in `benchmark-results/latest.json`. These results are local and gitignored.

```bash
npm run test:benchmark        # deterministic evaluator tests, no model call
OPENAI_API_KEY=... npm run benchmark  # five real model calls, with billing
```

See [benchmark limitations](benchmarks/README.md). CI only exercises the handwritten fixture and evaluator, **never claims a live model score**. The benchmark does not prove arbitrary React form source editing, full accessibility, or backend submission.
