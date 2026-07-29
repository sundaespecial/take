# Shipping SAY SO — phone first, then the stores

Written for: testing on your own iPhone and Android phone, building from a Windows PC, no Mac. Three phases, each usable on its own. Phase 1 needs about fifteen minutes and no money.

## Phase 1 — on your phone today (no store, no accounts beyond GitHub)

The mic only works on HTTPS, so the phone needs a real URL, not a file. GitHub Pages gives you one for free and it doubles as your deploy pipeline forever.

Step 1. On github.com: New repository → name it (say `say-so`) → Public → Create. Then "uploading an existing file" → drag everything inside the app folder in (every file sits at the root — no folders to worry about) → Commit.

Step 2. Repo → Settings → Pages → Source: "Deploy from a branch" → Branch `main`, folder `/ (root)` → Save. In about a minute your app is live at `https://YOURNAME.github.io/say-so/`.

Step 3. Open that URL on each phone and run the same drill on both:

Android (Chrome): press REC → allow the microphone → talk a fake ticket → STOP → the Ticket screen shows the extracted fields and the rendered ticket → Copy. Whisper preloads itself on Wi-Fi in the background (first run downloads ~80 MB — add `?debug=1` to the URL to watch it happen in the operator's log), so the first take you record after that download finishes transcribes with the radios off too: turn on airplane mode and record again, it still works. That is the product's whole argument, witnessed on your own hardware. Install it: the Install button lights up in the header, or menu ⋮ → Add to Home screen.

iPhone (Safari): same drill. Install: Share → Add to Home Screen. The installed copy runs full-screen with its own icon and the mic works inside it.

Also worth testing on both: from the Ticket screen, tap Share → Private, set a passphrase, generate the link, then open that link in another tab or device and unseal it; try an Open link too and confirm the "anyone with this link" warning shows before it generates; burn through the 10-take trial and unlock with a key you issue yourself (`node keygen.mjs issue you@example.com`, using the private key from `node keygen.mjs init`); open Settings and flip the finish (Light/Dark/System) and waveform color (Rainbow/Black & White/Amber).

A note on "solely on my phone": the Pages URL is public but unguessable, and the license gate limits freeloaders to 10 takes. If you want testing with nothing published at all, run `npx http-server -p 8080 .` on the PC and in another terminal `npx localtunnel --port 8080` — it prints a temporary HTTPS URL your phone can open (the first visit shows a gate page; the password it asks for is your public IP, shown at https://loca.lt/mytunnelpassword).

## Phase 2 — iterate

Edit `index.html` (locally and re-upload, or press the pencil icon in GitHub's web editor), commit, and Pages redeploys in under a minute. Reload on the phone — the service worker fetches pages network-first, so edits arrive on the next load; if the app is installed, fully close and reopen it. If you ever change `sw.js` or the icons, bump the `CACHE` version string at the top of `sw.js` so old caches are dropped.

Bug reports to yourself: add `?debug=1` to the URL and the operator's log narrates everything the app does — a screenshot of it is usually the whole diagnosis. It's hidden by default so customers only ever see Capture and Ticket.

Fast lane for Android sessions (optional, skips deploying): connect the phone by USB, enable USB debugging, open `chrome://inspect#devices` on the PC, add a port forward `8080 → localhost:8080`, run the local server, and browse to `localhost:8080` on the phone. That counts as a secure context, so the mic works with zero deploys. iPhone has no Mac-free equivalent — but with sub-minute Pages deploys you will not miss it.

## Phase 3a — Google Play (your first store; all of it works on Windows, no Android Studio required)

What you need: Node.js, a JDK, the Android SDK command-line tools, a Google Play Console account ($25, one time). This machine has no admin rights, so instead of the Android Studio installer, the toolchain is portable zips extracted under `%LOCALAPPDATA%\AndroidToolchain`:

```
%LOCALAPPDATA%\AndroidToolchain\jdk21\jdk-21.0.12+8      # JDK 21 — Capacitor 8's Android build requires 21, not 17
%LOCALAPPDATA%\AndroidToolchain\sdk                       # Android SDK: platform-tools, platforms;android-36, build-tools;36.0.0
```

`android/local.properties` points `sdk.dir` at that SDK path. (If Android Studio is ever installed properly later, it can just take over this same `sdk.dir` — nothing here is incompatible with it.)

The Capacitor project is already scaffolded (`npx cap add android`, `android/` — gitignored, regenerate with the same command if it's ever missing) with the app ID `com.sundaespecial.sayso` in `capacitor.config.json`, and mic permissions already added to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

**Both `android/` and its manifest edit are gitignored — if this project is ever re-scaffolded from scratch, redo the app ID and these two permission lines before building.**

Store pricing model: both Google and Apple require digital goods sold inside an app to use their own billing, so the web PWA stays free-with-license-keys while the store build is a paid-upfront app with the gate removed. `tools/build-store.mjs` handles this automatically — it regenerates `www/` (gitignored) from the current `index.html` with `gateOK(){return true}` and `BUY_URL` cleared, leaving the real web app at the repo root untouched. Run it before every sync:

```
node tools/build-store.mjs
npx cap sync android
```

**Signing.** The release keystore already exists at `keys/take-release.keystore` (gitignored — file name and its `take` alias are internal/local only, left as-is through the rename since renaming them risks breaking the signing setup for zero visible benefit) — **this is the single most important file in this entire project to back up.** Losing it means this app listing can never receive another update, ever; Google cannot help recover it. Copy it to a password manager or encrypted backup now if that hasn't happened yet. The store/key password is not written to disk anywhere — it needs to be supplied as an environment variable when building:

```
cd android
$env:JAVA_HOME = "$env:LOCALAPPDATA\AndroidToolchain\jdk21\jdk-21.0.12+8"    # PowerShell
$env:SAYSO_KEYSTORE_PASS = "<the password>"
.\gradlew.bat bundleRelease --no-daemon
```

Output: `android/app/build/outputs/bundle/release/app-release.aab` — this is the file that gets uploaded to Play Console. (A debug build for on-device testing, no signing needed, is `.\gradlew.bat assembleDebug --no-daemon`, output as an installable `.apk` under `android/app/build/outputs/apk/debug/`.)

Whisper is the only engine, on the web build and the wrapped one alike, so there's no WebView-specific fallback to worry about.

In Play Console: create the app, upload the `.aab` to the Internal testing track (instant, shareable link, up to 100 testers), fill the Data safety form — genuinely pleasant for this app: microphone processed on-device, no data collected, no data shared — plus a content rating questionnaire and a privacy policy URL (the live PRIVACY.md page works for this). Promote Internal → Production when ready. First reviews typically take a few days; Google's cut on a paid app is 15% up to $1M/yr.

## Phase 3b — Apple App Store (needs Mac access; do it when it earns its cost)

Meanwhile, iPhone users are not waiting: the PWA installs from Safari with no store, no review, no $99/yr, and license keys sold however you like — Apple's billing rules stop at the store's edge.

When you want the real listing: Apple requires an Apple Developer Program membership ($99/year) and a build signed through Xcode, which only runs on macOS. From a Windows shop your options, in rising order of commitment: borrow a Mac for a weekend (`npx cap add ios`, open Xcode, sign with your team, archive, upload); rent one by the hour or month (MacinCloud and similar); or use a CI service such as Codemagic, which builds Capacitor iOS projects and uploads to TestFlight from a git repo, with a free tier — no Mac touched. Whichever route, the sequence is: TestFlight on your own iPhone first (that is Apple's phone-testing lane), iterate, then submit for App Review with screenshots, the privacy nutrition labels (same happy story as Google's form), and the mic permission text already in the README. Use the same paid-upfront model as Play — Apple's 3.1.1 rule on external purchases is the strictest in the business, and review does check.

## Order of operations, compressed

Today: Pages URL on both phones, airplane-mode Whisper test, install both home-screen apps, unlock with a key you issue yourself. This week: iterate on the web version — it is the same artifact you will sell. When it converts: $25, Play internal testing, then production as a paid app. When iPhone demand shows up in your numbers: Codemagic or a rented Mac, TestFlight, App Store. At every stage the PWA remains the thing you actually iterate on; the store builds are wrappers around it.
