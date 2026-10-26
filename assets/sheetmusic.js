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
	const ALPHATAB_VERSION = "1.8.4";
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
				soundFont: ALPHATAB_URL + "soundfont/sonivox.sf3",
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
	function mergeLinkedTabStaves(alphaTab, score, settings)
	{
		let merged = 0;
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
				merged++;
			}
		});
		if (merged === 0)
			return score;
		// round-trip through alphaTab's serializer, so that all internal lookups are rebuilt
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
		const pairs = [];
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
					const tabNotes = tv[v][k].notes.slice();
					for (const note of sv[v][k].notes)
					{
						const index = tabNotes.findIndex(function(t) { return t.realValue === note.realValue; });
						if (index < 0)
							return false;
						pairs.push([note, tabNotes.splice(index, 1)[0]]);
					}
				}
			}
		}
		pairs.forEach(function(pair) { pair[0].string = pair[1].string; pair[0].fret = pair[1].fret; });
		return true;
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

		try
		{
			const alphaTab = await loadAlphaTab();
			const settings = makeSettings(alphaTab);
			const response = await fetch(file);
			if (!response.ok)
				throw new Error("Could not download the score (HTTP " + response.status + ").");
			const bytes = new Uint8Array(await response.arrayBuffer());
			let score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes, settings);
			score = mergeLinkedTabStaves(alphaTab, score, settings);

			const api = new alphaTab.AlphaTabApi(container, settings);
			api.sheetmusicToolbar = toolbar;
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
