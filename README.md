# Woodshed

A guitar practice coach. It asks how long you have, builds the session for you, and
teaches the modes with a fretboard, a metronome and a backing band.

Open it here: **https://delegelata.github.io/woodshed/**
On a phone: Chrome menu → *Add to Home screen* / *Install app*.

## What it does

- **Set your time.** Big +/− buttons, five-minute steps, 5 to 90.
- **It builds the session.** Five different session shapes so it never gets stale —
  warmup, technique, mode of the day, rhythm, improv, theory, and a song to finish on.
- **A curriculum that moves.** Modes in order of usefulness (Dorian first, Locrian last),
  guitar-friendly keys first. Three keys clean and a mode counts as learned.
- **The fretboard.** Three-notes-per-string shapes in any key, degrees or note names,
  and a guide mode that lights the next note in time with the click.
- **Metronome.** Downbeat accent, time signatures, tap tempo, count-in, and a speed
  trainer that climbs as you go.
- **A backing band.** Four grooves, bass and chord comping, modal vamps, 12-bar blues
  in any key, or type your own chord chart.
- **It listens.** Tuner, pitch detection scoring your runs against the shape and the
  beat, and recording so you can hear yourself back.
- **Streak tracking.** Any-length session counts. Rest days don't break it.

## Your data

Everything stays in your browser on your device. Nothing is uploaded, there are no
accounts and no analytics. Settings → Export backup copies it out as text if you want
to keep a copy or move to another phone.

## Source layout

The app is one self-contained HTML file with no build dependencies and no runtime
libraries. It's assembled from modules in `parts/` by `build.sh`:

| file | what's in it |
|---|---|
| `parts/01-head.html` | design tokens and all styling |
| `parts/02-markup.html` | every screen's markup |
| `parts/03-theory.js` | modes, 3-notes-per-string shapes, chords, progressions, fretboard SVG |
| `parts/04-audio.js` | Web Audio scheduler, metronome, drum kit, backing band |
| `parts/05-mic-store.js` | pitch detection, recording, on-device storage |
| `parts/06-app.js` | session generator, block runner, screens |

`build.sh` produces two targets from the same source: this site, and a Claude artifact
build. The audio and storage layers are deliberately isolated — porting to a native app
means replacing those two files and nothing else.

## Notes

- Drums are synthesised with Web Audio rather than sampled. Swapping in real samples is
  a change to `parts/04-audio.js` alone.
- The metronome click sits above 2 kHz on purpose and the microphone input is low-passed
  at 1 kHz, so the click can't contaminate pitch detection no matter how you're listening.
