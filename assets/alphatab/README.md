# alphaTab (self-hosted)

Runtime files for the sheet music player (`/assets/sheetmusic.js`), copied from the
[`@coderline/alphatab`](https://www.npmjs.com/package/@coderline/alphatab) npm package, version **1.9.0**:

- `alphaTab.min.js`         ← `dist/alphaTab.min.js`            (MPL-2.0, see `LICENSE`)
- `font/Bravura.woff2`      ← `dist/font/Bravura.woff2`         (SIL OFL, see `font/Bravura-OFL.txt`)

The soundfont (instrument sounds) is not alphaTab's own one, see `soundfont/README.md`.

`alphaTab.min.js` has one local modification (MPL-2.0 allows this, the modified file stays available here):
a rest with an explicit display position (`Beat.restDisplayTone`, set from the MusicXML by `/assets/sheetmusic.js`)
is not moved by the rest collision handling (which would otherwise move rests of the 2nd voice above the 1st voice).
In `BarCollisionHelper.applyRestCollisionOffset`:

```diff
-applyRestCollisionOffset(t,e,s){if(t.voice.index>0){
+applyRestCollisionOffset(t,e,s){if(t.voice.index>0&&isNaN(t.restDisplayTone)){
```

When updating alphaTab, re-apply it (or check whether the new version still needs it).

They are hosted here rather than loaded from a CDN, because the audio player runs in an
AudioWorklet, which is loaded from the same script file and is most reliable same-origin.

To update: `npm pack @coderline/alphatab@<version>`, extract it, copy the files above,
and update `ALPHATAB_VERSION` in `/assets/sheetmusic.js`.
