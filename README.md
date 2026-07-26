# TAKE

Dictation instrument for ticket work. Talk the way you would tell a colleague; TAKE transcribes, extracts the facts into fields (fills, never composes), renders a ticket in your house style, and seals it with AES-256-GCM before it goes anywhere. Two speech engines: Web Speech (live captions, browser recognizer) and Whisper running fully on the device. Light and "burst" dark finishes.

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

The web app wraps cleanly with Capacitor. What it costs: Google Play $25 once, Apple $99/year, an Android Studio install, and a Mac with Xcode for iOS. One functional caveat to know upfront: the Web Speech engine does not exist inside store-app WebViews, so in wrapped builds Whisper is the engine — which is fine, it is the engine that honors the privacy story anyway.

```
npm install @capacitor/core @capacitor/cli
npx cap init TAKE com.yourdomain.take --web-dir .
npx cap add android    # then: npx cap open android
npx cap add ios        # Mac only: npx cap open ios
```

Android — add to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

iOS — add to `ios/App/App/Info.plist`:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>TAKE transcribes your dictation on this device. Audio never leaves it.</string>
```

Store apps also let you swap the license gate for real in-app purchase later, which Apple requires for digital goods sold inside iOS apps — another reason the PWA-first route is the sensible start.

## Repo map

```
index.html              the entire app — UI, engines, extractor, crypto, license gate
sw.js                   offline shell caching
manifest.webmanifest    install metadata
icon-*.png              app icons, light-on-ebony (flat, so any uploader works)
keygen.mjs        license keypair + key issuing (no dependencies)
capacitor.config.json   starting point for native wraps
```

## Privacy posture, in one paragraph

Dictation is processed on the device (Whisper engine) or by the browser's recognizer (Speech engine — labeled as online in the UI). Extraction is deterministic rules, not generation, so empty stays empty and nothing is invented. Takes are sealed with a passphrase-derived AES-256-GCM key before storage; the store holds ciphertext it cannot read; the passphrase is never persisted or transmitted. Sealed blobs are the only thing that ever leaves the page.

Full detail, including the one real tradeoff (Web Speech sends audio to the browser vendor's recognizer; Whisper doesn't) and every network request this page makes: see [PRIVACY.md](PRIVACY.md).

All rights reserved — replace this line with the license terms you actually want to sell under.
