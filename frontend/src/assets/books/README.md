# Optional real books

Drop generated book files here to have the mock RGS replay real math outcomes
instead of procedurally-generated ones:

```sh
cp ../../../math/library/novaforged/books/books_base.jsonl  ./
cp ../../../math/library/novaforged/books/books_bonus.jsonl ./
```

`src/core/mockRgs.ts` eagerly imports `*.jsonl` from this folder (via
`import.meta.glob`). Files matching `*bonus*` are used for the buy-bonus mode;
all others feed the base game. If this folder is empty the mock generates
plausible, `BookEvent`-conformant outcomes from the game definition.
