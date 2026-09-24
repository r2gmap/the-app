# The App — static website

A rewards platform: people discover games and apps, complete a simple task,
submit proof, and receive a reward once an administrator approves the
submission. This phase adds real accounts on top of the existing landing
page: email/password and Google sign-in, email verification, password
reset, and a Firestore profile for every user — all through Firebase
Authentication, the only source of truth for who is signed in.

Built with **HTML5, CSS3 and vanilla ES modules**. No framework, no CSS
library, no build step, no bundler. Open `index.html` and it runs.

---

## Running it locally

The pages use ES modules, which browsers refuse to load over `file://`. Serve
the folder over HTTP:

```bash
python3 -m http.server 8080      # then open http://localhost:8080
# or
npx serve .
```

Deploying is a file copy — any static host works with no build step. To
deploy to the configured Firebase project (`the-app-01`) along with its
security rules:

```bash
firebase deploy --only hosting,firestore:rules,firestore:indexes
```

---

## File structure

```
├── index.html              landing page (auth-aware navigation)
├── login.html               sign-in, Google, forgot password
├── register.html            account creation, Google
├── verify-email.html        email verification status and actions
├── css/
│   ├── style.css            tokens, reset, base type, page sections
│   ├── components.css       buttons, cards, forms, states, menus, auth UI
│   └── responsive.css       all breakpoint rules, in one place
├── js/
│   ├── main.js               entry point; every page loads this one module
│   ├── i18n.js                translation catalogues + locale application
│   ├── navigation.js          mobile menu, language switcher
│   ├── offers.js               offer data, generated cover art, card rendering
│   ├── auth.js                 forms, Google, verification, nav, route guards
│   ├── firebase.js             SDK access + centralized auth-state observer
│   └── firebase-config.js      browser-safe config for project the-app-01
├── firestore.rules          real security rules for the users collection
├── firestore.indexes.json   (empty — no composite queries yet)
├── firebase.json / .firebaserc
├── assets/
│   ├── fonts/                self-hosted woff2
│   └── icons/favicon.svg
└── README.md
```

---

## Authentication

Firebase Authentication is the **only** source of truth for whether someone
is signed in. Nothing here writes a session flag to `localStorage` or
`sessionStorage` — every "am I logged in" question is answered by
`onAuthStateChanged`, wrapped once in `firebase.js` and reused everywhere.

### What's implemented

- **Email/password registration** — validates the form, creates the
  account, sets the display name, sends a real verification email, writes
  the Firestore profile, then sends the person to `verify-email.html`.
  Each of those three follow-up steps is independent and best-effort: a
  failure in one (e.g. the verification email send) never strands the
  other two or blocks the redirect.
- **Email/password login**, with client-side validation for feedback and
  Firebase's own check as the actual gate.
- **Google sign-in** (`signInWithPopup` + `GoogleAuthProvider`) on both
  `login.html` and `register.html` — one button serves both, since Google
  sign-in creates the account on first use. A returning Google user's
  profile is patched, never recreated or overwritten.
- **Email verification** — `verify-email.html` shows the account's email,
  a resend action (60-second client-side cooldown, persisted across a
  reload so it survives the registration → verify-email redirect), and a
  "check now" action that calls `reload()` and re-reads
  `currentUser.emailVerified`. That flag — never a Firestore field — is
  what decides whether someone is treated as verified anywhere in the app.
- **Forgot password** — an inline panel on `login.html` (no separate
  page), using `sendPasswordResetEmail`.
- **Logout**, wired everywhere a logout button appears (desktop nav,
  mobile nav, the verify page).
- **Auth-aware navigation** — `index.html`'s header and mobile menu show
  guest links or a display name + logout, and start with *both* states
  hidden until Firebase reports the real session, so a returning user is
  never shown "Log in" for a flicker.
- **Route guards** — `redirectIfAuthenticated()` bounces a signed-in
  visitor away from `login.html`/`register.html` (to `verify-email.html`
  if unverified, `index.html` otherwise); `requireAuth()` sends a signed-out
  visitor from `verify-email.html` to `login.html`. Both are infrastructure
  future authenticated pages can reuse as-is.
- **Firestore profile** at `users/{uid}` — created on first sign-in
  (email/password or Google) with `role: "user"`, never taken from a form
  field, URL parameter, or stored value. Later writes only ever patch
  `displayName`, `photoURL`, `preferredLanguage`, and `updatedAt`.
- **Friendly, localized errors everywhere** — raw Firebase codes
  (`auth/invalid-credential`, `auth/popup-closed-by-user`, ...) never reach
  the screen. A wrong password and a nonexistent account deliberately show
  the *same* message, so the login form can't be used to check which
  emails are registered.

### `js/firebase-config.js`

Holds only the browser-safe Web SDK config for `the-app-01` — an API key,
project id, and similar identifiers. None of these are secrets; access is
controlled by `firestore.rules`, not by hiding them. **No service-account
key or Admin SDK credential belongs in this file, or anywhere in this
directory** — everything here ships to the browser.

### `firestore.rules`

Replaces the Firebase console's default 30-day open-test rule. The model:

- Unauthenticated requests: denied, full stop.
- A signed-in user may `get` only `users/{theirOwnUid}`. `list` is denied
  entirely, so no client can enumerate the collection, even one document
  at a time.
- `create` requires the exact field set, `role == "user"` as a literal, and
  the email to match the caller's own authenticated email. `createdAt`/
  `updatedAt` must actually be timestamps, not client-supplied strings.
- `update` may only touch `displayName`, `photoURL`, `preferredLanguage`,
  and `updatedAt`. `uid`, `email`, and `role` must come out identical to
  what they already were — there is no client path to self-promotion, now
  or later, since a future admin role would be granted through the Admin
  SDK or the console, never through these rules.
- Everything else is denied by default.

---

## CSS architecture

Every colour, radius, shadow, spacing step and type size is a custom
property in `:root` at the top of `style.css`. One rule worth knowing about:
`[hidden] { display: none !important; }` — the single deliberate
`!important` in the file, added because a class that sets `display`
unconditionally (`.state`, `.mobile-nav__actions`, and now most of the
auth UI's toggled panels) otherwise silently wins the cascade tie against
the browser's own `[hidden]` default, leaving a "hidden" element visible.
Every show/hide toggle in the auth flow depends on this.

Layout is mobile-first; `responsive.css` only adds columns as width allows,
at breakpoints chosen from where the layout actually breaks (see the file
for the full list).

---

## Internationalisation

English (LTR) and Arabic (RTL), no duplicated markup, no dependency.
Locale resolves **stored choice → `navigator.languages` → English**. Markup
carries translation keys (`data-i18n`, `data-i18n-placeholder`,
`data-i18n-aria-label`, ...), never sentences — see `js/i18n.js`.

Every new string this phase added (Google button, divider, forgot
password, all of `verify-email.html`, every mapped Firebase error) has an
English and an Arabic translation.

---

## Testing

This sandbox's network egress explicitly blocks `gstatic.com` and every
`*.googleapis.com` host (confirmed directly — `curl` returns
`403 host_not_allowed`, and even downloading the local Firestore emulator
JAR from `storage.googleapis.com` fails the same way). That means **no
request in this environment can reach the real `the-app-01` Firebase
project**, in a browser or otherwise. Registration, login, Google
sign-in, verification email delivery, and password reset delivery against
the real project are **not tested** here and need to be run from a machine
with normal internet access.

What *was* tested, thoroughly, from this sandbox:

- **UI, layout, and localisation** in a real headless browser: no
  horizontal overflow at five widths from 320px to 1680px, no console
  errors, correct RTL mirroring, working mobile menu, working
  forgot-password panel toggle, all three `verify-email.html` states
  rendered and inspected visually in both languages.
- **All of the authentication logic** — every file listed above, completely
  unmodified — against a small fake Firebase SDK injected via Playwright's
  network interception (`page.route`), standing in only for the three
  blocked CDN modules. The fake keeps its state in `sessionStorage` so it
  survives full page navigations, the same way real Firebase session
  persistence would. This is real code exercising a fake backend, not a
  simulation of the code — it does **not** prove the real Firebase project
  or `firestore.rules` behave correctly, since a real project and a real
  rules engine were never reached.

  56 assertions passed, covering: valid registration and its side effects
  (display name set, verification email sent once, Firestore profile
  correct with `role: "user"` and no password field); duplicate email,
  invalid email, weak password, mismatched confirmation, and empty-field
  validation, including that no Firebase call fires for any invalid
  submission; resend cooldown and countdown; "check verification" both
  before and after the simulated email-link click; correct-password,
  wrong-password, and nonexistent-account login (the last two produce the
  *identical* message); unverified-login redirect to `verify-email.html`;
  Google sign-in creating a profile, a cancelled popup failing gracefully,
  and a second Google sign-in patching rather than duplicating the
  profile; password reset for a valid and an invalid address; session
  survival across a navigation and a hard refresh; `login.html` bouncing
  an already-authenticated visitor; and logout actually clearing the
  session, verified by `requireAuth()` subsequently redirecting away from
  `verify-email.html`.

- **A real, non-hypothetical bug found and fixed by this testing**:
  `firebase.js`'s auth-state listener had no `.catch()`, so a failed or
  blocked connection to Firebase (this sandbox, but just as easily an
  ad-blocker or a flaky network in production) left every page's
  "loading" state unresolved forever instead of falling back to
  signed-out. Fixed and re-verified.

- **`firestore.rules`**: reviewed by hand against every scenario in the
  task's security checklist (cross-user read, cross-user write, role
  self-promotion, unauthenticated access), and structurally valid. **Not**
  run against a live rules engine — the local emulator's JAR download is
  blocked the same way the production API is. Recommend running
  `firebase emulators:exec` with `@firebase/rules-unit-testing`, or testing
  directly against the console's Rules Playground, before relying on it in
  production.

---

## Intentional limitations

- **No dashboard, wallet, offers management, or admin panel.** Out of
  scope for this task by design.
- **A successful login redirects to `index.html`; there is nothing else
  there yet** beyond the auth-aware nav. That's expected at this stage.
- **`verify-email.html`'s "verified" view has no logout button** — its
  only action is "back to home"; logout is one click away in the header
  from there.
- **Arabic renders currency as `0.50 US$`** — correct `Intl.NumberFormat`
  output for the `ar` locale, digits pinned to Latin.
- **Three-way redirect logic (`index.html` / `verify-email.html` /
  `login.html`) is entirely client-side.** It is navigation convenience,
  not security — the actual gate for any future protected data is
  `firestore.rules`.
