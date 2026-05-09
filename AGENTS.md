# AGENTS.md

## Overview

Deno TypeScript CLI tool (`publish-util` / `pu`) that publishes `.tgz` npm packages to private Nexus registries. Despite the parent folder name "Bun", this project uses Deno exclusively.

## Commands

```bash
deno task dev          # run with --watch
deno task start        # run once
deno task check        # lint THEN typecheck (order matters, run before commit)
deno task lint         # deno lint
deno task typecheck    # deno check src/**/*.ts
deno task format       # deno fmt
deno task test         # deno test --allow-all
deno task build        # check + compile to dist/pu.exe (Windows x64 only)
deno task clean        # clean dist/
```

Run `deno task check` to validate changes — it runs lint then typecheck in sequence.

## Code Style

- Path alias: `@/*` maps to `src/*` (use `@/` imports, not relative `../`)
- Formatting: 2-space indent, no tabs, single quotes, semicolons, 120-char line width, LF line endings
- `deno fmt` and `deno lint` scope only to `src/` and `scripts/`
- Strict TypeScript: `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noUncheckedIndexedAccess`

## Architecture

```
src/
├── index.ts              # Entrypoint: parses CLI, creates App, calls run()
├── core/
│   ├── cli.ts            # yargs CLI parsing (options: -d, -r, -a, -t, -l)
│   └── app.ts            # Orchestrates publishMode() via PackageManager
├── services/
│   ├── package-manager.ts        # Main publish pipeline (scan → check → upload)
│   ├── package-scanner.ts        # fast-glob .tgz scanning
│   ├── package-info-extractor.ts # Parses package.json from .tgz
│   ├── package-checker.ts        # Single-package existence check against registry
│   ├── package-uploader.ts       # Upload via fetch API
│   ├── publish.ts                # Legacy publish service
│   ├── progress-tracker.ts       # Progress tracking
│   ├── upload-progress-tracker.ts
│   └── task-file-tracker.ts      # Tracks processed packages to file
├── types/
│   └── index.ts          # All type definitions and interfaces
└── utils/
    ├── logger.ts
    ├── error-handler.ts
    ├── registry-url-parser.ts
    └── task.ts           # Concurrency utility
```

## Key Details

- No tests currently exist (test globs `src/**/*_test.ts` and `tests/**/*.ts` match nothing). The only test file is `src/services/task-file-tracker.test.ts` but isn't matched by the config pattern.
- Dependencies use `npm:` prefix in `deno.json` imports (e.g., `npm:chalk@^5.6.2`), no package.json or node_modules needed at runtime.
- Build target is hardcoded to `x86_64-pc-windows-msvc`; change for other platforms.
- `scripts/` directory is empty.
- Registry URL must match pattern: `${baseURL}/repository/{repository}/` — parsed by `registry-url-parser.ts`.
