# Screenshot Checklist

Capture real evidence after verification. Add 3–5 PNG files here and embed them in the submission PR. Do not include credentials or private information.

1. **`01-ai-planning.png`** — Show your prompt and Codex's plan or generated code. Include the NestJS/TypeScript choice if visible.
2. **`02-api-running.png`** — Show `npm start`, successful Nest module startup, and the printed local URL.
3. **`03-transactions-and-balances.png`** — Show the sample demo's created transaction, combined history filter, and separate USD/EUR balances.
4. **`04-validation-and-rate-limit.png`** — Show a field-level HTTP 400 response and request 101 returning HTTP 429 with `Retry-After`. Run the quota demo after restarting.
5. **`05-tests.png`** — Show passing tests, type checking, and the build. Include totals and enough command context to identify the project.

If limited to three screenshots, combine server and API output, then combine validation and test evidence. Keep text legible. Link additional terminal recordings or demo output if a single image becomes crowded.

The scripts create terminal evidence, not screenshots. Capture your own application and AI interaction using your operating system's screenshot tool.
