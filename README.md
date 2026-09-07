# CSV table for Rundock

A read-only renderer for `.csv` files. Open a CSV in Rundock and, instead of raw text, you see a table: the first row as the header, the rest as rows, with a caption stating the row and column count.

This repository is one of the two example packages for Rundock 0.14.0. It is deliberately small so it can be read in one sitting: one manifest, one script, no dependencies, no build step.

## What it renders

- The first row becomes `<thead>`; every other row goes in `<tbody>`.
- Fields follow RFC 4180: quoted fields may hold commas, line breaks and doubled quotes (`""`); records end with CRLF or LF; a trailing line break does not add an empty row.
- Every cell is escaped before it reaches the page. A cell containing `<script>` is shown as those characters, never run.
- An empty file shows "This file is empty."
- A ragged row (one whose cell count differs from the header) is padded to the widest row, tinted, and counted in the caption.
- A file with more than 5,000 data rows renders the first 5,000 and says how many were left out.
- A file that cannot be read as CSV (a quoted field that never closes, text after a closing quote) reports the line and the reason.

## Install

In Rundock, open Settings, then Packages, and paste this link:

```
https://github.com/liamdarmody/rundock-csv-extension
```

Pin the reference to `v1.0.0`. Rundock reads `rundock.json`, shows you what the package contains before anything is written, and installs the `ui/` directory under its own extensions folder. Rundock does not review packages; read `ui/index.js` before you install it, which is the point of keeping it short.

## What the extension receives, and what it cannot do

The view runs in a sandboxed frame with an opaque origin. After it announces itself as ready, Rundock posts one `init` message carrying the opened file's path and its full text, read-only. That is the whole input.

It cannot:

- reach the network (the frame's Content-Security-Policy is `default-src 'none'`);
- read or write any file, including the one it renders;
- see Rundock's page, socket, conversations or settings;
- load an external script or stylesheet (the host inlines `ui/index.js`, and the styles are inlined from inside it).

The messages it posts to Rundock are exactly the ones the host contract names: `ready` on boot, `resize` with the rendered height, and `error` with a reason when the file cannot be parsed. It never posts `open`.

## Theme

The frame cannot learn which Rundock theme is active, so the table sits on its own light surface (white background, dark text, light grey borders and header) that reads the same under the dark and the light theme. The colors are in the `STYLES` string at the bottom of the library section of `ui/index.js`.

## Layout

```
rundock.json      the manifest: name, version, entry, match
ui/index.js       the whole extension: parser, renderer, browser bootstrap
test/             node --test, no browser, no dependencies
```

`ui/index.js` is UMD-shaped so the parser and the escaper can be required under Node for the tests, while the same file runs as a plain inline script in the frame.

## Develop

```
node --test
```

## License

MIT. See `LICENSE`.
