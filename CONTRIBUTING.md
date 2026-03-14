# Contributing

Scribejam is built milestone-first. Before changing code, read:
- [AGENTS.md](./AGENTS.md)
- [PLAN.md](./PLAN.md)

## Working Rules

- keep the product notepad-first
- do not add meeting bots
- do not persist raw audio
- keep main-process orchestration explicit
- keep renderer access limited to typed preload APIs
- prefer small, composable changes

## Where Work Goes

- `src/main/`: orchestration, provider/network calls, storage, meeting lifecycle, native shell
- `src/preload/`: typed bridge surface
- `src/renderer/`: UI and local presentation state
- `src/shared/`: shared contracts and types
- `tests/`: add or adjust coverage for behavior-significant changes

## Local Workflow

Install dependencies:

```bash
npm install
```

Rebuild native dependencies:

```bash
npm run rebuild-native:electron
```

Run the app:

```bash
npm run dev
```

Check the workspace:

```bash
npm run typecheck
npm test
```

## Milestone-First Expectations

Work in milestone order unless the task explicitly says otherwise.

For each change:
- map it to the active milestone
- state the acceptance criteria it is satisfying
- add tests or verification for the behavior you changed
- call out residual risks clearly if something could not be verified

## Native Module Discipline

Electron ABI compatibility matters. Treat these as release-sensitive dependencies:
- `audiotee`
- `better-sqlite3`

If native behavior looks wrong:
- rebuild native dependencies
- rerun smoke checks
- avoid assuming the issue is only renderer-side

## Security and Privacy Expectations

- never log secrets
- never log raw audio payloads
- avoid logging full sensitive transcript content
- do not commit personal environment details
- keep provider use behind internal seams

## Documentation

Update docs when behavior, setup, or contracts change. The most common files are:
- [README.md](./README.md)
- [docs/setup.md](./docs/setup.md)
- [PLAN.md](./PLAN.md)

If the implementation changes milestone behavior, make sure the docs stay aligned with `AGENTS.md`.
