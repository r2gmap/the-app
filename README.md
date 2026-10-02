# The App

The App is a Firebase-backed rewards platform for clearly defined activities in games, apps, websites and offers. It keeps the existing static HTML5, CSS3 and vanilla JavaScript architecture: no framework, build step or client-side secrets.

The product language is deliberately calm and transparent. It does not promise instant money, use gambling imagery, or expose a messaging provider from the browser.

## Architecture

- **Public shell:** the root HTML pages share `style.css`, `components.css`, `responsive.css`, `main.js`, `navigation.js`, `auth.js` and `i18n.js`.
- **Admin shell:** `admin/*.html` uses `admin.js`, `admin.css` and the same Firebase/Auth services. Every admin route calls `users/{uid}.role == "admin"` before loading its page controller.
- **Firebase access:** `firebase.js` is the only SDK loader. `firebase-config.js` contains browser-safe Firebase Web SDK identifiers only; no service-account credential belongs in this repository.
- **Services:** Firestore and Storage behavior is isolated in `*-service.js` modules. UI controllers do not write raw collections directly.
- **Server-side notifications:** `functions/index.js` listens for support tickets and optionally notifies operators using Secret Manager values. It is separate from the static browser architecture.
- **Locales:** English and Arabic are stored in `i18n.js`. The document direction switches to RTL for Arabic, while CSS uses logical properties so the same layout mirrors naturally.

## Run locally

This is a static site. Serve the repository over HTTP rather than opening HTML files directly, because ES modules and Firebase callbacks require an origin.

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

The Firebase Web SDK is loaded from the Google CDN at runtime. If the CDN or Firebase configuration is unavailable, the public layout and translated navigation remain usable and auth/data surfaces show a safe fallback.

## Public experience

The landing page is intentionally cinematic rather than dashboard-like:

- the hero headline is three staggered lines: `PLAY.`, `WIN.`, `EARN.`;
- the hero video element is autoplaying, looping, muted, inline and `object-fit: cover` with a dark overlay;
- `assets/hero-poster.png` is the first-class poster fallback;
- `home.js` falls back gracefully on media errors and disables the video when `prefers-reduced-motion: reduce` is active;
- a restrained local loop is checked in at `assets/hero-loop.mp4`; replace it with the approved production loop if the media direction changes. The checked-in poster keeps the hero usable when media is unavailable;
- the typography-only logo is reusable markup: small `the` above a much larger, left-aligned `APP`. It has no icon, signal, mascot or chat mark;
- logged-out navigation exposes `Admin`, `Sign in` and `Sign up` on desktop and mobile;
- the footer is exactly `© The App`. There is no year-generation code.

The responsive layout is designed around the requested validation widths: 320, 390, 430, 768, 1024, 1440 and 1920 pixels.

## Authentication and authorization

There is one Firebase Authentication system.

- Registration creates a Firestore profile with the literal `role: "user"` through `ensureUserProfile`. There is no form, URL, storage value or client variable that can create an admin.
- The dedicated admin login accepts the existing admin identity flow, signs in through the same Firebase Auth instance, then checks the Firestore role before redirecting to the admin shell.
- Normal navigation performs one profile-role lookup for the authenticated user and reveals `Admin panel` only when the returned role is exactly `admin`. It never trusts a query parameter or local storage flag.
- `firestore.rules` and `storage.rules` repeat the same role check. Frontend guards are convenience; the rules are the security boundary.
- Google login remains in the normal auth forms and only works when the Firebase provider is enabled for the project.

### Safely create an administrator

1. Create or invite the account in **Firebase Authentication**.
2. Create `users/{uid}` through the trusted Firebase console/Admin SDK path with the normal profile fields and `role: "admin"`.
3. Never add the role through registration, a form field, URL, browser storage or a public CMS action.
4. Verify the admin can pass `admin.js` and the Firestore/Storage rules before sharing the admin URL.

The browser can create only `role: "user"`; a server-side trusted operator is the only place that should grant or revoke administrator access.

### Password reset production checklist

`auth.js` calls Firebase `sendPasswordResetEmail`; it does not implement a custom reset flow. In Firebase Console, verify before launch:

1. Email/password provider is enabled.
2. Google provider is enabled only if the project is configured to use it.
3. Every production host, preview host used for QA, and the Firebase Auth domain is in **Authentication → Settings → Authorized domains**.
4. The production hosting domain is used for the action URL and the email template has the correct product name, sender and language.
5. The reset link returns to the intended production domain, not localhost or a preview origin.
6. The success message remains non-enumerating: it says a link was sent if an account uses that address. Firebase error messages are mapped to localized, user-safe copy.

## CMS and content operations

The existing CMS remains intact at `admin/content.html` and `admin/content-form.html`.

It supports the four categories `game`, `app`, `website` and `offer`, with the existing fields for English/Arabic title and description, requirements, reward, difficulty, image URLs/uploads, active status, draft/publish, featured state and display order. `offers-service.js` persists content to Firestore and uploads media to Storage.

- Image uploads are restricted to JPG, PNG and WEBP, with client validation and matching Storage rules.
- Public pages only query active/published content.
- The asset registry in `offers-service.js` preserves extension points for APK, ZIP and PDF files; corresponding Storage rule folders are prepared but are not exposed in the current public form.
- Admin role checks apply to content create, update, delete and Storage operations.

## Support tickets

The public contact flow is now a floating, RTL-aware support launcher rendered by `support-widget.js`. It contains a title, localized quick categories (`Reward not received`, `Submission problem`, `Withdrawal question`, `Account access`, `Other`), a message field, optional JPG/PNG/WEBP attachment and send action. It is available across the public shell, including the support and privacy pages.

The browser writes only this record shape:

```text
supportTickets/{ticketId}
  userId
  userName
  email
  category
  message
  attachmentUrls
  status: "open"
  createdAt
```

`support-service.js` creates the ticket and uploads an optional image to `support-attachments/{uid}/{ticketId}/...`. `admin/support.html` reads the queue through `fetchSupportTickets`; Firestore rules allow that read only when the caller's profile has `role == "admin"`. Members cannot list, read, update or delete tickets. Storage attachment reads are private to the ticket owner and authorized admins.

This is the secure backend hand-off: the Firestore create event is the durable queue. The checked-in `functions/index.js` contains the optional server-side Telegram notification trigger; the browser only creates the Firestore ticket and never receives provider credentials.

### Telegram configuration

The notification function uses Firebase Secret Manager values named exactly:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Set them from a trusted operator environment, never in this repository or in Firebase Web config:

```bash
firebase functions:secrets:set TELEGRAM_BOT_TOKEN
firebase functions:secrets:set TELEGRAM_CHAT_ID
firebase deploy --only functions:notifySupportTicket
```

The function is triggered by `supportTickets/{ticketId}` in `africa-south1`, sends a concise operator message, and retries delivery failures. Ticket creation remains successful even when notification credentials are not configured; admins can still use the protected Firestore queue. Do not add provider URLs, bot credentials or chat identifiers to any browser module or public Firestore document.

## Firestore security model

Rules are in `firestore.rules` and intentionally fail closed through a catch-all rule.

- Users can read only their own profile, submissions, withdrawals, transactions and notifications.
- Admins can read the operational queues and all content needed for review.
- Profiles keep `uid`, `email` and `role` immutable from the browser. A client can never promote itself.
- Submissions start as `pending`; only an admin can approve/reject them. The approval batch creates the wallet transaction and user notification.
- Withdrawals start as `pending`; only an admin can approve/reject them. The approval batch records the negative ledger entry and notification.
- Transactions are append-only and admin-write-only.
- Support queue reads are admin-only.
- Public offers are readable only when active/published; drafts are admin-only.
- No browser module contains a bot token, a chat ID or an external messaging endpoint.

Storage policy is in `storage.rules`: public offer images, private proof images, private support attachments, owner avatars and prepared signed-in offer-file folders are separated and size/MIME checked.

## Firebase deployment

The project is associated with the Firebase project in `.firebaserc`. Review the target project and rules before deploying.

```bash
firebase login
firebase use <project-id>
firebase deploy --only firestore:rules,storage
firebase deploy --only functions,hosting
```

Deploy Hosting with the checked-in `assets/hero-loop.mp4` (or replace it with an approved production loop). The static host is configured in `firebase.json` with the repository root as its public directory.

For local rules testing, use the Firebase Emulator Suite and authenticated test users with both `role: "user"` and `role: "admin"`. The repository does not claim an emulator run unless one has actually been performed.

## Validation checklist

Before release, test the actual deployed/preview host at 320, 390, 430, 768, 1024, 1440 and 1920 pixels in both English and Arabic:

- landing, logged-out nav, mobile menu and Admin link;
- login, registration, Google provider (if enabled), reset email and verification states;
- normal login role lookup: user hides Admin panel, admin reveals it;
- public category/detail pages, dashboard, submissions, wallet and withdrawals;
- admin guard, CMS upload/draft/publish/featured/order/edit/delete and prepared asset restrictions;
- support launcher, validation, attachment upload, ticket creation and admin queue authorization;
- privacy and terms pages;
- RTL alignment, keyboard focus, screen-reader labels and reduced motion.

Useful static checks:

```bash
find . -maxdepth 2 -name '*.js' -print0 | xargs -0 -n1 node --check
# Also verify that public footers remain the fixed © The App copy.
```

A browser, Firebase emulator, real Storage upload, provider configuration and responsive viewport run must be reported separately; static syntax checks do not prove those behaviors.

## Visual editing guide

- `style.css`: dark design tokens, spacing, type scale and foundational page layout.
- `components.css`: shared cards, forms, nav, hero media and floating support panel.
- `responsive.css`: viewport behavior and grid breakpoints.
- `admin.css`: admin shell and support queue cards.
- `assets/hero-poster.png`: checked-in cinematic static fallback.
- `i18n.js`: all user-facing English and Arabic copy.
