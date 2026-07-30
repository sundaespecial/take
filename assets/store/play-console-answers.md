# SAY SO — Play Console compliance answers

Everything below was checked against the **shipped store build** (`www/index.html`
as bundled into `app-release.aab`), not against the docs or the web version. Where
the web app and the store build differ, the store build wins, because that's what
Play users get.

Verified on 2026-07-30 against the current bundle:

| Claim | How it was checked |
|---|---|
| Only 3 permissions: `INTERNET`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` | merged release manifest |
| No advertising ID | no `com.google.android.gms.permission.AD_ID` in merged manifest |
| No license/trial UI in the store build | no `licChip` / `lmodal` / `setLicBtn` markup in bundled HTML |
| Only writes 2 local keys | `sayso.prefs.v1`, `sayso.trial.v1` — both device-local |
| Outbound hosts | `cdn.jsdelivr.net`, `huggingface.co`, `fonts.googleapis.com`, `fonts.gstatic.com` |

---

## 1. Privacy policy URL

```
https://sundaespecial.github.io/say-so/PRIVACY.html
```

Confirmed live, returns `200 text/html`, and its content matches the shipped
build. Use the `.html` URL, not the `.md` one — Play wants a human-readable page,
and the `.md` URL serves raw `text/markdown`.

---

## 2. Data safety form

**Does your app collect or share any of the required user data types?** → **No**

Answering No ends the form. The rest of this section is the reasoning, in case a
reviewer asks or you want to sanity-check it yourself.

Google defines *collection* as transmitting user data **off the device**. By that
definition SAY SO collects nothing:

- **Audio / voice.** The mic is used, but audio is transcribed in-page by Whisper
  running locally, is never written to disk, and is never sent anywhere. Using a
  sensor is not collecting data. This is the answer most likely to be
  second-guessed, so: there is no upload path in the code at all — no backend
  exists to receive it.
- **Transcript and extracted ticket fields.** Extraction is deterministic string
  matching in the page. No LLM call, no network request.
- **Personal info.** No account, no sign-in, no email capture, no contacts.
- **Device or other IDs.** No advertising ID, no device ID, no analytics SDK, no
  crash reporting. Verified by permission audit above.
- **App activity / performance.** No telemetry code exists in the codebase.

**Two honest footnotes** (neither is declarable, but you should know why):

1. **Local storage is not collection.** The app writes two keys to
   `localStorage` — display preferences and a trial counter — and both stay on
   the device. (The trial counter is vestigial in the paid build; it increments
   but nothing reads it, since the gate is removed. Harmless, but that's why it
   exists if you ever inspect storage.)
2. **CDN requests expose your IP, as all network requests do.** The app fetches
   the Whisper model from `huggingface.co` via `cdn.jsdelivr.net`, and fonts from
   Google Fonts. Those hosts see the requesting IP, the same way any website's
   CDN does. IP-address exposure inherent to making an HTTPS request is not one
   of Google's declarable data categories and does not need to be disclosed here.
   It *is* already disclosed in your privacy policy, which is the right place.

**Other questions on the form:**

- *Is all data encrypted in transit?* → N/A (nothing collected). If the form
  forces an answer, all outbound requests are HTTPS.
- *Do you provide a way to request data deletion?* → N/A. There's no account and
  no server-side data. Clearing the app's storage removes the two local keys.

---

## 3. Content rating questionnaire (IARC)

- **Email address** — your developer contact address.
- **Category** → **Utility, Productivity, Communication, or Other**

Answers:

| Question | Answer |
|---|---|
| Violence (realistic, fantasy, or cartoon) | No |
| Sexuality or nudity | No |
| Profanity or crude humour | No |
| Controlled substances (drugs, alcohol, tobacco) | No |
| Gambling — real or simulated | No |
| Horror / fear themes | No |
| Discrimination or hate content | No |
| Does the app share the user's current location? | No |
| Does the app allow users to purchase digital goods? | No (paid upfront via Play) |
| Does the app contain ads? | No |
| Does the app allow users to interact or exchange content with other users? | **No** — see note |

**The one judgment call.** SAY SO can turn a ticket into a share link. That link
is generated on-device and handed to the OS share sheet — the app hosts nothing,
has no server, no accounts, no user discovery, and no in-app channel through
which two users can reach each other. That is not "user interaction" in the sense
IARC means, so **No** is the correct answer and the one I'd file.

If you'd rather be conservative, answering **Yes** typically triggers follow-up
questions about moderation and may raise the age rating — which would be
misleading in the other direction, since there's no content to moderate. I'd
stay with No, but you're the one signing the questionnaire, so it's your call.

---

## 4. App content declarations

| Section | Answer |
|---|---|
| **Privacy policy** | URL in §1 |
| **Ads** | No, my app does not contain ads |
| **App access** | All functionality is available without special access. No login, no gated areas — reviewers can use everything immediately. |
| **Content ratings** | Questionnaire in §3 |
| **Target audience** | **18 and over.** It's a professional IT tool. Selecting any age band under 13 pulls you into the Families policy, which brings requirements you don't want and don't need. |
| **News app** | No |
| **COVID-19 contact tracing / status** | No |
| **Data safety** | §2 |
| **Advertising ID** | **No** — the app does not use an advertising ID. Verified: no `AD_ID` permission in the merged manifest. |
| **Government apps** | No |
| **Financial features** | No |
| **Health apps** | No |

**Note on the microphone.** `RECORD_AUDIO` is *not* one of Google's "sensitive
permissions" requiring a separate declaration form (those are SMS, Call Log,
background Location, All Files Access, and Accessibility). You don't need to file
a permissions declaration. Android shows its own runtime prompt; unlike iOS, there
is no `Info.plist`-style usage string to write for Android.

---

## 5. Before you publish

Every privacy claim in the listing becomes a **policy commitment** the moment you
publish. The current claims are all true of the shipped build — that's what the
verification table at the top is for. If the app later gains analytics, a backend,
crash reporting, or any upload path, the Data safety form and the privacy policy
must be updated **in the same release**, not after.

Two specific things that would break the current answers:

- Adding **any** analytics or crash-reporting SDK → Data safety becomes "collects
  data", and most such SDKs pull in the `AD_ID` permission automatically.
- Adding a **relay or sync server** for share links (the schematic sketches one as
  a *planned* idea) → ticket content would then leave the device, which
  contradicts both the listing copy and the privacy policy as written.
