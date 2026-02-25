# AGENTS: pkgx

Public core CLI repository for running packages.

## Core Commands

- `cargo fmt --all -- --check`
- `cargo clippy --all-features`
- `cargo test --all-features`

## Always Do

- Preserve CLI semantics and user-facing flags unless intentionally versioned.
- Keep changes in `crates/lib` and `crates/cli` compatibility-aware.
- Add tests for changed runtime behavior.

## Ask First

- Breaking CLI behavior changes.
- Distribution/release workflow changes.

## Never Do

- Never skip tests on core execution path changes.
- Never merge compatibility-sensitive changes without impact notes.
