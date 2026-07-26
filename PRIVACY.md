# Privacy

This describes what the code in this repository actually does as of v0.2. It is not
marketing copy. Where the app's schematic diagram (the "Schematic" tab) shows a
planned architecture — Desk-side OAuth into Google Docs / Word Online / ServiceNow —
that is a design goal, not shipped code. This document only covers what runs today.

TAKE is a single HTML page. There is no backend, no account, no analytics, and no
crash reporting anywhere in the code.

## Your voice

TAKE offers two speech engines, picked per-user in the UI:

- **Whisper** (`Xenova/whisper-tiny.en`, run via `@xenova/transformers` in-page):
  transcription happens entirely on your device. Audio is not written to disk and is
  not sent anywhere.
- **Web Speech** (the browser's built-in `SpeechRecognition` API): audio is streamed
  to your browser vendor's speech recognition service to be transcribed — for
  example, Chrome sends it to Google's servers. This is the one place voice data
  leaves the device, and it only happens if you pick this engine. The app's pipeline
  panel labels this engine "online" for exactly this reason.

**Honest caveat:** if you select Web Speech, your dictation audio is processed by a
third party (the browser vendor). If you select Whisper, it isn't. This is a real
tradeoff, not a formality — Web Speech is faster to start and needs no download;
Whisper is private but larger and slower on first load.

## Your transcript and the extracted fields

Turning a transcript into ticket fields (`extractFields` in `index.html`) is plain
deterministic string matching — keyword tables and regular expressions for things
like category, priority, asset tag, time worked, and resolution sentences. There is
no LLM call and no network request involved in extraction, and nothing is invented:
a field that wasn't said stays empty rather than being guessed or filled in. (The
schematic diagram sketches a future on-device extractor model; the code running
today does not use one.)

## What gets stored, and where

- A completed "take" (transcript-derived fields + rendered ticket) is encrypted with
  AES-256-GCM before it is written anywhere. The key is derived from a passphrase you
  choose, using PBKDF2 with 310,000 iterations of SHA-256.
- The passphrase itself is never written to storage and never sent over the network —
  it lives in memory for the current session only.
- The resulting ciphertext is written to your browser's `localStorage` (falling back
  to an in-memory object if `localStorage` is unavailable, e.g. private browsing).
  Nothing is uploaded to a server — there is no server in this build.
- The "Desk" screen reads and decrypts that same local store with the passphrase you
  re-enter. Exporting/importing the sealed blob is the only way data moves between
  devices right now; the "relay" and firm-tenant integrations shown in the schematic
  are not implemented in this repository.
- Clearing your browser's site data for this page removes everything TAKE has
  stored.

## Network requests this page makes

- **Google Fonts** (`fonts.googleapis.com`, `fonts.gstatic.com`): loaded on every
  page view to render the Archivo / IBM Plex Mono typefaces. Google can see the
  requesting IP address for this, as with any font CDN.
- **Whisper model weights**: the first time you use the Whisper engine, the page
  loads `@xenova/transformers` from `cdn.jsdelivr.net` and the
  `Xenova/whisper-tiny.en` model from `huggingface.co`. This is a one-time ~190 MB
  download of code and model weights, not your data; it's cached by the browser
  afterward (`transformers.js`'s own Cache Storage entry, separate from the app
  shell cache in `sw.js`) so it isn't repeated.
- **Web Speech audio**: only if you pick that engine — see above.
- **License purchase link**: the "Get a key" button in the unlock modal opens an
  external storefront URL (`BUY_URL` in `index.html`, e.g. Gumroad/Lemon
  Squeezy/Stripe) in a new tab, only when you click it. That storefront's own
  privacy policy governs what happens there, not this one.

Nothing else calls out over the network. There is no analytics or telemetry script
in this codebase.

## License key checks

Unlocking the app verifies a license key's ECDSA-P256 signature against a public key
embedded in `index.html`, entirely in-browser via WebCrypto. No key or usage data is
sent to any server to check it — it's an offline signature check, not a phone-home
license server. A local counter tracks how many trial takes you've used; that counter
never leaves the device either.

## Clipboard

The "Copy" action puts rendered ticket text on your system clipboard via the
standard `navigator.clipboard` API. Anything else on your device with clipboard
access can read it until it's overwritten — normal OS clipboard behavior, not
specific to this app.
