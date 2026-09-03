# Deadline operating mode

Temporary guidance for the final submission day. The objective is a stable,
convincing live demo, not exhaustive revalidation after every small edit.

- Fix observed user blockers before speculative polish.
- Inspect the narrowest relevant source and change the fewest files practical.
- Add or run one focused regression test for the behavior being changed.
- Do not run full Playwright suites, full Impeccable passes, or repeated visual
  loops for isolated tweaks.
- Batch typecheck, build, lint, and one representative browser smoke at the
  commit boundary rather than after each edit.
- Treat a fresh real ChatGPT-browser observation as higher-value evidence than
  another broad synthetic pass when the defect is harness-specific.
- Preserve user files and unrelated work; keep commits small and reversible.
- Record remaining uncertainty plainly and move on unless it threatens the
  judge path.

Retire this mode after submission and return to the validation contracts in
`docs/plan/current-work.md`.
