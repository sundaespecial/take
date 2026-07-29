# Privacy

This describes what the code in this repository actually does. It is not marketing
copy. Where the app's schematic diagram (visible with `?debug=1`) sketches a planned
architecture — a relay service, an on-device LLM extractor — that is a design goal,
not shipped code, and is labeled "planned" there. This document only covers what
runs today.

SAY SO is a single HTML page. There is no backend, no account, no analytics, and no
crash reporting anywhere in the code.

## Your voice

Whisper (`Xenova/whisper-base.en`, run via `@xenova/transformers` in-page) is the
only speech engine. Transcription happens entirely on your device — audio is never
written to disk and never sent anywhere, over any network. It also never persists
across a reload: if you close the tab or the OS kills a backgrounded page mid-
transcription, that audio is gone, by design (see "What gets stored" below).

The one exception is deliberate and in your hands: if a transcription attempt fails
(model load error, decode failure), the already-captured audio is kept in memory so
you can retry without re-recording — but only until you leave the page or the retry
succeeds.

## Your transcript and the extracted fields

Turning a transcript into ticket fields (`extractFields` in `index.html`) is plain
deterministic string matching — keyword tables and regular expressions for things
like category, priority, asset tag, time worked, and resolution sentences. There is
no LLM call and no network request involved in extraction, and nothing is invented:
a field that wasn't said stays empty rather than being guessed or filled in.

The rendered ticket text works the same way: the narrative "house style" sentence
template only fills in phrases the extractor actually pulled from your transcript.
If a required fact (requester, what happened, what was done) wasn't said, SAY SO does
not force the wording — it shows the structured field view instead, where anything
missing is visibly flagged rather than papered over.

## What gets stored, and where

Nothing, by default. There is no local ticket store in this build — a take lives in
memory for as long as you're looking at it and is discarded when you record another
one or navigate away.

The only two things ever written to `localStorage` (falling back to an in-memory
object if `localStorage` is unavailable, e.g. private browsing) are:

- **Preferences**: finish, waveform color, your name, workspace label.
- **License/trial state**: whether a key has been verified, and how many trial
  takes you've used.

Neither of those is ticket content. Clearing your browser's site data for this page
removes both.

## Sharing a ticket

Sharing is optional and produces a link, not a saved copy — closer to sharing a
video link than saving to a database:

- **Private** (default): the ticket payload is encrypted in the browser with
  AES-256-GCM, key derived by PBKDF2 (310,000 iterations, SHA-256) from a
  passphrase you choose. The passphrase is never included in the link, never
  stored, and never transmitted — you send it to the recipient a different way.
- **Open**: the payload is Base64URL-encoded, not encrypted. SAY SO shows an explicit
  "anyone with this link can read the ticket" warning before generating one.

Either way, the payload lives entirely in the URL fragment (`#take=...`), which
browsers never send to a server — so even though the link *looks* like it points at
a page, nothing about its content is transmitted anywhere by opening it. Opening a
SAY SO share link on another device renders a minimal receiver page that decodes it
client-side, shows the ticket text with Copy and Clear, and writes nothing to
storage. Clearing the receiver also strips the fragment from the address bar.

There is no server anywhere in this flow. You are responsible for how the link
itself travels (native share sheet, message, email) — SAY SO only makes the link.

## Network requests this page makes

- **Google Fonts** (`fonts.googleapis.com`, `fonts.gstatic.com`): loaded on every
  page view to render the Archivo / IBM Plex Mono typefaces. Google can see the
  requesting IP address for this, as with any font CDN.
- **Whisper model weights**: the app preloads Whisper shortly after launch (so
  recording can start before it's ready). The page loads `@xenova/transformers`
  from `cdn.jsdelivr.net` and the `Xenova/whisper-base.en` model from
  `huggingface.co`. This is a one-time ~80 MB download of code and model weights,
  not your data; it's cached by the browser afterward (`transformers.js`'s own
  Cache Storage entry, separate from the app shell cache in `sw.js`) so it isn't
  repeated.
- **License purchase link**: the "Get a key" button in the unlock modal opens an
  external storefront URL (`BUY_URL` in `index.html`, e.g. Gumroad/Lemon
  Squeezy/Stripe) in a new tab, only when you click it. That storefront's own
  privacy policy governs what happens there, not this one.
- **A share link, only if you make one**: generating and sending a share link is
  the only other way anything about a ticket ever leaves this page, and it only
  happens when you explicitly choose to share.

Nothing else calls out over the network. There is no analytics or telemetry script
in this codebase.

## License key checks

Unlocking the app verifies a license key's ECDSA-P256 signature against a public key
embedded in `index.html`, entirely in-browser via WebCrypto. No key or usage data is
sent to any server to check it — it's an offline signature check, not a phone-home
license server. The local trial counter never leaves the device either.

## Clipboard

The "Copy" action puts rendered ticket text on your system clipboard via the
standard `navigator.clipboard` API. Anything else on your device with clipboard
access can read it until it's overwritten — normal OS clipboard behavior, not
specific to this app.
