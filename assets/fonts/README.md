# Fonts

Self-hosted so that visiting the site sends nothing to a third-party font service (see [data-collection.md](../../docs/data-collection.md)).

| File | Font | Notes |
|---|---|---|
| `newsreader-normal.woff2`, `newsreader-italic.woff2` | Newsreader (variable: weight and optical size) | Latin subset |
| `instrument-sans.woff2` | Instrument Sans (variable: weight) | Latin subset |

Both are licensed under the SIL Open Font License 1.1. The license texts are in this folder (`OFL-Newsreader.txt`, `OFL-InstrumentSans.txt`). The files come from the Fontsource packages `@fontsource-variable/newsreader` and `@fontsource-variable/instrument-sans` (version 5.3.0), which repackage the fonts from Google Fonts.

To change a font, replace the file here and keep the same name, or update the `@font-face` rules at the top of each page's `<style>` block.
