# alphaTab (self-hosted)

Runtime files for the sheet music player (`/assets/sheetmusic.js`), copied from the
[`@coderline/alphatab`](https://www.npmjs.com/package/@coderline/alphatab) npm package, version **1.8.4**:

- `alphaTab.min.js`         ← `dist/alphaTab.min.js`            (MPL-2.0, see `LICENSE`)
- `font/Bravura.woff2`      ← `dist/font/Bravura.woff2`         (SIL OFL, see `font/Bravura-OFL.txt`)

The soundfont (instrument sounds) is not alphaTab's own one, see `soundfont/README.md`.

They are hosted here rather than loaded from a CDN, because the audio player runs in an
AudioWorklet, which is loaded from the same script file and is most reliable same-origin.

To update: `npm pack @coderline/alphatab@<version>`, extract it, copy the files above,
and update `ALPHATAB_VERSION` in `/assets/sheetmusic.js`.
