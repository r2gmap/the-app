# The App — Rewards Platform (MVP + Content Management System)

A rewards platform where people discover **games, apps, websites and
offers**, complete a simple task, submit proof, and receive a reward
once their submission passes the review process.

**Built with HTML5, CSS3 and vanilla ES modules.** No framework, no
build step, no bundler, no Node.js required. Open it in a browser and
it runs. Everything is backed by **Firebase** (Authentication,
Firestore, Storage), the whole interface works in **English (LTR)** and
**Arabic (RTL)**, and **all platform content is managed through the
admin Content Management System** — publishing anything never requires
touching code.

---

## Owner's quick guide — manage everything without code

This section is for the **site owner**, not the developer. Every word
visitors read and every image they see is managed from the admin
panel — publishing never requires touching code.

### Where do I manage content?

Everything lives in one place: **the admin Content page**
(`admin/content.html`). Games, apps, websites and offers are all rows
in the same list — the *Category* field decides where each item appears
on the site. There is no second system, no hidden files to edit.

### How do I add a game, app, website or offer?

1. Sign in to the admin panel and open **Content**.
2. Click **Add content**.
3. Choose the **Category** (Game → appears on the Games page and the
   homepage Games group; App → Apps; Website → Websites; Offer → the
   Offers page). The item is placed in the right section automatically.
4. Fill in the title, short description (this is what cards show),
   reward, estimated time, difficulty and requirements.
5. Upload a **thumbnail** (the card image) and optionally a **banner**
   (the wide image on the details page) — see below.
6. Click **Save** (keeps it a draft, invisible to visitors) or
   **Save & publish** (live immediately).

### How do I upload an image?

In the content form, use the **Thumbnail** or **Banner** pickers:

- Click the file field, choose a JPG, PNG or WebP (up to 5 MB).
- A **live preview** appears instantly — you see exactly what visitors
  will see before saving.
- You can also paste a hosted image URL instead of uploading.
- Changed your mind? **Remove image** clears it; the site then uses the
  automatic generated cover art.

Images are stored safely in **Firebase Storage**, and only their URLs
are saved in the database — so replacing an image later updates every
page that shows it, instantly.

### How do I edit something that is already published?

Open **Content**, click **Edit** on the row, change anything (including
replacing the images), then **Save**. Changes go live immediately.

### What does **Duplicate** do?

It copies an item — every field, including the images — into a new
**draft** titled "… (copy)". Use it when a new offer is similar to an
old one: duplicate, tweak the reward and requirement, publish. A copy
never appears publicly until you publish it.

### How do I publish or unpublish?

On the Content list, the **Publish/Unpublish** button on each row
switches an item between live and draft instantly. Drafts are never
visible to visitors — not on the site, not in search.

### How do I edit the homepage?

The homepage is built from your content — nothing is hardcoded:

- **Featured strip**: tick *Featured* on any published item and it
  appears in the top carousel. Untick to remove it.
- **Group order and order inside a group**: set *Display order*
  (lower number = appears first).
- **The four category groups** fill themselves from the categories of
  your published content; a category with no published items simply
  doesn't show a group.

### How do I change the logo?

The logo is a live typography-only **The App** wordmark, repeated in the
public header/footer and admin shell. Update the `.brand__wordmark*` rules in
`components.css` for sizing and color, and keep the `aria-label="The App"`
markup intact. The compact browser-tab monogram lives in `favicon.svg`.

### Where will future content be managed?

In the same Content page. The upload system is already prepared for
future file types — **APK, ZIP and PDF** — with storage rules and
validation waiting (see the `ASSET_KINDS` registry in
`offers-service.js`). When the day comes, attaching a
downloadable file to an offer is a one-line change.

---

## Table of contents

0. [Owner's quick guide (no code needed)](#owners-quick-guide--manage-everything-without-code)
1. [Running it locally](#1-running-it-locally)
2. [Project structure](#2-project-structure)
3. [How authentication works](#3-how-authentication-works)
4. [Content management (the CMS)](#4-content-management-the-cms)
5. [How to add a new Game / App / Website / Offer](#5-how-to-add-a-new-game--app--website--offer)
6. [How to edit content](#6-how-to-edit-content)
7. [How to delete content](#7-how-to-delete-content)
8. [Draft & publish, featured, and display order](#8-draft--publish-featured-and-display-order)
9. [Admin system (login, accounts, roles)](#9-admin-system-login-accounts-roles)
10. [How Firestore collections work](#10-how-firestore-collections-work)
11. [How Storage works (uploads & replacement)](#11-how-storage-works-uploads--replacement)
12. [The main user flow](#12-the-main-user-flow)
13. [How translations work (EN / AR)](#13-how-translations-work-en--ar)
14. [Frequently Updated Content](#14-frequently-updated-content)
15. [How to configure Firebase](#15-how-to-configure-firebase)
16. [How to configure the Telegram bot](#16-how-to-configure-the-telegram-bot)
17. [How to deploy the project](#17-how-to-deploy-the-project)
18. [Security model](#18-security-model)
19. [Future expansion guide](#19-future-expansion-guide)
20. [Known limitations](#20-known-limitations)
21. [UI/UX design system — where to make visual edits](#21-uiux-design-system--where-to-make-visual-edits)
22. [Production UI/UX refresh — September 2026](#22-production-uiux-refresh--september-2026)

---

## 1. Running it locally

The pages use ES modules, which browsers refuse to load over
`file://`. Serve the folder over HTTP:

```bash
python3 -m http.server 8080      # then open http://localhost:8080
# or
npx serve .
```

The site also needs internet access to `www.gstatic.com` (the Firebase
SDK CDN). If that host is blocked on your network, pages still render
and navigate, but sign-in and data features show their
"not configured / error" states.

---

## 2. Project structure

This repository is intentionally a no-build static app: HTML, CSS and ES
modules live at the repository root so it can be deployed directly by
Firebase Hosting or served with any static HTTP server.

```
├── index.html, about.html, support.html, privacy.html, terms.html
│                              public marketing and legal pages
├── games.html, apps.html,
│   websites.html, offers.html, offer.html
│                              opportunity discovery and detail flows
├── dashboard.html, profile.html, wallet.html, withdraw.html
│   submissions.html, notifications.html
│                              authenticated member area
├── admin/                     admin-only HTML shell and routes
│   ├── login.html             admin sign-in
│   ├── dashboard.html         overview and pending work
│   ├── content.html           searchable CMS list
│   ├── content-form.html      add/edit, image upload, category, publish
│   ├── submissions.html       proof review and approve/reject actions
│   ├── users.html             user search and activity
│   ├── wallet.html             platform ledger and adjustments
│   └── withdrawals.html       withdrawal review
├── style.css                  tokens, page sections and global layout
├── components.css             shared controls, cards, forms and states
├── admin.css                  admin shell, lists and CMS styles
├── responsive.css             mobile, tablet and desktop breakpoints
├── main.js / admin.js         public/admin entry points and route guards
├── i18n.js                    English + Arabic catalogues and RTL support
├── offers.js                  shared opportunity-card renderer + demo data
├── *-service.js               Firebase-backed business logic modules
├── *-page.js / category.js    page controllers loaded on demand
├── firebase*.js               Firebase configuration and lazy SDK loading
├── firestore.rules             database security rules
├── storage.rules               upload security rules
└── README.md                  setup, CMS and design-system documentation
```

Presentation stays separate from business logic: page controllers render
HTML; the service modules own Firestore, Storage and wallet operations; and
`i18n.js` owns all reusable English/Arabic interface copy. The product has no
build step or bundler, so future modules should keep using relative imports
from this root-level structure.

---

## 3. How authentication works

Firebase Authentication is the **only** source of truth for who is
signed in. Nothing writes a "logged in" flag into storage — every
"am I logged in?" question is answered by Firebase's
`onAuthStateChanged`, wrapped once in `firebase.js` and reused
everywhere.

### For users

- **Email + password** with mandatory email verification (unverified
  accounts are routed to `verify-email.html`), plus **Continue with
  Google**.
- **Forgot password** uses Firebase's reset email.
- Profile documents `users/{uid}` are created on first sign-in with
  `role: "user"` — locked by the security rules.
- Guest-only pages (login/register) bounce signed-in visitors to the
  dashboard; member pages redirect guests to login.

### For admins

See [section 9](#9-admin-system-login-accounts-roles). In short: the
admin panel is a separate area with its own login (email/username +
password, **no Google**), and every admin page re-checks the
`role == "admin"` claim from Firestore on load.

---

## 4. Content management (the CMS)

Everything a visitor can see as "content" — every game, app, website
and offer — lives in **one Firestore collection (`offers`)** and is
managed entirely from **Admin → Content**. Nothing is hardcoded.

The CMS has two pages:

1. **`admin/content.html` — the content list.** Search, category
   filter (Games / Apps / Websites / Offers), status filter
   (Published / Draft), and per-row actions: publish/unpublish,
   feature/unfeature, reorder (↑ ↓), edit, delete.
2. **`admin/content-form.html` — the add/edit form.** One full-page
   form (not a tiny dialog) with every field, live image previews and
   a validation summary. Reaching it:
   - **New content** → the *New content* button on the list page.
   - **Edit** → the *Edit* button on any row
     (`content-form.html?id=<documentId>`).

### The form fields

| Field | What it controls | Required |
|---|---|---|
| **Category** | Game / App / Website / Offer — decides which page the item appears on | ✓ |
| **Title** (+ Arabic) | Card title, details heading, admin list | ✓ |
| **Short description** (+ Arabic) | The 1–2 lines shown on cards | – |
| **Full description** (+ Arabic) | The body text on the details page (falls back to the short description) | – |
| **Reward (USD)** | Amount credited after approval, e.g. `0.50` | ✓ |
| **Difficulty** | Easy / Medium / Hard badge | ✓ |
| **Estimated time** (+ Arabic) | e.g. `10–15 minutes` | – |
| **Requirements** (+ Arabic) | One per line; the first shows on cards | – |
| **Instructions** (+ Arabic) | Step-by-step guide on the details page | – |
| **Thumbnail image** | Upload (JPG/PNG/WebP ≤ 5 MB) or paste a URL | – |
| **Banner image** | Optional wide image at the top of the details page | – |
| **Status** | **Published** (live) or **Draft** (hidden everywhere) | ✓ |
| **Featured** | Show in the homepage + dashboard *Featured* sections | – |
| **Display order** | Number; lower appears first (e.g. 1, 2, 3…) | – |

### Automatic placement — how it works

The category decides where content appears, with zero extra steps:

- **Category = Game** → appears on `games.html`, in the homepage
  *Games* group, the *Games* tab of `offers.html`, and the admin
  dashboard *Games* counter.
- **Category = App** → `apps.html` + the same surfaces for apps.
- **Category = Website** → `websites.html` + the same surfaces.
- **Category = Offer** → the *Offers* tab of `offers.html`, the
  homepage *Offers* group, and the admin *Offers* counter.

All four category pages read the same collection with
`where("category", "==", …)` and order by `displayOrder` — so a new
item shows up on the right page **the moment you save it**.

---

## 5. How to add a new Game / App / Website / Offer

1. Sign in at **`/admin/login.html`**.
2. Open **Content** in the sidebar → click **New content**.
3. Pick the **Category** (Game / App / Website / Offer).
4. Fill the form — title and reward are the only required fields; see
   the table above for what every field does.
5. Choose the **Status**:
   - **Published** — visible immediately everywhere.
   - **Draft** — saved but hidden from the website (finish it later).
6. Optionally mark it **Featured** and set a **Display order**.
7. Click **Save**. You return to the content list and the item is
   live (if published) on its category page instantly.

**Tips**

- Arabic fields are optional — English is shown to Arabic visitors
  when a field's Arabic twin is empty.
- Images: upload a file (stored in your Firebase Storage) or paste a
  hosted URL. Leave the thumbnail empty for an auto-generated cover.
- Creating many items fast: after saving you land back on the list —
  *New content* is one click away.

---

**Tip — similar to an existing item?** Use the **Duplicate** button on
the content list: it copies every field (images included) into a new
*draft* titled “… (copy)” that stays invisible until you publish it.

## 6. How to edit content

**Admin → Content → Edit** (on the row you want to change). The form
opens pre-filled with everything, including current images.

- **Replace an image** — upload a new file (or paste a new URL) and
  save. The new URL is written to Firestore, and every surface
  (cards, details page, admin lists) shows the new image immediately.
- **Change the reward** — the new amount applies to **future**
  approvals. Each submission snapshots the reward at submission time,
  so history stays honest.
- **Change instructions / requirements / descriptions** — plain text
  areas; requirements are one per line.
- **Change category** — moving a Game to the Apps page is just
  selecting *App* in the form and saving.
- **Change display order** — either edit the number in the form, or
  use the **↑ / ↓** arrows on the list rows to swap with the
  neighbouring item in the same category.

Changes go live the moment you press **Save** — there is no publish
queue and no cache to clear (visitors may need a page refresh).

---

## 7. How to delete content

**Admin → Content → Delete** (on the row) — or the **Delete** button
inside the edit form.

- A **confirmation dialog** always appears first ("This permanently
  removes the content from the website. This cannot be undone."), so
  accidental clicks are impossible.
- Prefer **Unpublish** (move to Draft) when you only want to hide an
  item temporarily — the content stays intact.
- Old submissions keep their snapshot of the title/reward, so history
  stays readable after a deletion.

---

## 8. Draft & publish, featured, and display order

These three controls shape what the public sees:

- **Draft vs Published.** `status` is the source of truth. Draft
  content is excluded from *every* public list by the query itself
  (`active == true`) **and** by `firestore.rules` (guests cannot even
  `get` a draft document by id). Publishing is one click on the list
  row; unpublishing reverses it without deleting anything.
- **Featured.** Featured + published items appear in the **homepage
  featured strip** and the **dashboard featured section** (which
  tops up with the latest published content when fewer than six
  items are featured). The homepage strip hides itself entirely when
  nothing is featured — no empty marketing blocks.
- **Display order.** A number per item (default `100`). Public lists
  sort by `displayOrder` ascending, then newest first. The admin
  list's ↑/↓ arrows swap the numbers of two neighbouring items, so
  reordering never requires typing.

---

## 9. Admin system (login, accounts, roles)

### How admin login works

- The admin panel lives under **`/admin/`** with its own login page —
  **email/username + password only**. There is deliberately no Google
  button, per the platform's requirements.
- After Firebase signs the account in, the app **checks the `role`**
  on the account's `users/{uid}` document. If it is not `admin`, the
  session is signed out immediately and the page shows "This account
  does not have administrator access."
- Every admin page re-runs this role check on load (a *route guard*).
  The guard is navigation convenience — the **real** security is
  `firestore.rules`, which only lets `role == "admin"` accounts read
  other users' data or write content/transactions.
- Admin sessions are separate browser sessions from the normal site —
  logging out of the admin panel does not log you out of the user
  site, and vice versa.

### How to create new admin accounts

Admins are normal accounts with an extra `role` field. **The role can
only be granted from the Firebase console** — the website offers no
way to promote anyone (this is a security guarantee, not a limitation
of the UI).

One-time setup per admin:

1. Go to the [Firebase console](https://console.firebase.google.com) →
   project **the-app-01** → **Authentication → Users → Add user**.
   Enter the admin's email and a strong password.
2. Copy the new user's **User UID** (shown in the users table).
3. Go to **Firestore Database → Start collection** (or open it) →
   collection `users` → **paste the UID as the document ID** (this is
   important) and add fields:

   | Field | Value |
   |---|---|
   | `uid` | *(the same UID — string)* |
   | `email` | *(the admin email — string)* |
   | `displayName` | *(e.g. `Site Admin` — string)* |
   | `photoURL` | `null` |
   | `role` | **`admin`** *(exactly, lowercase)* |
   | `preferredLanguage` | `en` |
   | `createdAt` | *(timestamp)* |
   | `updatedAt` | *(timestamp)* |

4. Done. That account can now sign in at `/admin/login.html` and use
   the whole admin panel.

**Optional — a short username for login:** create a document in
collection `adminUsernames` with the document ID set to the username
(e.g. `admin`) and one field `email` = the admin's email. The admin
can then type `admin` instead of the full email.

**Removing admin access:** change `role` from `admin` to `user` in
the console. Takes effect immediately.

### How roles work

There are exactly two roles, stored on `users/{uid}.role`:

| Role | Can do |
|---|---|
| `user` (default) | Browse published content, submit proof, withdraw, manage their own profile/notifications |
| `admin` (console-granted only) | Everything above **plus**: manage all content (CMS), review submissions, approve/reject withdrawals, adjust wallets, manage users |

The rules enforce that no client can ever write `role` — it is
compared against the existing document on every profile update and
locked to `"user"` at creation.

---

## 10. How Firestore collections work

### `users/{uid}` — one document per account

`uid`, `email`, `displayName`, `photoURL`, `role`
(`"user"` | `"admin"`), `preferredLanguage`, `createdAt`, `updatedAt`.

### `offers/{id}` — one document per content item (the CMS)

| Field | Type | Meaning |
|---|---|---|
| `title`, `titleAr` | string | Localized title |
| `description`, `descriptionAr` | string | Short description (cards) |
| `fullDescription`, `fullDescriptionAr` | string | Details-page body |
| `category` | `"game"` \| `"app"` \| `"website"` \| `"offer"` | Placement |
| `reward` | number | USD credited on approval |
| `difficulty` | `"easy"` \| `"medium"` \| `"hard"` | Badge |
| `estimatedTime`, `estimatedTimeAr` | string | Human-readable time |
| `requirements`, `requirementsAr` | string[] | One entry per line |
| `instructions`, `instructionsAr` | string | Step-by-step guide |
| `image` | string \| null | Thumbnail URL (Storage or hosted) |
| `banner` | string \| null | Wide banner URL (details page) |
| `status` | `"draft"` \| `"published"` | Source of truth for visibility |
| `active` | boolean | Mirror of `status == "published"` (kept in sync by the service; public queries filter on it) |
| `featured` | boolean | Homepage + dashboard featured sections |
| `displayOrder` | number | Lower shows first |
| `createdBy`, `createdAt`, `updatedAt` | uid, timestamps | Audit |

### `taskSubmissions/{id}` — one document per proof submission

`userId`, `userName`, `email`, `offerId`, `offerTitle`, `taskTitle`,
`message`, `walletNumber`, `proofImages` (Storage URLs, ≤ 5),
`rewardSnapshot` (the reward promised at submission time), `status`
(`pending` → `approved`/`rejected`), `rejectionReason`, `reviewedBy`,
`reviewedAt`, timestamps.

### `transactions/{id}` — the wallet ledger (append-only)

`userId`, `type` (`reward` | `withdrawal` | `adjustment`), `amount`,
`description`, `createdBy`, optional `submissionId`/`offerId`/
`withdrawalId`, `createdAt`. Admin-write-only; no updates or deletes
ever.

### `withdrawals/{id}` — payout requests

`userId`, `userName`, `email`, `amount`, `walletNumber`, `status`
(`pending` → `approved`/`rejected`), `rejectionReason`, `reviewedBy`,
`reviewedAt`, timestamps.

### `notifications/{id}` — the user's in-app inbox

`userId`, `type`, `title`, `body`, `read`, `createdAt`. Users can only
flip `read` to `true`.

### `config/telegram` — Telegram bot settings (admin-only)

`enabled`, `botToken`, `chatId`.

### `adminUsernames/{username}` — optional admin login aliases

One field: `email`. Created via the console only.

---

## 11. How Storage works (uploads & replacement)

Three folders, all governed by `storage.rules`:

| Folder | Who writes | Who reads | Used for |
|---|---|---|---|
| `offer-images/thumbnail/…` | admins | **public** | Card/list thumbnails |
| `offer-images/banner/…` | admins | **public** | Details-page banners |
| `proofs/{userId}/…` | the owner (≤ 5 MB, images only) | owner + admins | Submission proof images |
| `avatars/{userId}/…` | the owner (≤ 2 MB) | public | Profile pictures |

**Image uploads:** the CMS form uploads the picked file to the right
folder and stores the resulting **download URL in the Firestore
document** — the URL is the single source of truth for what renders.

**Image replacement:** upload a new file (or paste a new URL) on the
edit form and save. The document now points at the new URL, and every
surface that renders the content updates automatically — cards,
category pages, the details page, admin lists. Old files remain in
Storage (harmless; delete them from the Firebase console if you want).

---

## 12. The main user flow

1. **Discover** — the homepage shows the featured strip and one group
   per category; each group links to its dedicated page
   (`games.html`, `apps.html`, `websites.html`, `offers.html`).
2. **Sign up** — email + password (with email verification) or Google.
3. **Open a content item** — the details page shows the banner (if
   any), full description, requirements, instructions, reward,
   difficulty and estimated time.
4. **Complete the task** and **submit proof** — task title, optional
   message, wallet number, and up to 5 proof images.
5. **Verification** — the submission is reviewed through the
   platform's verification process; the decision arrives as an
   in-app notification (and optionally a Telegram message to the
   admin team).
6. **Get paid** — approved rewards create a wallet transaction
   atomically with the decision. The user withdraws whenever ready;
   withdrawal requests go through the same verification process.

---

## 13. How translations work (EN / AR)

- Every translatable string carries a key in the markup, e.g.
  `<h1 data-i18n="dashboard.title">Dashboard</h1>`. Attributes can be
  translated too: `data-i18n-placeholder`,
  `data-i18n-aria-label`, `data-i18n-title`, and
  `<meta name="i18n-title">` for the browser tab title.
- **`i18n.js`** holds both catalogues (English and Arabic — kept
  in exact 1:1 parity, 635 keys each) and applies them to the whole
  page.
- **Admin-authored content** (titles, descriptions, requirements…)
  is stored *with the content itself* (`titleAr` and friends) and
  picked automatically, falling back to English when an Arabic field
  is empty.
- The visitor's language choice is stored under `theapp.locale` and
  re-applied on every visit. The page's `dir` switches to `rtl` for
  Arabic before first paint, so the layout never flips visibly. All
  layout uses CSS logical properties, so RTL mirrors automatically.
- Money and dates are formatted per locale (`format.js`); Arabic
  uses Latin digits so amounts stay readable (`$0.50`-style).

### How to edit English text

Find the key in the `en:` block of `i18n.js` and change the value.

### How to edit Arabic text

Same, in the `ar:` block — keep both blocks in sync (add a key to
both). To change the *content* wording (not interface), edit the
content in the admin CMS instead — its Arabic fields are the
translation for that item.

---

## 14. Frequently Updated Content

The dedicated cheat-sheet for day-to-day operations. **All of the
below is data, not code** — change it in the admin panel and it
updates the live site immediately:

| I want to change… | Where to go |
|---|---|
| **Rewards** | Admin → Content → *Edit* → *Reward (USD)* |
| **Instructions** | Admin → Content → *Edit* → *Instructions* (+ Arabic twin) |
| **Requirements** | Admin → Content → *Edit* → *Requirements* (one per line) |
| **Images** (thumbnail / banner) | Admin → Content → *Edit* → *Media* → upload or paste URL |
| **Descriptions** (short / full) | Admin → Content → *Edit* → *Content* section |
| **Categories** (move an item between pages) | Admin → Content → *Edit* → *Category* |
| **What's featured** | Admin → Content → the ★ button on a row (or the form's *Featured* checkbox) |
| **Sort order on the site** | Admin → Content → the ↑/↓ arrows (or the form's *Display order*) |
| **What's visible at all** | Admin → Content → *Publish* / *Unpublish* |

Things that *are* in code (rarely changed):

| I want to change… | File(s) to edit |
|---|---|
| Any button/label/heading text | `i18n.js` (EN + AR blocks) |
| Colors, fonts, radius, spacing | `style.css` (the `:root` token block at the top) |
| Layout at phone/tablet/desktop sizes | `responsive.css` |
| Minimum withdrawal amount | `MIN_WITHDRAWAL` in `withdrawals-service.js` |
| Proof-image limits (count/size) | `submissions-service.js` + `storage.rules` |
| The demo content (shown before real content exists) | `demoOffers()` in `offers.js` |
| Firebase project | `firebase-config.js` |
| Who may do what | `firestore.rules` / `storage.rules` |
| Telegram message wording | `telegram-service.js` |

---

## 15. How to configure Firebase

The site is already wired to project **`the-app-01`**. All
browser-safe credentials live in **`firebase-config.js`** — an API
key, project id, and similar identifiers. These are public by design
(every Firebase web app ships them); access is controlled by the
security rules, not by hiding keys. **Never** put a service-account
key or Admin SDK credential in this repository.

To point the site at a **different** Firebase project:

1. Firebase console → Project settings → **Your apps** → Web app →
   copy the `firebaseConfig` values.
2. Paste them into `firebase-config.js`.
3. In the console for that project, enable:
   - **Authentication** → Sign-in method → **Email/Password** and
     **Google**.
   - **Firestore Database** → create it (production mode).
   - **Storage** → create it.
4. Deploy the rules and indexes so the database is locked down:
   `firebase deploy --only firestore:rules,firestore:indexes,storage`
5. Deploy the site: `firebase deploy --only hosting`.

To work on this project you need the Firebase CLI
(`npm install -g firebase-tools`) and a Google account with access to
the project. The `.firebaserc` file binds the folder to project
`the-app-01`.

---

## 16. How to configure the Telegram bot

The admin panel can send Telegram messages about submission and
withdrawal decisions (approvals/rejections) to a private admin group.

1. In Telegram, talk to **@BotFather** → `/newbot` → follow the
   prompts → you receive a **bot token** (looks like
   `123456789:AAF…`).
2. Create a Telegram **group** for the admin team, add the new bot to
   it, and send any message in the group.
3. Find the group's **chat id**: open
   `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser and
   look for `"chat":{"id":-100…}` (a negative number).
4. In the **Firebase console → Firestore → Start collection**:
   - Collection ID: `config`
   - Document ID: `telegram`
   - Fields: `enabled` (boolean) = `true`, `botToken` (string) =
     your token, `chatId` (string) = the negative chat id.
5. That's it. The next approve/reject in the admin panel sends a
   summary message to the group.

**How it works / security notes:**

- The code lives in **`telegram-service.js`** — fully
  separated from UI. It exposes reusable functions:
  `sendMessage()`, `sendSubmissionNotification()`,
  `sendWithdrawalNotification()`.
- The `config/telegram` document is **admin-only** in
  `firestore.rules`, so only admin browsers can read the token.
- Messages are sent **from the admin client** when a review decision
  is made. If you also want a ping the moment a *user submits*, see
  [Future expansion](#19-future-expansion-guide) — the recommended
  approach is a small Cloud Function so the token never reaches user
  browsers.
- To silence notifications, set `enabled` to `false` — no code change.

---

## 17. How to deploy the project

Deployment is a file copy — any static host works (Firebase Hosting,
Netlify, GitHub Pages…). For the configured Firebase project:

```bash
firebase deploy --only hosting,firestore:rules,firestore:indexes,storage
```

- `hosting` publishes the HTML/CSS/JS as-is (no build step).
- `firestore:rules` publishes the database security rules.
- `firestore:indexes` creates the composite indexes the lists need —
  **five** of them for the `offers` collection alone (ordered public
  lists, per-category lists, the featured query, plus the legacy
  createdAt ordering).
- `storage` publishes the storage security rules.

First time with the CLI? Then:

```bash
npm install -g firebase-tools
firebase login          # opens the browser
firebase deploy --only hosting,firestore:rules,firestore:indexes,storage
```

After deploying indexes, the first page loads may take a minute while
indexes build (visible in the console). Custom domain, caching, and
preview channels are configured in the Firebase console → Hosting.

**After any change**: because there is no build step, deploying again
is enough. Users may need a hard refresh (Ctrl/Cmd+Shift+R) to bypass
cached files.

---

## 18. Security model

- **Authentication** — Firebase Authentication only; no mock logins,
  no session flags in storage anywhere.
- **Users cannot create money.** The `transactions` collection is
  admin-write-only. Balances are computed from the ledger server data;
  amounts typed in any browser form are never trusted.
- **Approvals are atomic.** Approving a submission/rejecting/adjusting
  writes status + transaction + notification in ONE Firestore batch —
  no half-completed decisions.
- **The credited reward is re-read from the live content document** at
  approval time, not taken from the submission form.
- **No self-promotion.** `role` is locked to `"user"` at profile
  creation and can never be changed by any client — only via the
  Firebase console/Admin SDK (see section 9).
- **Drafts are invisible by rule, not just by UI.** Public queries
  filter `active == true`, and `firestore.rules` refuses non-admin
  reads of any content document that is not published.
- **Proofs are private.** Storage rules let only the owner and admins
  read `proofs/…`; content images and avatars are public.
- **Submissions are immutable** to their owner after creation (except
  completing the image upload), and can never be deleted.
- **Username enumeration protection.** Wrong password and unknown
  account show the same message on every login form.

---

## 19. Future expansion guide

The architecture intentionally leaves clean seams for growth:

- **Adding a new category** (e.g. "Surveys") is a three-step change:
  1. add the value to `CATEGORIES` in `offers.js` (and a
     `categories.<value>` label in both i18n blocks),
  2. allow it in the `offers` rules in `firestore.rules`
     (the `category in [...]` lists),
  3. add an `<option>` to the category select in
     `admin/content-form.html` — and, if you want a dedicated page,
     copy `games.html` and point `data-category` at the new value
     (the shared controller `category.js` does the rest).
- **New content types beyond the four categories** (e.g. articles,
  videos): add a new collection + service in the root-level service modules, a page
  controller in ``, and matching rules. The CMS pattern
  (list page + form page + service) is designed to be copied.
- **New admin tools**: add a page under `admin/`, register it in
  `ADMIN_PAGES` in `admin.js`, and add its sidebar link —
  the role guard applies automatically.
- **Server-side Telegram pings on submission** — add a Cloud Function
  on `taskSubmissions` creation that calls the same Telegram API.
- **Materialized balances** — for very large ledgers, add a Cloud
  Function maintaining `users/{uid}.balance` on transaction writes;
  the UI already isolates balance math in
  `wallet-service.js` → `computeUserBalance`, so it's a one-file change.
- **Full-text user search** — user search currently filters the
  fetched list client-side (fine to a few thousand users). Beyond
  that, plug in Algolia/Typesense via an extension.
- **Realtime updates** — swap `getDocs` for `onSnapshot` in the
  services to make admin queues and dashboards live-update.
- **Scheduled content** — `status` + a `publishAt` timestamp with a
  Cloud Function flip would add scheduled publishing without touching
  the UI.
- **Pagination** — lists currently fetch the newest 60–200 documents;
  `startAfter` cursors can be added per service when data grows.
- **Terms / privacy pages** — the footer already reserves the slot.

---

## 20. Known limitations

- **Testing note:** this repository was finished in an environment
  whose network blocks `gstatic.com` (the Firebase SDK CDN). What was
  verified here: HTML structure validation of all 24 pages, JS syntax
  of all 37 modules, i18n catalogue parity (every EN key has an AR
  twin; every key used by any page exists), and automated harnesses —
  a DOM harness that boots pages with the real code (clean boot,
  EN/AR switching, RTL, demo fallbacks, guest/protected redirects,
  admin login validation, no-Google on admin login) and an
  in-memory fake-Firestore harness that drives the real services
  through the full flow (profile creation, submission + proof upload,
  atomic approval with wallet transaction + notification, balance
  math, manual adjustment, withdrawal approve/reject, role checks).
  Live sign-in and reads against the real `the-app-01` project should
  be exercised once from a normal network before launch.
- **Composite indexes must be deployed** (`firebase deploy --only
  firestore:indexes`) before the ordered/featured queries work in
  production — Firestore links shown in console errors during local
  development make this a one-click fix.
- **Firestore `list` for admins** joins user names onto transactions
  client-side; with thousands of users, move that join server-side.
- **Minimum withdrawal** is a client-side constant plus admin review;
  rules cannot sum a balance, so a user *can* attempt to over-request
  — the request still cannot pay out without admin approval, and the
  approve dialog warns when the balance is short.
- **Email verification for Google accounts** is trusted from Google
  (standard practice).
- **Reordering uses two sequential writes** (a swap) rather than a
  transaction — a failure between them leaves both items visible but
  possibly unsorted until retried. The list re-renders from source
  after every action, so the state is always readable.

---

## 21. UI/UX design system — where to make visual edits

This section maps the visual system to its source of truth. Content owners
should use **Admin → Content** for opportunities; visual edits belong in the
files below.

### Brand identity

The logo is a typography-only **The App** wordmark. “The” uses a quieter
weight and “App” carries the stronger weight. There is no icon mark, so the
identity cannot be mistaken for a chat or messaging app.

- Markup: the `.brand__wordmark` span in the public and admin HTML headers
  and footers.
- Size, weight and color: `.brand__wordmark*` in `components.css`.
- Favicon: `favicon.svg`.

### Hero and navigation

- `index.html` owns the hero structure: the title uses the translation keys
  `hero.play`, `hero.win` and `hero.earn`.
- `style.css` owns the stagger amount (`--hero-indent`), hero spacing and
  section backgrounds. Logical properties keep the stagger correct in Arabic.
- Every public page carries the same desktop navigation. `navigation.js`
  marks the current item with `aria-current`; authenticated actions are
  populated by `auth.js`.

### Opportunity cards

The `<template id="offer-card-template">` in the pages that display cards
owns the editable card anatomy. `offers.js` fills that template with the CMS
thumbnail, category, requirement, reward, estimated time, difficulty and CTA.
Generated cover art is only a fallback when no thumbnail is published.

### Member dashboard and profile

- `dashboard.html` owns the member layout; `dashboard.js` owns the Firebase
  reads and loading/error/empty states.
- `profile.html` owns the simple identity/account layout; `profile.js` keeps
  the existing name and cash-wallet edit flow intact.

### Responsive and admin UI

- `responsive.css` is the only place for public phone/tablet/desktop
  breakpoint rules.
- `admin.css` owns the admin sidebar, topbar, queue rows and responsive drawer.
- `admin/` keeps admin route markup separate from the member-facing pages.
  The CMS form remains the source of truth for add content, image upload,
  category choice and publish behavior.

### Translations and content

- Edit visible product copy in the matching `en` and `ar` keys in `i18n.js`.
  Keep Arabic idiomatic and update both catalogues together.
- Edit live opportunity content, thumbnails and Arabic content variants in
  **Admin → Content**. Do not hardcode new offers in `index.html`.

---

## 22. Production UI/UX refresh — September 2026

The MVP experience has been refined into a calmer, more trustworthy rewards
product without changing the Firebase, Firestore, Storage, authentication,
translation or CMS data flows.

### What changed

- Replaced the illustrated/monoline logo with a typography-only **The App**
  wordmark. It is shared by the public header, mobile navigation, footer and
  admin shell and does not use a chat or messaging symbol.
- Reworked the homepage hero around the staggered three-line message:
  **Play. / Win. / Earn.** The second and third lines step inward in both LTR
  and RTL layouts.
- Refined the visual system to use an editorial ink, white, blue and teal
  palette. Cards, buttons, borders and shadows now feel premium and composed
  rather than neon, crypto-like or gambling-oriented.
- Improved opportunity cards so their thumbnail, category, reward, requirement,
  estimated completion time, difficulty and call to action share a consistent
  rhythm and height. CMS thumbnails still win over generated cover art.
- Restored a dedicated member dashboard route at `dashboard.html` with only
  useful account signals: wallet balance, active opportunities, pending
  reviews and completed rewards, followed by live opportunities and recent
  activity.
- Simplified the profile summary to name, email, wallet balance, cash wallet
  number and logout, while keeping the existing edit flow for the name and
  payout destination.
- Kept the desktop navigation focused on Home, Games, Apps, Websites and
  Offers. Authenticated members also have Dashboard and Profile access; the
  mobile drawer keeps account actions reachable without overcrowding the
  primary menu.
- Restored the admin entry point under `admin/`, including the admin sign-in,
  overview, content list, content form, submission review, wallet ledger,
  users and withdrawal routes. Existing publish, upload, category, featured and ordering behavior
  remains service-backed.
- Audited the static module and stylesheet references so this no-build app can
  be served directly from the repository root. Firebase remains lazy-loaded
  and the app still presents useful loading, empty and offline states when the
  SDK is unavailable.
- Refreshed English and Arabic marketing copy for a human, transparent tone.
  Arabic remains native in wording and RTL behavior rather than being a
  word-for-word mirror of the English.

### Where to make future visual edits

- **Global palette, type scale, spacing and radii:** edit the `:root` tokens at
  the top of `style.css`.
- **Public page sections:** edit the clearly labelled section blocks in
  `style.css` (hero, trust, CTA, footer) and the reusable component blocks in
  `components.css`.
- **Responsive behavior:** keep breakpoint changes in `responsive.css` so
  mobile, tablet and desktop fixes stay auditable in one place.
- **Admin shell and CMS layout:** edit `admin.css` and the HTML files in
  `admin/`. The content form remains the place to add fields, upload images,
  choose a category and publish content.
- **Opportunity cards:** edit the `<template id="offer-card-template">` in
  `index.html`, `offers.html`, the category templates, or the member
  `dashboard.html`; shared data mapping lives in `offers.js` so the cards stay
  consistent.
- **Logo:** edit the `.brand__wordmark` styles in `components.css` and the
  small typography-only wordmark markup in each page header/footer. Keep the
  accessible `aria-label="The App"`.
- **English and Arabic copy:** edit the matching keys in `i18n.js` — update
  both the `en` and `ar` catalogues together. Admin-authored opportunity copy
  belongs in the CMS and is localized through the `titleAr`, `descriptionAr`
  and related fields when present.
- **Dashboard and profile presentation:** edit the main markup in
  `dashboard.html` and `profile.html`; keep Firebase reads and write logic in
  `dashboard.js` and `profile.js`.
- **Data and business rules:** continue using the existing service modules
  (`offers-service.js`, `submissions-service.js`, `wallet-service.js`,
  `withdrawals-service.js` and `users-service.js`). Do not place credentials,
  Firestore writes or Storage rules in presentation files.

The platform remains content-managed: adding or publishing a game, app,
website or offer should be done in **Admin → Content**, not by editing the
homepage or card templates.
