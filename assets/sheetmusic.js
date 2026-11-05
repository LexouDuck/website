// Interactive sheet music player (standard notation + tablature, with playback)
// Uses alphaTab: https://alphatab.net
//
// Usage, in any page:
//
//	<details class="sheetmusic" data-file="My Song.musicxml" data-mscz="My Song.mscz">
//	<summary><span class="sheetmusic-title">My Song</span> <span class="sheetmusic-info">Composer</span></summary>
//	</details>
//	<link rel="stylesheet" type="text/css" href="/assets/sheetmusic.css">
//	<script type="text/javascript" src="/assets/sheetmusic.js"></script>
//
// Nothing is downloaded (neither alphaTab, nor the score, nor the soundfont)
// until the user expands one of the <details> elements.

(function()
{
	// alphaTab is self-hosted (see /assets/alphatab/README.md)
	const ALPHATAB_VERSION = "1.9.0";
	const ALPHATAB_URL = new URL("/assets/alphatab/", window.location.href).href; // absolute, for web workers

	const players = []; // every alphaTab API instance created on this page

	// load the alphaTab library on demand (only once)
	let alphaTabPromise = null;
	function loadAlphaTab()
	{
		if (window.alphaTab)
			return Promise.resolve(window.alphaTab);
		if (alphaTabPromise === null)
		{
			alphaTabPromise = new Promise(function(resolve, reject)
			{
				const script = document.createElement("script");
				script.src = ALPHATAB_URL + "alphaTab.min.js";
				script.onload = function() { resolve(window.alphaTab); };
				script.onerror = function()
				{
					alphaTabPromise = null;
					reject(new Error("Could not load the alphaTab library."));
				};
				document.head.appendChild(script);
			});
		}
		return alphaTabPromise;
	}

	function makeSettings(alphaTab)
	{
		const settings = new alphaTab.Settings();
		settings.fillFromJson({
			core: {
				engine: "svg",
				scriptFile: ALPHATAB_URL + "alphaTab.min.js",
				fontDirectory: ALPHATAB_URL + "font/",
			},
			display: {
				staveProfile: "ScoreTab", // show both standard notation and tablature
				scale: 0.9,
				resources: {
					mainGlyphColor:      "#EEE8EE",
					secondaryGlyphColor: "rgba(238,232,238,0.6)",
					scoreInfoColor:      "#EEE8EE",
					staffLineColor:      "#8A7A8A",
					barSeparatorColor:   "#8A7A8A",
					barNumberColor:      "#825582",
				},
			},
			player: {
				playerMode: "EnabledAutomatic",
				soundFont: ALPHATAB_URL + "soundfont/generaluser-gs-guitars.sf2",
				scrollElement: document.querySelector("content") || "html,body",
				scrollOffsetY: -100, // updated in updateStickyOffset()
			},
		});
		// the title/composer are already shown in the <summary>, so hide alphaTab's own header
		const E = alphaTab.NotationElement;
		[
			E.ScoreTitle, E.ScoreSubTitle, E.ScoreArtist, E.ScoreAlbum,
			E.ScoreWords, E.ScoreMusic, E.ScoreWordsAndMusic, E.ScoreCopyright,
			E.TrackNames,
		].forEach(function(element) { settings.notation.elements.set(element, false); });
		return settings;
	}

	// MuseScore exports a "standard staff + linked tablature staff" pair as two separate staves,
	// which alphaTab would display separately AND play twice. This function merges each such
	// pair into one staff which shows both notations (string/fret info is copied over).
	// NB: refinishScore() must be called afterwards.
	function mergeLinkedTabStaves(alphaTab, score)
	{
		score.tracks.forEach(function(track)
		{
			for (let i = 0; i + 1 < track.staves.length; i++)
			{
				const std = track.staves[i];
				const tab = track.staves[i + 1];
				if (!(std.showStandardNotation && !std.showTablature && std.tuning.length === 0 &&
					tab.showTablature && tab.tuning.length > 0))
					continue;
				if (!copyFrets(std, tab))
					continue;
				std.stringTuning = tab.stringTuning;
				std.capo = tab.capo;
				std.showTablature = true;
				track.staves.splice(i + 1, 1);
			}
		});
	}

	// After the score model has been modified, it must be "finished" again, so that alphaTab
	// recomputes everything which derives from it (internal lookups, let-ring durations, etc).
	// This is done by round-tripping the score through alphaTab's serializer.
	function refinishScore(alphaTab, score, settings)
	{
		const json = alphaTab.model.JsonConverter.scoreToJsObject(score);
		return alphaTab.model.JsonConverter.jsObjectToScore(json, settings);
	}

	function nonEmptyVoices(bar)
	{
		return bar.voices
			.map(function(voice) { return voice.beats.filter(function(beat) { return !beat.isEmpty; }); })
			.filter(function(beats) { return beats.length > 0 && beats.some(function(beat) { return !beat.isRest; }); });
	}

	function copyFrets(std, tab)
	{
		const pairs = []; // [note, string, fret]
		const mismatches = [];
		if (std.bars.length !== tab.bars.length)
			return false;
		for (let b = 0; b < std.bars.length; b++)
		{
			// voices are paired by order, since MusicXML numbers the 2nd staff's voices 5-8
			const sv = nonEmptyVoices(std.bars[b]);
			const tv = nonEmptyVoices(tab.bars[b]);
			if (sv.length !== tv.length)
				return false;
			for (let v = 0; v < sv.length; v++)
			{
				if (sv[v].length !== tv[v].length)
					return false;
				for (let k = 0; k < sv[v].length; k++)
				{
					// first, pair the notes which have the same pitch on both staves
					const stdNotes = [];
					const tabNotes = tv[v][k].notes.slice();
					sv[v][k].notes.forEach(function(note)
					{
						const index = tabNotes.findIndex(function(t) { return t.realValue === note.realValue; });
						if (index < 0)
							stdNotes.push(note);
						else
						{
							const t = tabNotes.splice(index, 1)[0];
							pairs.push([ note, t.string, t.fret ]);
						}
					});
					if (stdNotes.length === 0)
						continue;
					// the tablature doesn't match the notation (an error in the score, e.g. a tie between
					// two different pitches): pair the remaining notes from lowest to highest, keep the
					// string of the tablature, and compute the fret which plays the pitch of the notation
					if (stdNotes.length !== tabNotes.length)
						return false;
					const byPitch = function(a, b) { return a.realValue - b.realValue; };
					stdNotes.sort(byPitch);
					tabNotes.sort(byPitch);
					for (let i = 0; i < stdNotes.length; i++)
					{
						const openString = tabNotes[i].realValue - tabNotes[i].fret;
						const fret = stdNotes[i].realValue - openString;
						if (fret < 0)
							return false;
						pairs.push([ stdNotes[i], tabNotes[i].string, fret ]);
					}
					mismatches.push(b + 1);
				}
			}
		}
		if (mismatches.length > 0)
			console.warn("[sheetmusic] the tablature does not match the notation in measure(s) " +
				mismatches.filter(function(m, i) { return mismatches.indexOf(m) === i; }).join(", ") +
				": the frets were recomputed from the notation.");
		pairs.forEach(function(pair) { pair[0].string = pair[1]; pair[0].fret = pair[2]; });
		return true;
	}

	// Safety net, for scores where the notation and tablature staves could not be merged:
	// a note played twice at the same time (same pitch, same MIDI channel) is only played once.
	// This edits the MIDI file generated by alphaTab, just before it is loaded into the synthesizer.
	function removeDoubledNotes(alphaTab, midiFile)
	{
		const MidiEventType = alphaTab.midi.MidiEventType;
		midiFile.tracks.forEach(function(midiTrack)
		{
			const events = midiTrack.events;
			const playing = new Map(); // "channel:key" -> note-on events not yet ended
			const removed = new Set();
			const doubled = new Map(); // note-on kept -> the note-off events of its doubles
			events.forEach(function(event)
			{
				const key = event.channel + ":" + event.noteKey;
				if (event.type === MidiEventType.NoteOn)
				{
					const active = playing.get(key) || [];
					const same = active.find(function(other) { return other.tick === event.tick; });
					if (same)
					{
						removed.add(event);
						doubled.set(same, (doubled.get(same) || 0) + 1);
					}
					else
						active.push(event);
					playing.set(key, active);
				}
				else if (event.type === MidiEventType.NoteOff)
				{
					const active = playing.get(key);
					if (!active || active.length === 0)
						return;
					// the first note-offs of a doubled note are dropped, so the longest one is kept
					const first = active[0];
					if (doubled.get(first) > 0)
					{
						doubled.set(first, doubled.get(first) - 1);
						removed.add(event);
					}
					else
						active.shift();
				}
			});
			if (removed.size > 0)
			{
				const kept = events.filter(function(event) { return !removed.has(event); });
				events.length = 0;
				Array.prototype.push.apply(events, kept);
			}
		});
	}

	// A score which starts with a partial measure (a pickup / anacrusis) is not marked as such in the
	// MuseScore MusicXML export, so alphaTab played it as a full measure, with silence after its notes.
	// If the first measure is shorter than its time signature, mark it as an anacrusis, so that the next
	// measure starts right after it.
	// NB: refinishScore() must be called afterwards.
	function detectAnacrusis(score)
	{
		const masterBar = score.masterBars[0];
		if (!masterBar || masterBar.isAnacrusis || score.masterBars.length < 2)
			return;
		let duration = 0;
		score.tracks.forEach(function(track)
		{
			track.staves.forEach(function(staff)
			{
				if (staff.bars.length > 0)
					duration = Math.max(duration, staff.bars[0].calculateDuration());
			});
		});
		if (duration > 0 && duration < masterBar.calculateDuration(false))
			masterBar.isAnacrusis = true;
	}

	// MuseScore exports the staccato of a chord on only one of its notes, so alphaTab played only that
	// note staccato and let the others ring: the staccato of any note of a chord applies to the whole chord.
	function applyChordStaccato(score)
	{
		score.tracks.forEach(function(track)
		{
			track.staves.forEach(function(staff)
			{
				staff.bars.forEach(function(bar)
				{
					bar.voices.forEach(function(voice)
					{
						voice.beats.forEach(function(beat)
						{
							if (beat.notes.some(function(note) { return note.isStaccato; }))
								beat.notes.forEach(function(note) { note.isStaccato = true; });
						});
					});
				});
			});
		});
	}

	// Time between two successive notes of an arpeggio (and the maximum fraction
	// of the chord's duration that the whole arpeggio may take up).
	const ARPEGGIO_NOTE_GAP_MS = 45;
	const ARPEGGIO_MAX_SPREAD = 0.5;

	// alphaTab's MusicXML importer reads <arpeggiate direction="..."> backwards: it follows
	// the Guitar Pro convention, where a "down" arpeggio is a down-stroke (low string first,
	// so the pitch goes UP), but maps MusicXML's direction="up" (pitch goes up) onto it.
	// So, before importing, swap "up" and "down" (a plain arpeggio with no direction,
	// which alphaTab treats as "down", correctly ends up being played upwards).
	function fixArpeggioDirections(bytes)
	{
		const xml = new TextDecoder("utf-8").decode(bytes);
		if (xml.indexOf("<arpeggiate") < 0)
			return bytes;
		const fixed = xml.replace(/<arpeggiate\b[^>]*>/g, function(tag)
		{
			return tag.replace(/direction="(up|down)"/, function(_, direction)
			{
				return 'direction="' + (direction === "up" ? "down" : "up") + '"';
			});
		});
		return new TextEncoder().encode(fixed);
	}

	// alphaTab's MusicXML importer does not give arpeggios any duration, so all their
	// notes would sound at once: spread the notes out, by a fixed amount of time per note.
	function setArpeggioDurations(alphaTab, score)
	{
		const BrushType = alphaTab.model.BrushType;
		const quarter = 960; // MIDI ticks per quarter note, in alphaTab
		let tempo = score.tempo;
		score.masterBars.forEach(function(masterBar)
		{
			if (masterBar.tempoAutomations && masterBar.tempoAutomations.length > 0)
				tempo = masterBar.tempoAutomations[0].value;
			const ticksPerMs = quarter * tempo / 60000;
			score.tracks.forEach(function(track)
			{
				track.staves.forEach(function(staff)
				{
					staff.bars[masterBar.index].voices.forEach(function(voice)
					{
						voice.beats.forEach(function(beat)
						{
							if (beat.brushType !== BrushType.ArpeggioUp &&
								beat.brushType !== BrushType.ArpeggioDown)
								return;
							if (beat.brushDuration > 0 || beat.notes.length < 2)
								return;
							const spread = (beat.notes.length - 1) * ARPEGGIO_NOTE_GAP_MS * ticksPerMs;
							beat.brushDuration = Math.round(Math.min(spread, beat.playbackDuration * ARPEGGIO_MAX_SPREAD));
						});
					});
				});
			});
		});
	}

	// parses the (uncompressed) MusicXML file, so that information which alphaTab ignores can be read
	function parseMusicXml(bytes)
	{
		try
		{
			const doc = new DOMParser().parseFromString(new TextDecoder("utf-8").decode(bytes), "application/xml");
			if (doc.getElementsByTagName("parsererror").length > 0 || !doc.querySelector("score-partwise"))
				return null;
			return doc;
		}
		catch (error) { return null; }
	}

	function childNumber(element, name)
	{
		const child = element.querySelector(":scope > " + name);
		return child ? parseFloat(child.textContent) || 0 : 0;
	}

	// Calls `callback(element, measureIndex, position)` for every element inside every <measure> of
	// the given <part>, where `position` is the time since the start of the measure, in quarter notes.
	function forEachMeasureElement(part, callback)
	{
		let divisions = 1;
		Array.from(part.children)
			.filter(function(element) { return element.localName === "measure"; })
			.forEach(function(measure, index)
			{
				let position = 0;
				Array.from(measure.children).forEach(function(element)
				{
					if (element.localName === "attributes" && element.querySelector(":scope > divisions"))
						divisions = childNumber(element, "divisions") || 1;
					callback(element, index, position + childNumber(element, "offset") / divisions);
					switch (element.localName)
					{
						case "note":
							if (!element.querySelector(":scope > grace") && !element.querySelector(":scope > chord"))
								position += childNumber(element, "duration") / divisions;
							break;
						case "backup":  position -= childNumber(element, "duration") / divisions; break;
						case "forward": position += childNumber(element, "duration") / divisions; break;
					}
				});
			});
	}

	// alphaTab doesn't read the vertical position of rests from MusicXML (<display-step>/<display-octave>,
	// which MuseScore exports for rests that were moved), and in measures with several voices it places
	// rests in the middle of the staff, or moves the rests of the 2nd voice *above* the notes.
	// This sets the position of each rest of the notation staff (alphaTab >= 1.9 can display it):
	// - rests with a position in the MusicXML are displayed there
	// - other rests, in measures with several voices: the 1st voice's above, the 2nd voice's below
	// NB: refinishScore() must be called afterwards.
	function applyRestPositions(alphaTab, score, xml)
	{
		const quarter = 960; // MIDI ticks per quarter note, in alphaTab
		const TONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
		const STEPS = [ 0, 2, 4, 5, 7, 9, 11 ]; // diatonic step -> tone
		const Clef = alphaTab.model.Clef;
		const Ottavia = alphaTab.model.Ottavia;
		// the (written) diatonic step of the middle line of the staff, for each clef (octave * 7 + step)
		const MIDDLE_LINE = {};
		MIDDLE_LINE[Clef.G2] = 4 * 7 + 6; // B4
		MIDDLE_LINE[Clef.F4] = 3 * 7 + 1; // D3
		MIDDLE_LINE[Clef.C3] = 4 * 7 + 0; // C4
		MIDDLE_LINE[Clef.C4] = 3 * 7 + 5; // A3
		// alphaTab expects the sounding pitch: the octave of the written pitch, corrected for octave clefs
		const OCTAVE_SHIFT = {};
		OCTAVE_SHIFT[Ottavia._15ma] = 2;
		OCTAVE_SHIFT[Ottavia._8va] = 1;
		OCTAVE_SHIFT[Ottavia._8vb] = -1;
		OCTAVE_SHIFT[Ottavia._15mb] = -2;

		xml.querySelectorAll("score-partwise > part").forEach(function(part, partIndex)
		{
			const track = score.tracks[partIndex];
			if (!track || track.staves.length === 0)
				return;
			const staff = track.staves[0];
			// alphaTab numbers the voices of a staff by order of their MusicXML voice numbers
			const rests = [];
			const voices = [];
			forEachMeasureElement(part, function(element, measureIndex, position)
			{
				if (element.localName !== "note")
					return;
				const staffNumber = element.querySelector(":scope > staff");
				if (staffNumber && staffNumber.textContent.trim() !== "1")
					return;
				const voiceElement = element.querySelector(":scope > voice");
				const voice = voiceElement ? voiceElement.textContent.trim() : "1";
				if (voices.indexOf(voice) < 0)
					voices.push(voice);
				const rest = element.querySelector(":scope > rest");
				if (!rest || element.querySelector(":scope > chord"))
					return;
				const step = rest.querySelector("display-step");
				const octave = rest.querySelector("display-octave");
				if (step && octave)
					rests.push({ measure: measureIndex, voice: voice, tick: Math.round(position * quarter),
						tone: TONES[step.textContent.trim()], octave: parseInt(octave.textContent, 10) });
			});
			voices.sort(function(a, b) { return parseInt(a, 10) - parseInt(b, 10); });

			// rests with a position in the MusicXML
			const positioned = new Set();
			rests.forEach(function(rest)
			{
				const bar = staff.bars[rest.measure];
				const voice = bar ? bar.voices[voices.indexOf(rest.voice)] : null;
				const beat = voice ? voice.beats.find(function(b) { return b.isRest && b.displayStart === rest.tick; }) : null;
				if (!beat || rest.tone === undefined || Number.isNaN(rest.octave))
					return;
				beat.restDisplayTone = rest.tone;
				beat.restDisplayOctave = rest.octave;
				positioned.add(beat);
			});

			// other rests, in measures with several voices: above / below the middle line, like MuseScore does
			staff.bars.forEach(function(bar)
			{
				if (!bar.isMultiVoice || !(bar.clef in MIDDLE_LINE))
					return;
				bar.voices.forEach(function(voice)
				{
					if (voice.index > 1)
						return;
					const step = MIDDLE_LINE[bar.clef] + (voice.index === 0 ? 2 : -4);
					voice.beats.forEach(function(beat)
					{
						if (!beat.isRest || beat.isEmpty || positioned.has(beat))
							return;
						beat.restDisplayTone = STEPS[step % 7];
						beat.restDisplayOctave = Math.floor(step / 7) + (OCTAVE_SHIFT[bar.clefOttava] || 0);
					});
				});
			});
		});
	}

	const LET_RING_TEXT = /^\s*let[\s-]*ring\s*$/i;

	// alphaTab's MusicXML importer only understands "let ring" when it is written like Guitar Pro's
	// export ("LetRing" followed by <dashes>), but MuseScore exports it as "let ring" with a <bracket>,
	// so it was only displayed as text, and not played. This finds the let-ring ranges in the
	// MusicXML, and sets alphaTab's let-ring effect on all notes within those ranges.
	// Returns the let-ring ranges found, for fixLetRingRests().
	// NB: refinishScore() must be called afterwards.
	function applyLetRing(alphaTab, score, xml)
	{
		const quarter = 960; // MIDI ticks per quarter note, in alphaTab
		const rangesByTrack = [];
		xml.querySelectorAll("score-partwise > part").forEach(function(part, partIndex)
		{
			const track = score.tracks[partIndex];
			if (!track)
				return;
			const ranges = []; // [start, end) in MIDI ticks
			const open = {}; // line number -> start tick, for let-ring lines which have not ended yet
			forEachMeasureElement(part, function(element, measureIndex, position)
			{
				const masterBar = score.masterBars[measureIndex];
				if (element.localName !== "direction" || !masterBar)
					return;
				const tick = masterBar.start + Math.round(position * quarter);
				const isLetRing = Array.from(element.querySelectorAll("direction-type > words"))
					.some(function(words) { return LET_RING_TEXT.test(words.textContent); });
				const lines = element.querySelectorAll("direction-type > bracket, direction-type > dashes");
				lines.forEach(function(line)
				{
					const number = line.getAttribute("number") || "1";
					const type = line.getAttribute("type");
					if (type === "start" && isLetRing)
						open[number] = tick;
					else if (type === "stop" && number in open)
					{
						ranges.push([ open[number], tick ]);
						delete open[number];
					}
				});
				// "let ring" text without a line: let ring until the end of the measure
				if (isLetRing && lines.length === 0)
					ranges.push([ tick, masterBar.start + masterBar.calculateDuration() ]);
			});
			Object.keys(open).forEach(function(number) { ranges.push([ open[number], Infinity ]); });
			rangesByTrack[partIndex] = ranges;

			track.staves.forEach(function(staff)
			{
				staff.bars.forEach(function(bar)
				{
					bar.voices.forEach(function(voice)
					{
						voice.beats.forEach(function(beat)
						{
							// alphaTab displays its own "let ring" line, so remove the plain text
							if (beat.text && LET_RING_TEXT.test(beat.text))
								beat.text = null;
							if (isInRanges(ranges, beat.absolutePlaybackStart))
								beat.notes.forEach(function(note) { note.isLetRing = true; });
						});
					});
				});
			});
		});
		return rangesByTrack;
	}

	function isInRanges(ranges, tick)
	{
		return ranges.some(function(range) { return tick >= range[0] && tick < range[1]; });
	}

	// alphaTab extends the let-ring effect over rests which are followed by more let-ring notes,
	// which joins separate let-ring lines into one: remove it from rests outside of let-ring ranges.
	// (This only changes the display: rests always stop the let-ring effect during playback.)
	// NB: must be called after refinishScore().
	function fixLetRingRests(score, rangesByTrack)
	{
		score.tracks.forEach(function(track, trackIndex)
		{
			const ranges = rangesByTrack[trackIndex] || [];
			track.staves.forEach(function(staff)
			{
				staff.bars.forEach(function(bar)
				{
					bar.voices.forEach(function(voice)
					{
						voice.beats.forEach(function(beat)
						{
							if (beat.isRest && beat.isLetRing && !isInRanges(ranges, beat.absolutePlaybackStart))
								beat.isLetRing = false;
						});
					});
				});
			});
		});
	}

	// alphaTab's MusicXML importer ignores a <swing> written inside a <direction> (which is how
	// MuseScore exports it), and only supports a few swing ratios (2:1, 3:1 and 1:3). So instead, this
	// reads the <swing> (and <straight/>) markings from the MusicXML, and applies them to every following bar,
	// with any ratio: in each beat, the off-beat note is moved to `first / (first + second)` of
	// the beat, and the timing of the notes in between is stretched to match (tuplets are left as-is).
	// Let-ring ranges (from applyLetRing) are shifted in the same way.
	// NB: must be called after refinishScore().
	function applySwing(alphaTab, score, xml, letRingRanges)
	{
		const part = xml.querySelector("score-partwise > part");
		if (!part || !xml.querySelector("swing"))
			return;
		const quarter = 960; // MIDI ticks per quarter note, in alphaTab
		// find the swing changes, by measure
		const changes = {};
		forEachMeasureElement(part, function(element, measureIndex)
		{
			if (element.localName !== "sound" && element.localName !== "direction")
				return;
			element.querySelectorAll("swing").forEach(function(swing)
			{
				if (swing.querySelector("straight"))
				{
					changes[measureIndex] = null;
					return;
				}
				const first = childNumber(swing, "first");
				const second = childNumber(swing, "second");
				const type = swing.querySelector("swing-type");
				if (first > 0 && second > 0)
					changes[measureIndex] = {
						ratio: first / (first + second),
						beat: (type && type.textContent.trim() === "16th") ? quarter / 2 : quarter,
					};
			});
		});
		// the swing which applies to each bar
		const swingByBar = [];
		let swing = null;
		score.masterBars.forEach(function(masterBar, index)
		{
			if (index in changes)
				swing = changes[index];
			swingByBar[index] = swing;
			masterBar.tripletFeel = alphaTab.model.TripletFeel.NoTripletFeel; // replaced by the code below
		});

		function swingTick(tick, swing) // `tick` is relative to the start of the bar
		{
			const half = swing.beat / 2;
			const beatStart = Math.floor(tick / swing.beat) * swing.beat;
			const x = tick - beatStart;
			return Math.round(beatStart + ((x <= half)
				? x / half * swing.ratio * swing.beat
				: swing.ratio * swing.beat + (x - half) / half * (1 - swing.ratio) * swing.beat));
		}

		score.tracks.forEach(function(track)
		{
			track.staves.forEach(function(staff)
			{
				staff.bars.forEach(function(bar)
				{
					const swing = swingByBar[bar.index];
					if (!swing)
						return;
					bar.voices.forEach(function(voice)
					{
						voice.beats.forEach(function(beat)
						{
							if (beat.hasTuplet)
								return;
							const start = swingTick(beat.playbackStart, swing);
							const end = swingTick(beat.playbackStart + beat.playbackDuration, swing);
							beat.playbackStart = start;
							beat.playbackDuration = end - start;
						});
					});
				});
			});
		});

		(letRingRanges || []).forEach(function(ranges)
		{
			(ranges || []).forEach(function(range)
			{
				for (let i = 0; i < 2; i++)
				{
					const masterBar = score.masterBars.find(function(masterBar)
					{
						return range[i] >= masterBar.start && range[i] < masterBar.start + masterBar.calculateDuration();
					});
					if (masterBar && swingByBar[masterBar.index])
						range[i] = masterBar.start + swingTick(range[i] - masterBar.start, swingByBar[masterBar.index]);
				}
			});
		});
	}

	// How much a note with a fermata is lengthened during playback (2 = held twice as long)
	const FERMATA_STRETCH = 2;

	// alphaTab displays fermatas, but doesn't play them. This slows down the tempo (with hidden tempo
	// changes) while a note/rest with a fermata is played, so that it is held FERMATA_STRETCH times longer.
	// NB: must be called after refinishScore() (and after applySwing(), which can move the notes).
	function applyFermatas(alphaTab, score)
	{
		const AutomationType = alphaTab.model.AutomationType;
		const byPosition = function(a, b) { return a.ratioPosition - b.ratioPosition; };
		// the tempo at the start of each bar, and the tempo changes within each bar (before any change here)
		const original = [];
		let tempo = score.tempo;
		score.masterBars.forEach(function(masterBar)
		{
			const changes = masterBar.tempoAutomations
				.filter(function(a) { return a.type === AutomationType.Tempo; })
				.sort(byPosition)
				.map(function(a) { return { ratio: a.ratioPosition, value: a.value }; });
			original.push({ start: tempo, changes: changes });
			if (changes.length > 0)
				tempo = changes[changes.length - 1].value;
		});
		function tempoAt(barIndex, ratio)
		{
			let value = original[barIndex].start;
			original[barIndex].changes.forEach(function(change) { if (change.ratio <= ratio) value = change.value; });
			return value;
		}
		// the fermatas of each bar: position -> duration (the longest beat with a fermata at that position)
		const added = score.masterBars.map(function() { return []; });
		score.masterBars.forEach(function(masterBar, barIndex)
		{
			const fermatas = new Map();
			score.tracks.forEach(function(track)
			{
				track.staves.forEach(function(staff)
				{
					const bar = staff.bars[barIndex];
					(bar ? bar.voices : []).forEach(function(voice)
					{
						voice.beats.forEach(function(beat)
						{
							if (beat.fermata && !beat.isEmpty)
								fermatas.set(beat.playbackStart, Math.max(fermatas.get(beat.playbackStart) || 0, beat.playbackDuration));
						});
					});
				});
			});
			const barDuration = masterBar.calculateDuration();
			fermatas.forEach(function(duration, start)
			{
				const startRatio = start / barDuration;
				added[barIndex].push({ ratio: startRatio, value: tempoAt(barIndex, startRatio) / FERMATA_STRETCH, fermata: true });
				// back to the normal tempo when the fermata ends (possibly at the start of the next bar)
				let endBar = barIndex;
				let endRatio = (start + duration) / barDuration;
				if (endRatio >= 1)
				{
					endBar = barIndex + 1;
					endRatio = 0;
				}
				if (endBar < score.masterBars.length)
					added[endBar].push({ ratio: endRatio, value: tempoAt(endBar, endRatio), fermata: false });
			});
		});
		// add the tempo changes, sorted by position: at a same position, a fermata wins over the end of another
		score.masterBars.forEach(function(masterBar, barIndex)
		{
			const changes = added[barIndex];
			if (changes.length === 0)
				return;
			changes.forEach(function(change)
			{
				const same = changes.some(function(other) { return other.ratio === change.ratio && other.fermata && !change.fermata; });
				const existing = original[barIndex].changes.some(function(other) { return other.ratio === change.ratio; });
				if (same || (existing && !change.fermata))
					return;
				const automation = new alphaTab.model.Automation();
				automation.type = AutomationType.Tempo;
				automation.value = change.value;
				automation.ratioPosition = change.ratio;
				automation.isLinear = false;
				automation.isVisible = false;
				// after any existing tempo change at the same position, so that it takes precedence
				let index = masterBar.tempoAutomations.length;
				while (index > 0 && masterBar.tempoAutomations[index - 1].ratioPosition > change.ratio)
					index--;
				masterBar.tempoAutomations.splice(index, 0, automation);
			});
		});
	}

	// alphaTab's own let-ring playback stops a note at the next rest, and after at most one bar.
	// Instead, make each let-ring note ring until either its string is played again, or the
	// let-ring line ends (like a guitarist would): this edits the MIDI file generated by alphaTab,
	// just before it is loaded into the synthesizer (see the `midiLoad` event).
	function extendLetRingNotes(alphaTab, api, midiFile, rangesByTrack)
	{
		const MidiEventType = alphaTab.midi.MidiEventType;
		const lookup = api.tickCache;
		const score = api.score;
		if (!lookup || !score || !rangesByTrack.some(function(ranges) { return ranges && ranges.length > 0; }))
			return;
		const shift = midiFile.tickShift || 0;
		midiFile.tracks.forEach(function(midiTrack)
		{
			const events = midiTrack.events;
			if (events.length === 0)
				return;
			// 1. find the score note which corresponds to each MIDI note
			const notes = [];
			const waitingForOff = new Map();
			let barIndex = 0;
			events.forEach(function(event)
			{
				const key = event.channel * 128 + event.noteKey;
				if (event.type === MidiEventType.NoteOn)
				{
					const tick = event.tick - shift;
					while (barIndex + 1 < lookup.masterBars.length && lookup.masterBars[barIndex + 1].start <= tick)
						barIndex++;
					const barLookup = lookup.masterBars[barIndex];
					const entry = {
						on: event,
						off: null,
						note: barLookup ? findNote(score, event.track, barLookup.masterBar, tick - barLookup.start, event.noteKey) : null,
					};
					notes.push(entry);
					if (!waitingForOff.has(key))
						waitingForOff.set(key, []);
					waitingForOff.get(key).push(entry);
				}
				else if (event.type === MidiEventType.NoteOff)
				{
					const waiting = waitingForOff.get(key);
					if (waiting && waiting.length > 0)
						waiting.shift().off = event;
				}
			});
			const lastTick = events[events.length - 1].tick;
			// 2. make let-ring notes ring until the end of their let-ring range, or until
			//    the next note on the same string (or with the same pitch, as MIDI can't overlap those)
			let changed = false;
			notes.forEach(function(entry, i)
			{
				const note = entry.note;
				// staccato takes precedence over let-ring (as in alphaTab's own playback)
				if (!note || !note.isLetRing || note.isStaccato || !entry.off)
					return;
				const scoreTick = note.beat.absolutePlaybackStart;
				const range = (rangesByTrack[entry.on.track] || []).find(function(range)
				{
					return scoreTick >= range[0] && scoreTick < range[1];
				});
				if (!range)
					return;
				let end = (range[1] === Infinity) ? lastTick : entry.on.tick + (range[1] - scoreTick);
				for (let j = i + 1; j < notes.length && notes[j].on.tick < end; j++)
				{
					const other = notes[j];
					if (other.on.track !== entry.on.track)
						continue;
					const sameString = other.note && note.isStringed && other.note.string === note.string &&
						other.note.beat.voice.bar.staff.index === note.beat.voice.bar.staff.index;
					const samePitch = other.on.noteKey === entry.on.noteKey && other.on.channel === entry.on.channel;
					if (sameString || samePitch)
					{
						end = other.on.tick;
						break;
					}
				}
				// never shorten a note below its written length (nor a tied note at all)
				const writtenEnd = entry.on.tick + note.beat.playbackDuration;
				end = note.isTieOrigin ? Math.max(end, entry.off.tick) : Math.max(end, writtenEnd);
				if (entry.off.tick !== end)
				{
					entry.off.tick = end;
					changed = true;
				}
			});
			// 3. keep the events sorted by time (stable sort, so that same-tick ordering is kept)
			if (changed)
			{
				const sorted = events.map(function(event, index) { return [ event, index ]; })
					.sort(function(a, b) { return (a[0].tick - b[0].tick) || (a[1] - b[1]); })
					.map(function(pair) { return pair[0]; });
				events.length = 0;
				Array.prototype.push.apply(events, sorted);
			}
		});
	}

	// finds the note of the score which was played at the given time (relative to the start of
	// the given bar, in MIDI ticks) with the given MIDI key, in the given track
	function findNote(score, trackIndex, masterBar, tick, key)
	{
		const track = score.tracks[trackIndex];
		if (!track)
			return null;
		for (const staff of track.staves)
		{
			for (const voice of staff.bars[masterBar.index].voices)
			{
				for (const beat of voice.beats)
				{
					// notes of an arpeggio start a bit after their beat
					if (tick < beat.playbackStart - 1 || tick > beat.playbackStart + beat.brushDuration + 1)
						continue;
					for (const note of beat.notes)
					{
						if (note.calculateRealValue(false, true) === key)
							return note;
					}
				}
			}
		}
		return null;
	}

	// alphaTab labels the let-ring line "LetRing" (as in Guitar Pro): show "let ring" instead,
	// like MuseScore does. The score is rendered in parts, so this watches for new SVG elements.
	function relabelLetRing(container)
	{
		function relabel()
		{
			container.querySelectorAll("text").forEach(function(text)
			{
				if (text.textContent === "LetRing")
					text.textContent = "let ring";
			});
		}
		new MutationObserver(relabel).observe(container, { childList: true, subtree: true });
	}

	function formatTime(ms)
	{
		const s = Math.max(0, Math.floor(ms / 1000));
		return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
	}

	function el(tag, attributes, children)
	{
		const element = document.createElement(tag);
		Object.keys(attributes || {}).forEach(function(key)
		{
			if (key === "text") element.textContent = attributes[key];
			else element.setAttribute(key, attributes[key]);
		});
		(children || []).forEach(function(child) { element.appendChild(child); });
		return element;
	}

	// builds the player UI inside the given <details> element, and loads the score
	async function createPlayer(details)
	{
		const file = details.dataset.file;
		const mscz = details.dataset.mscz;

		const btnPlay  = el("button", { type: "button", class: "sheetmusic-play",  title: "Play / Pause", disabled: "", text: "▶" });
		const btnStop  = el("button", { type: "button", class: "sheetmusic-stop",  title: "Stop",         disabled: "", text: "■" });
		const time     = el("span",   { class: "sheetmusic-time", text: "0:00 / 0:00" });
		const speed    = el("select", { class: "sheetmusic-speed", title: "Playback speed" },
			[0.25, 0.5, 0.75, 1, 1.25].map(function(x)
			{
				const option = el("option", { value: String(x), text: (x * 100) + "%" });
				if (x === 1) option.selected = true;
				return option;
			}));
		const metronome = el("input", { type: "checkbox" });
		const loop      = el("input", { type: "checkbox" });
		const status    = el("span", { class: "sheetmusic-status", text: "Loading…" });
		const links     = el("span", { class: "sheetmusic-links" });
		links.appendChild(el("a", { href: file, download: "", text: "MusicXML" }));
		if (mscz)
		{
			links.appendChild(document.createTextNode(" · "));
			links.appendChild(el("a", { href: mscz, download: "", text: "MuseScore" }));
		}
		const toolbar = el("div", { class: "sheetmusic-toolbar" }, [
			btnPlay, btnStop, time,
			el("label", { title: "Playback speed" }, [ document.createTextNode("Speed "), speed ]),
			el("label", {}, [ metronome, document.createTextNode(" Metronome") ]),
			el("label", {}, [ loop,      document.createTextNode(" Loop") ]),
			status,
			links,
		]);
		const container = el("div", { class: "sheetmusic-score" });
		details.appendChild(toolbar);
		details.appendChild(container);
		relabelLetRing(container);

		try
		{
			const alphaTab = await loadAlphaTab();
			const settings = makeSettings(alphaTab);
			const response = await fetch(file);
			if (!response.ok)
				throw new Error("Could not download the score (HTTP " + response.status + ").");
			const bytes = fixArpeggioDirections(new Uint8Array(await response.arrayBuffer()));
			const xml = parseMusicXml(bytes);
			let score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes, settings);
			mergeLinkedTabStaves(alphaTab, score);
			detectAnacrusis(score);
			if (xml)
				applyRestPositions(alphaTab, score, xml);
			applyChordStaccato(score);
			setArpeggioDurations(alphaTab, score);
			const letRingRanges = xml ? applyLetRing(alphaTab, score, xml) : [];
			score = refinishScore(alphaTab, score, settings);
			fixLetRingRests(score, letRingRanges);
			if (xml)
				applySwing(alphaTab, score, xml, letRingRanges);
			applyFermatas(alphaTab, score);

			const api = new alphaTab.AlphaTabApi(container, settings);
			api.sheetmusicToolbar = toolbar;
			api.midiLoad.on(function(midiFile)
			{
				removeDoubledNotes(alphaTab, midiFile);
				extendLetRingNotes(alphaTab, api, midiFile, letRingRanges);
			});
			players.push(api);
			details._alphaTab = api;
			updateStickyOffset();

			status.textContent = "Rendering…";
			api.renderFinished.on(function()
			{
				if (!api.isReadyForPlayback)
					status.textContent = "Loading sounds…";
			});
			api.soundFontLoad.on(function(e)
			{
				if (e.total > 0)
					status.textContent = "Loading sounds… " + Math.floor(100 * e.loaded / e.total) + "%";
			});
			api.playerReady.on(function()
			{
				status.textContent = "";
				btnPlay.disabled = false;
				btnStop.disabled = false;
			});
			api.playerStateChanged.on(function(e)
			{
				const playing = (e.state === alphaTab.synth.PlayerState.Playing);
				btnPlay.textContent = playing ? "❚❚" : "▶";
				details.classList.toggle("playing", playing);
				if (playing) // only one score plays at a time
					players.forEach(function(other) { if (other !== api) other.pause(); });
			});
			let lastSecond = -1;
			api.playerPositionChanged.on(function(e)
			{
				const second = Math.floor(e.currentTime / 1000);
				if (second === lastSecond) return;
				lastSecond = second;
				time.textContent = formatTime(e.currentTime) + " / " + formatTime(e.endTime);
			});
			api.error.on(function(e)
			{
				status.textContent = "Error: " + (e && e.message ? e.message : e);
			});

			btnPlay.addEventListener("click", function() { api.playPause(); });
			btnStop.addEventListener("click", function() { api.stop(); });
			speed.addEventListener("change", function() { api.playbackSpeed = parseFloat(speed.value); });
			metronome.addEventListener("change", function() { api.metronomeVolume = metronome.checked ? 1 : 0; });
			loop.addEventListener("change", function() { api.isLooping = loop.checked; });

			api.renderScore(score);
		}
		catch (error)
		{
			console.error(error);
			status.textContent = "Error: " + error.message;
		}
	}

	// on mobile, the site's navbar is a fixed bar at the top of the screen:
	// make the sticky player toolbar sit just below it, instead of hidden behind it
	function updateStickyOffset()
	{
		let top = 0;
		const navbar = document.getElementById("template_navbar");
		if (navbar && getComputedStyle(navbar).position === "fixed")
		{
			const rect = navbar.getBoundingClientRect();
			if (rect.top <= 0 && rect.width > window.innerWidth / 2)
				top = Math.round(rect.bottom);
		}
		document.documentElement.style.setProperty("--sheetmusic-sticky-top", top + "px");
		// make auto-scrolling keep the playing line visible below the navbar + toolbar
		players.forEach(function(api)
		{
			const offset = -(top + api.sheetmusicToolbar.offsetHeight + 30);
			if (api.settings.player.scrollOffsetY !== offset)
			{
				api.settings.player.scrollOffsetY = offset;
				api.updateSettings();
			}
		});
	}

	function init()
	{
		window.addEventListener("resize", updateStickyOffset);
		document.querySelectorAll("details.sheetmusic").forEach(function(details)
		{
			details.addEventListener("toggle", function()
			{
				if (details.open)
					updateStickyOffset();
				if (details.open && !details._sheetmusicStarted)
				{
					details._sheetmusicStarted = true;
					createPlayer(details);
				}
				else if (!details.open && details._alphaTab)
				{
					details._alphaTab.pause();
				}
			});
		});
	}

	if (document.readyState === "loading")
		document.addEventListener("DOMContentLoaded", init);
	else init();
})();
