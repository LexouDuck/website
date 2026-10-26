# Lexou Duck's website

This is just a repository to host (and store the code for) for my personal website.

- `/pages`: website content (`.md` markdown files converted to `.html`)
- `/assets`: reoccuring assets
- `/templates`: reoccuring HTML components, using mustache.js

## Sheet music

`/pages/music/guitar` shows interactive sheet music (notation + tablature, with playback), using [alphaTab](https://alphatab.net) (self-hosted in `/assets/alphatab`, player code in `/assets/sheetmusic.js`).
To add a piece: put its `.mscz` file in that folder, run `make sheetmusic` (converts every `.mscz` to `.musicxml` using the MuseScore command-line), and add a `<details class="sheetmusic" ...>` entry to its `index.md`.
