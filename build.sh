#!/usr/bin/env bash
# Assemble index.html from the source modules in parts/.
# No toolchain, no dependencies — this is the entire build.
set -euo pipefail
cd "$(dirname "$0")"

BODY="parts/02-markup.html parts/03-theory.js parts/04-audio.js parts/05-mic-store.js parts/05b-chords.js parts/06-app.js"

{
  cat parts/00-site-head.html parts/01-head.html
  echo '</head>'
  echo '<body>'
  cat $BODY parts/07-site-tail.html
} > index.html

echo "built index.html — $(wc -l < index.html) lines"
