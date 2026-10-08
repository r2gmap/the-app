# The App

The App is a Firebase-backed rewards platform for clearly defined activities in games, apps, websites and offers. It keeps the existing static HTML5, CSS3 and vanilla JavaScript architecture: no framework, build step or client-side secrets.

The product language is deliberately calm and transparent. It does not promise instant money, use gambling imagery, or expose a messaging provider from the browser.

## Architecture

- **Public shell:** the root HTML pages share `style.css`, `components.css`, `responsive.css`, `main.js`, `navigation.js`, `auth.js` and `i18n.js`.
- **Admin shell:** `admin/*.html` uses `admin.js`, `admin.css` and the same Firebase/Auth services. `/admin/login` is the only admin entry; every admin route runs the shared route guard before loading its page controller.
- **Backend config layer:** `functions/config.js` defines the server-only Secret Manager values for `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. The browser calls `/api/admin/login`, receives only a Firebase custom token, and never receives any secret.
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
- logged-out navigation exposes `Sign in` and `Sign up`; `Admin Access` is a quiet footer link, not a header control;
- the footer is exactly `© The App`. There is no year-generation code.

The responsive layout is designed around the requested validation widths: 320, 390, 430, 768, 1024, 1440 and 1920 pixels.

## Authentication and authorization

There is one Firebase Authentication system for members and the protected admin session.

- Normal registration creates a Firestore profile with the literal `role: "user"` through `ensureUserProfile`. There is no form, URL, storage value or client variable that can create an admin.
- Admin login is available only at `/admin/login`. It posts the entered credentials to the same-origin `adminLogin` Cloud Function at `/api/admin/login`.
- The function compares the credentials with Secret Manager values, provisions the matching Firebase Auth identity, writes `users/{uid}.role: "admin"` with the Admin SDK, and returns a custom token. The frontend exchanges that token with Firebase Auth and persists the session locally.
- Every admin page runs `admin.js`'s route guard before loading its controller. A missing session, failed profile lookup, or non-admin profile is redirected to `/admin/login`.
- `firestore.rules` and `storage.rules` repeat the `users/{uid}.role == "admin"` check. Frontend guards are convenience; the rules are the security boundary.
- The public site has no admin button in its header. The only discoverable entry is the quiet `Admin Access` footer link.
- Google login remains in the normal member auth forms and is never used for admin access.

### Configure administrator access

1. In a trusted operator terminal, set the server-only secrets:

   ```bash
   firebase functions:secrets:set ADMIN_EMAIL
   firebase functions:secrets:set ADMIN_PASSWORD
   ```

2. Deploy the backend functions. The first successful admin login creates or updates the Firebase Auth identity and the matching `users/{uid}` document.
3. Open `/admin/login` and use the configured email/password. There is no admin registration page.
4. To rotate access, update `ADMIN_PASSWORD` and redeploy the functions. To disable access immediately, disable the matching Firebase Auth user and remove or change the admin secret.
5. Never put these values in `firebase-config.js`, frontend JavaScript, HTML, browser storage, Firestore documents, or Git.

The browser can create only `role: "user"`; only the backend Secret Manager flow or a trusted Firebase Admin SDK operator can grant administrator access.

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

To add a game, website, app or offer:

1. Open **Admin Access → Content → New content**.
2. Select the category, add the English title/description and optional Arabic copy, then enter the reward, difficulty, estimated time, requirements and instructions.
3. Add an external URL when the opportunity needs one. Upload a thumbnail and optional banner; the form shows preview and upload progress.
4. Save as a draft while preparing it, or publish when it is ready. Published content appears only on the matching public category.
5. Use the content list to edit, delete, feature, hide/unpublish or reorder items. Draft/unpublished content is never returned to public queries.

It supports the four categories `game`, `app`, `website` and `offer`, with the existing fields for English/Arabic title and description, requirements, reward, difficulty, image URLs/uploads, active status, draft/publish, featured state and display order. `offers-service.js` persists content to Firestore and uploads media to Storage.

- Image uploads are restricted to JPG, PNG and WEBP, with client validation and matching Storage rules.
- Public pages only query active/published content.
- The asset registry in `offers-service.js` preserves extension points for APK, ZIP and PDF files; corresponding Storage rule folders are prepared but are not exposed in the current public form.
- Admin role checks apply to content create, update, delete and Storage operations.

## Support tickets

The public contact flow is now a floating, RTL-aware support launcher rendered by `support-widget.js`. It contains a title, localized quick actions (`I completed a task`, `Reward not received`, `Account issue`, `Withdrawal issue`, `Other`), a message field, optional JPG/PNG/WEBP attachment and send action. It is available across the public shell, including the support and privacy pages.

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

This is the secure backend hand-off: the Firestore create event is the durable queue. The checked-in `functions/index.js` contains the server-side Telegram notification trigger; the browser only creates the private ticket and never receives provider credentials. A successful ticket state means the queue accepted the message; Telegram delivery is retried by the backend independently.

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
firebase functions:secrets:set ADMIN_EMAIL
firebase functions:secrets:set ADMIN_PASSWORD
firebase functions:secrets:set TELEGRAM_BOT_TOKEN
firebase functions:secrets:set TELEGRAM_CHAT_ID
firebase deploy --only firestore:rules,storage
firebase deploy --only functions,hosting
```

Deploy Hosting with the checked-in `assets/hero-loop.mp4` (or replace it with an approved production loop). The static host is configured in `firebase.json` with the repository root as its public directory.

For local rules testing, use the Firebase Emulator Suite and authenticated test users with both `role: "user"` and `role: "admin"`. The repository does not claim an emulator run unless one has actually been performed.

## Troubleshooting

- **Admin sign-in says it is unavailable:** confirm `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set in Secret Manager, deploy `adminLogin`, and confirm Hosting has the `/api/admin/login` rewrite. The browser intentionally does not fall back to a hardcoded password.
- **Admin sign-in succeeds but data is denied:** confirm the function can write `users/{Firebase Auth UID}` and that the document contains `role: "admin"`. Firestore and Storage rules intentionally fail closed when that relationship is missing.
- **Telegram notifications do not arrive:** confirm both Telegram secrets are configured, deploy `notifySupportTicket`, then inspect Cloud Functions logs. The Firestore support ticket remains available in the admin queue.
- **Password reset does not arrive:** enable Email/Password in Firebase Authentication, add the production/preview host to Authorized domains, and verify the Firebase email template and action URL. The UI uses Firebase's hosted reset flow and shows a non-enumerating success state.
- **Images fail to upload:** confirm Storage rules are deployed and use JPG, PNG or WEBP within the documented size limit. Admin uploads require the admin role; proof and support images require the signed-in owner.
- **Arabic text appears in the wrong direction:** clear the saved `theapp.locale` value, reload, and verify the page starts with `dir="rtl"`. The shell uses logical CSS properties and the locale is applied before first paint.

## Validation checklist

Before release, test the actual deployed/preview host at 320, 390, 430, 768, 1024, 1440 and 1920 pixels in both English and Arabic:

- landing, logged-out nav, mobile menu and quiet footer Admin Access link;
- login, registration, Google provider (if enabled), reset email and verification states;
- normal login profile creation always writes `role: "user"`; admin custom-token login provisions `role: "admin"` only on the backend;
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
