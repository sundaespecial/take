# SAY SO

Dictation instrument for ticket work. Press REC, talk the way you would tell a colleague, stop — SAY SO transcribes on-device with Whisper, extracts the facts into fields (fills, never composes), and renders a ticket. Two screens only: **Capture** and **Ticket**. Everything else — finish, waveform color, your name, license — lives behind the settings gear so it never competes with those two.

Whisper is the only speech engine; it runs entirely on the device, model and all. Two material finishes (Light, Dark, or System) and three waveform color presets (Rainbow, Black & White, Amber). Sharing a finished ticket to a desktop is a link, not an account: Private links are AES-256-GCM sealed with a passphrase you choose, Open links are plainly encoded and say so before you generate one. Either way there is no server — the link carries the ticket, the same way a video link carries a video ID. Opening a SAY SO share link renders a small "legal pad" receiver page with Copy and Clear; nothing is ever stored.

One HTML file, no build step, no backend required.

New here? SHIP.md is the ordered playbook: phone testing today, Google Play from a Windows PC, App Store without owning a Mac.

## Run it locally

```
npx http-server -p 8080 -c-1 .
```

Open http://localhost:8080, allow the microphone, press REC. No mic handy — press DEMO. The mic requires localhost or HTTPS; opening the file straight from disk works in some browsers but not all.

## Publish on GitHub Pages

Create a repo, push this folder, then Settings → Pages → deploy from branch `main`, root. Your app is live at `https://YOURNAME.github.io/REPO/` with HTTPS, which makes it installable as an app on both Android and iPhone. Note that GitHub Pages sites are public even from private repos' Pages — the license gate below is what protects paid access, not the repo visibility.

## Selling access

The app ships with a built-in gate: 10 real takes free (the demo never counts), then it asks for a license key. Keys are signed with your private key and verified inside the app against your public key — offline, no license server, no phone-home.

Before selling anything, rotate the keys — the pair this repo shipped with is a sample and its private half was destroyed:

```
node keygen.mjs init --write     # new keypair, public key swapped into index.html
node keygen.mjs issue buyer@example.com          # perpetual key
node keygen.mjs issue buyer@example.com 365      # key that expires in a year
node keygen.mjs verify TAKE1.xxxx.yyyy           # sanity check
```

`keys/take-private.jwk` is gitignored. Anyone who has it can mint licenses, so treat it like a password.

Then pick a storefront that delivers text after purchase — Gumroad, Lemon Squeezy, and Stripe Payment Links all work. Put the product link in `index.html` (`var BUY_URL='…'`) so the Get a key button appears in the unlock screen. Flow: buyer pays, you run `issue` with their email and send the key (both platforms support manual fulfilment; automation via their webhooks can come later).

This build ships with a live public key that is already rotated — the sample keypair that came with the original scaffold is dead, and no working key is published anywhere. The private half lives only on the owner's machine, outside this folder, and is never committed.

Honest caveat: the check runs client-side, so a determined person can crack it. For an indie tool at indie prices this is normal and fine; if piracy ever actually costs you money, that is the moment to add a license server, not before.

## Install as an app (no app store)

This is a PWA. On Android Chrome, the Install button lights up in the header (or menu → Add to Home screen). On iPhone Safari: Share → Add to Home Screen. Either way it gets its own icon, runs full-screen, and the shell works offline. After the Whisper model has been fetched once it is cached, so transcription works with the radios off — which is rather the point of the product.

## Real Android / iOS store apps (when you want them)

The web app wraps cleanly with Capacitor. What it costs: Google Play $25 once, Apple $99/year, and (for iOS only) a Mac with Xcode. Whisper is the only engine on the web build too now, so there is no store-WebView caveat to work around — the wrapped app behaves the same as the PWA. Android builds entirely on Windows without Android Studio, using a portable JDK 21 + SDK command-line toolchain — see SHIP.md's "Phase 3a" for the full, current setup and build commands; that's the source of truth, this README doesn't duplicate it.

iOS — add to `ios/App/App/Info.plist`:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>SAY SO transcribes your dictation on this device. Audio never leaves it.</string>
```

Store apps also let you swap the license gate for real in-app purchase later, which Apple requires for digital goods sold inside iOS apps — another reason the PWA-first route is the sensible start.

## Debug mode

Open the page with `?debug=1` to see the Schematic diagram and the operator's log (a running narration of everything the page is doing) — useful for your own testing and bug reports, hidden from customers because it isn't part of the two-screen product.

## Repo map

```
index.html              the entire app — UI, extractor, crypto, license gate, share links
sw.js                   offline shell caching
manifest.webmanifest    install metadata
icon-*.png              app icons, light-on-ebony (flat, so any uploader works)
keygen.mjs              license keypair + key issuing (no dependencies)
capacitor.config.json   starting point for native wraps
test/                   node --test suite for the extractor and narrative renderer
tools/verify.mjs        structural/static checks (nav, syntax, required presets)
```

## Privacy posture, in one paragraph

Dictation is transcribed on-device by Whisper — there is no other engine, and no audio is ever sent anywhere. Extraction is deterministic rules, not generation, so empty stays empty and nothing is invented. Nothing is written to storage by default; if you choose to share a ticket, a Private link is sealed with a passphrase-derived AES-256-GCM key (the passphrase itself never enters the link), an Open link is plainly encoded and says so before you generate it, and either way the payload lives only in the URL fragment — there is no relay server and nothing is ever stored server-side.

Full detail and every network request this page makes: see [PRIVACY.md](PRIVACY.md).

All rights reserved — replace this line with the license terms you actually want to sell under.
