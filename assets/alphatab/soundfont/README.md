# Soundfont

`generaluser-gs-guitars.sf2` contains only the instruments needed by the guitar sheet music, extracted from
[GeneralUser GS](https://www.schristiancollins.com/generaluser) v2.0.3 by S. Christian Collins
(see `GeneralUser-GS-LICENSE.txt`), from https://github.com/mrbumpy409/GeneralUser-GS :

- bank 0, program 24: Nylon Guitar (MuseScore's "Classical Guitar")
- bank 0, program 25: Steel Guitar (MuseScore's "Acoustic Guitar")
- bank 128, program 0: the "metronome click" (key 33) of the standard drum kit, used by the player's metronome

It was made with `sfsubset.py` (Python 3, no dependencies):

```sh
python3 sfsubset.py GeneralUser-GS.sf2 generaluser-gs-guitars.sf2 0:24 0:25 128:0@33
```

To use another instrument in a score, add its preset (`bank:program`, where the program is the General MIDI
number minus 1, e.g. `0:26` for "Electric Guitar (jazz)") to the command above, and regenerate the file.
