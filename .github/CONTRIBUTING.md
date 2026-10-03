# Contributing to Chess

Thanks for taking the time to contribute. Bug reports, ideas, docs fixes and
code are all welcome.

By taking part you agree to follow the [code of conduct](CODE_OF_CONDUCT.md).

## Ways to help

- **Report a bug.** Open a [bug report](https://github.com/jamal474/Chess/issues/new?template=bug_report.yml).
- **Suggest a feature.** Open a [feature request](https://github.com/jamal474/Chess/issues/new?template=feature_request.yml).
- **Fix something.** Issues labelled `good first issue` are a good place to start.
- **Improve the docs.** Typos and unclear steps count too.

For anything bigger than a small fix, please open an issue first so we can
agree on the approach before you put in the work.

## Getting set up

Follow the [development guide](../docs/development.md). In short:

```sh
make build
make run
```

Then open http://localhost:5173/chess/ in two tabs and play against yourself.

## Making a change

1. Fork the repo and create a branch from `main`:
   ```sh
   git checkout -b fix/castling-through-check
   ```
   Branch prefixes: `feat/`, `fix/`, `refactor/`, `docs/`, `chore/`.
2. Make your change, keeping it focused on one thing.
3. Check it works (see [Before you open a PR](#before-you-open-a-pr)).
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: add threefold repetition draw
   fix: block castling through an attacked square
   docs: clarify Railway variables
   ```
5. Push and open a pull request. The template will walk you through the rest.

## Before you open a PR

Run the checks for whichever parts you touched:

| Part | Command |
|---|---|
| Client | `cd client && npm run typecheck && npm run build` |
| Server | `cd server && npm start` (starts without errors) |
| Engine | `make build-cpp` (builds without warnings you introduced) |
| Whole stack | `make run`, then play a game in two tabs |

If you changed anything that runs in Docker, also run
`docker compose up -d --build` and check the app at
http://localhost:8080/chess/.

## Code style

- **Client (TypeScript / React):** function components and hooks; keep socket
  logic in `hooks/` and `lib/`, not in components. Use Tailwind classes rather
  than new CSS where possible.
- **Server (Node):** CommonJS, matching the existing modules. Socket handlers
  live in `src/socket/`, engine calls go through `src/cpp/`.
- **Engine (C++17):** headers in `include/`, sources in `src/`, grouped by layer
  (`net/`, `engine/`, `common/`). One class per piece in `engine/pieces/`.
- Match the formatting of the file you're editing.
- Use the existing loggers rather than `console.log` or `std::cout`.

## Socket events and the engine protocol

The client, relay and engine share event names and JSON payloads. If you add or
change one, update all three sides in the same PR and say so in the
description.

## Reporting security issues

Please don't open a public issue for security problems. See the
[security policy](SECURITY.md).
