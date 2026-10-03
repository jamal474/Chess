# Dev games

Saved positions for development. Each `.pgn` file here can be loaded into a
running game from the dev panel, or opened directly with a link like
`http://localhost:5173/chess/?dev=scholars-mate`.

These are **only used in development**. They are not part of any Docker image
or production build. See [docs/development.md](../../docs/development.md#dev-tools-jump-to-any-position)
for the full guide.

## Format

Plain [PGN](https://en.wikipedia.org/wiki/Portable_Game_Notation), the format
every chess site exports:

```pgn
[Event "Scholar's mate"]
[Description "White to play Qxf7#. Tests checkmate detection."]
[Ply "6"]

1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# *
```

| Tag | Meaning |
|---|---|
| `Event` | Name shown in the dev panel (optional, defaults to the file name) |
| `Description` | One line explaining what the position is for (optional) |
| `Ply` | Where to stop by default: the number of half-moves to play. `6` = after Black's 3rd move. Leave it out to play every move. |

Moves can be written as:

- **SAN**: `e4`, `Nf3`, `exd5`, `Qxf7#`, `e8=Q`, `Nbd2`
- **Coordinates**: `e2e4`, `g1f3`, `e7e8q`

Move numbers, `+`/`#`, `!`/`?`, `{comments}`, `(variations)` and the result
(`1-0`, `*`, …) are ignored, so you can paste a game straight from lichess or
chess.com.

File names must be lowercase letters, digits, `-` or `_`.

## Engine limits

Moves are replayed through the real C++ engine, so a file can only contain
moves the engine supports today:

- **Castling** (`O-O`) and **en passant** aren't implemented yet. A file that
  uses them stops at that move with an error.
- Pawns that reach the last rank promote to a queen unless the move says
  otherwise (`e8=N`).

## Adding a game

- **Play it:** start a solo game, play the moves, then use **Save this game**
  in the dev panel. The file is written here.
- **Write it:** create `<name>.pgn` by hand or paste an export from a chess
  site. Saved files show up in the panel's list right away.
