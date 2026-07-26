# Shipping TAKE — phone first, then the stores

Written for: testing on your own iPhone and Android phone, building from a Windows PC, no Mac. Three phases, each usable on its own. Phase 1 needs about fifteen minutes and no money.

## Phase 1 — on your phone today (no store, no accounts beyond GitHub)

The mic only works on HTTPS, so the phone needs a real URL, not a file. GitHub Pages gives you one for free and it doubles as your deploy pipeline forever.

Step 1. On github.com: New repository → name it (say `take`) → Public → Create. Then "uploading an existing file" → drag everything inside the `take-app` folder in (every file sits at the root — no folders to worry about) → Commit.

Step 2. Repo → Settings → Pages → Source: "Deploy from a branch" → Branch `main`, folder `/ (root)` → Save. In about a minute your app is live at `https://YOURNAME.github.io/take/`.

Step 3. Open that URL on each phone and run the same drill on both:

Android (Chrome): press REC → allow the microphone → talk a fake ticket → STOP → check Review → Render → Copy. Then switch the engine chip to Whisper on Wi-Fi (first run downloads ~40 MB, watch the operator's log), record once so the model caches, then turn on airplane mode and record again. It still transcribes. That is the product's whole argument, witnessed on your own hardware. Install it: the Install button lights up in the header, or menu ⋮ → Add to Home screen.

iPhone (Safari): same drill. Install: Share → Add to Home Screen. The installed copy runs full-screen with its own icon and the mic works inside it. If the Speech engine is flaky on iOS (it can be), Whisper is the dependable one there.

Also worth testing on both: seal a take with a passphrase, open Desk, unseal; burn through the 10-take trial and unlock with the sample key from the README; flip Burst/Light.

A note on "solely on my phone": the Pages URL is public but unguessable, and the license gate limits freeloaders to 10 takes. If you want testing with nothing published at all, run `npx http-server -p 8080 .` on the PC and in another terminal `npx localtunnel --port 8080` — it prints a temporary HTTPS URL your phone can open (the first visit shows a gate page; the password it asks for is your public IP, shown at https://loca.lt/mytunnelpassword).

## Phase 2 — iterate

Edit `index.html` (locally and re-upload, or press the pencil icon in GitHub's web editor), commit, and Pages redeploys in under a minute. Reload on the phone — the service worker fetches pages network-first, so edits arrive on the next load; if the app is installed, fully close and reopen it. If you ever change `sw.js` or the icons, bump the `CACHE` version string at the top of `sw.js` so old caches are dropped.

Bug reports to yourself: the operator's log on screen narrates everything the app does — a screenshot of it is usually the whole diagnosis.

Fast lane for Android sessions (optional, skips deploying): connect the phone by USB, enable USB debugging, open `chrome://inspect#devices` on the PC, add a port forward `8080 → localhost:8080`, run the local server, and browse to `localhost:8080` on the phone. That counts as a secure context, so the mic works with zero deploys. iPhone has no Mac-free equivalent — but with sub-minute Pages deploys you will not miss it.

## Phase 3a — Google Play (your first store; all of it works on Windows)

What you need: Node.js, Android Studio, a Google Play Console account ($25, one time).

```
cd take-app
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap open android
```

Before building, two edits. In `android/app/src/main/AndroidManifest.xml` add:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

And decide the store pricing model (this matters for policy): both Google and Apple require digital goods sold inside an app to use their own billing. Selling Gumroad license keys from inside a store app violates that. The clean split — the web PWA stays free-with-license-keys, the store build is a paid app with the gate removed. For store builds only, change one line in `index.html`:

```js
function gateOK(){return true}       // store build: paid upfront, no key gate
```

(Leave `BUY_URL` empty in store builds so no external purchase link renders. Keep the web version exactly as it is.)

Native WebViews have no Web Speech API; the app already detects that and switches itself to Whisper on the first recording, which is the honest engine anyway.

Then: plug in your Android phone (USB debugging on) and press Run ▶ in Android Studio — the real native app installs on your phone. That is your native test loop; after web edits run `npx cap sync` and Run again. When it feels right: Build → Generate Signed App Bundle (create a keystore, let Play App Signing manage the rest), then in Play Console create the app, upload the AAB to the Internal testing track (instant, shareable link, up to 100 testers), fill the Data safety form — genuinely pleasant for this app: microphone processed on-device, no data collected, no data shared — plus a content rating questionnaire and a privacy policy URL (a PRIVACY page on your Pages site is fine). Promote Internal → Production when ready. First reviews typically take a few days; Google's cut on a paid app is 15% up to $1M/yr.

## Phase 3b — Apple App Store (needs Mac access; do it when it earns its cost)

Meanwhile, iPhone users are not waiting: the PWA installs from Safari with no store, no review, no $99/yr, and license keys sold however you like — Apple's billing rules stop at the store's edge.

When you want the real listing: Apple requires an Apple Developer Program membership ($99/year) and a build signed through Xcode, which only runs on macOS. From a Windows shop your options, in rising order of commitment: borrow a Mac for a weekend (`npx cap add ios`, open Xcode, sign with your team, archive, upload); rent one by the hour or month (MacinCloud and similar); or use a CI service such as Codemagic, which builds Capacitor iOS projects and uploads to TestFlight from a git repo, with a free tier — no Mac touched. Whichever route, the sequence is: TestFlight on your own iPhone first (that is Apple's phone-testing lane), iterate, then submit for App Review with screenshots, the privacy nutrition labels (same happy story as Google's form), and the mic permission text already in the README. Use the same paid-upfront model as Play — Apple's 3.1.1 rule on external purchases is the strictest in the business, and review does check.

## Order of operations, compressed

Today: Pages URL on both phones, airplane-mode Whisper test, install both home-screen apps, unlock with the sample key. This week: iterate on the web version — it is the same artifact you will sell. When it converts: $25, Play internal testing, then production as a paid app. When iPhone demand shows up in your numbers: Codemagic or a rented Mac, TestFlight, App Store. At every stage the PWA remains the thing you actually iterate on; the store builds are wrappers around it.
