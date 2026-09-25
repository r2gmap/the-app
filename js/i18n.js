// =====================================================================
// Internationalisation (i18n) — English (LTR) + Arabic (RTL)
// =====================================================================
// Markup carries translation keys via data-i18n attributes and never
// duplicated sentences; this module owns both catalogues and applies
// them to the DOM.
//
//   data-i18n              -> element text content
//   data-i18n-placeholder  -> input placeholder
//   data-i18n-aria-label   -> aria-label
//   data-i18n-title        -> title attribute
//   <meta name="i18n-title"> -> document.title
//
// Locale resolves: stored choice -> navigator.languages -> English.
// The chosen locale is stored under "theapp.locale" and persisted.
//
// Dynamic (JS-rendered) content uses t("key", params) so lists and
// toasts localise exactly like static markup. Pages re-render through
// onLocaleChange() when the visitor switches language.
// =====================================================================

// ---------------------------------------------------------------------
// Locale storage + resolution
// ---------------------------------------------------------------------

const SUPPORTED_LOCALES = ["en", "ar"];
const LOCALE_STORAGE_KEY = "theapp.locale";
let currentLocale = resolveInitialLocale();
const listeners = new Set();

/** Picks the starting locale: stored choice, else browser language, else English. */
function resolveInitialLocale() {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (SUPPORTED_LOCALES.includes(stored)) return stored;
  } catch (e) {
    /* storage unavailable */
  }
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of tags) {
    const base = String(tag || "").toLowerCase().split("-")[0];
    if (SUPPORTED_LOCALES.includes(base)) return base;
  }
  return "en";
}

/** Active locale code ("en" or "ar"). */
function getLocale() {
  return currentLocale;
}

/** True when the active locale is right-to-left. */
function isRTL() {
  return currentLocale === "ar";
}

/**
 * Switches the active locale: persists the choice, updates <html lang/dir>,
 * re-applies all translations and notifies dynamic renderers.
 */
function setLocale(locale) {
  if (!SUPPORTED_LOCALES.includes(locale) || locale === currentLocale) return;
  currentLocale = locale;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch (e) {
    /* storage unavailable */
  }
  const root = document.documentElement;
  root.lang = locale;
  root.dir = locale === "ar" ? "rtl" : "ltr";
  applyTranslations();
  for (const listener of listeners) {
    try {
      listener(locale);
    } catch (e) {
      console.error("[i18n] listener failed", e);
    }
  }
}

/** Registers a callback fired on every locale change (returns unsubscribe). */
function onLocaleChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// ---------------------------------------------------------------------
// Translation lookup
// ---------------------------------------------------------------------

/**
 * Returns the translation for a key in the active locale, interpolating
 * {placeholders} from params. Falls back to English, then to the key
 * itself so a missing string is traceable instead of an empty screen.
 */
function t(key, params = null) {
  const entry = CATALOGS[currentLocale]?.[key] ?? CATALOGS.en[key] ?? key;
  if (!params) return entry;
  return String(entry).replace(/\{(\w+)\}/g, (match, name) =>
    params[name] !== undefined && params[name] !== null ? String(params[name]) : match,
  );
}

/**
 * Picks the localized variant of admin-authored content, e.g.
 * localizedText(offer, "title") -> offer.titleAr in Arabic when present.
 */
function localizedText(item, field) {
  if (!item) return "";
  if (currentLocale === "ar") {
    const arValue = item[`${field}Ar`];
    if (arValue && String(arValue).trim()) return arValue;
  }
  const value = item[field];
  return value === undefined || value === null ? "" : String(value);
}

// ---------------------------------------------------------------------
// DOM application
// ---------------------------------------------------------------------

/** Applies translations to the whole document and clears the pre-paint cloak. */
function applyTranslations() {
  const root = document;
  root.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    const value = t(key);
    if (value !== key) node.textContent = value;
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    const value = t(node.getAttribute("data-i18n-placeholder"));
    if (value) node.setAttribute("placeholder", value);
  });
  root.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    const value = t(node.getAttribute("data-i18n-aria-label"));
    if (value) node.setAttribute("aria-label", value);
  });
  root.querySelectorAll("[data-i18n-title]").forEach((node) => {
    const value = t(node.getAttribute("data-i18n-title"));
    if (value) node.setAttribute("title", value);
  });
  const metaTitle = root.querySelector('meta[name="i18n-title"]');
  if (metaTitle) {
    const value = t(metaTitle.getAttribute("content"));
    if (value) document.title = value;
  }
  // The cloak (html.i18n-pending) hides untranslated markup before the
  // first paint for non-English locales; translations are now applied.
  document.documentElement.classList.remove("i18n-pending");
}

// =====================================================================
// Translation catalogues
// =====================================================================
// Sections mirror the site: common -> nav -> landing -> auth -> user
// area -> admin panel. Every key exists in BOTH languages.
// =====================================================================

const CATALOGS = {
  /* ============================== ENGLISH ============================== */
  en: {
    // ------------------------------------------------ common
    "common.skipToContent": "Skip to content",
    "common.demoLabel": "Demo preview",
    "common.demoNotice": "Example content, shown while no live offers are published.",
    "common.loading": "Loading…",
    "common.errorTitle": "Something went wrong",
    "common.errorBody": "We could not load this right now. Please try again.",
    "common.retry": "Try again",
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.close": "Close",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.view": "View",
    "common.search": "Search",
    "common.back": "Back",
    "common.optional": "optional",
    "common.backToDashboard": "Back to dashboard",
    "common.backHome": "Back to home",
    "common.viewAll": "View all",
    "common.featuredLabel": "Featured",

    // ------------------------------------------------ navigation
    "nav.primary": "Main",
    "nav.home": "Home",
    "nav.games": "Games",
    "nav.apps": "Apps",
    "nav.websites": "Websites",
    "nav.offers": "Offers",
    "nav.howItWorks": "How it works",
    "nav.login": "Log in",
    "nav.signUp": "Sign up",
    "nav.logout": "Log out",
    "nav.dashboard": "Dashboard",
    "nav.wallet": "Wallet",
    "nav.notifications": "Notifications",
    "nav.profile": "Profile",
    "nav.submissions": "My submissions",
    "nav.openMenu": "Open menu",

    // ------------------------------------------------ meta titles
    "meta.title": "The App — Play. Try. Earn.",
    "meta.loginTitle": "Welcome back — The App",
    "meta.registerTitle": "Create your account — The App",
    "meta.dashboardTitle": "Dashboard — The App",
    "meta.profileTitle": "Your profile — The App",
    "meta.offersTitle": "Browse offers — The App",
    "meta.offerTitle": "Offer details — The App",
    "meta.walletTitle": "Your wallet — The App",
    "meta.withdrawTitle": "Withdraw funds — The App",
    "meta.notificationsTitle": "Notifications — The App",
    "meta.submissionsTitle": "My submissions — The App",
    "meta.gamesTitle": "Games — The App",
    "meta.appsTitle": "Apps — The App",
    "meta.websitesTitle": "Websites — The App",

    // ------------------------------------------------ 404 page
    "error404.metaTitle": "Page not found — The App",
    "error404.title": "Page not found",
    "error404.body": "The page you are looking for does not exist or may have moved.",
    "error404.cta": "Back to home",

    // ------------------------------------------------ landing: hero
    "hero.play": "Play.",
    "hero.tryIt": "Try.",
    "hero.earn": "Earn.",
    "hero.subtitle": "Discover games, apps and websites, complete a simple task, and earn rewards once your submission is verified.",
    "hero.primaryCta": "Browse rewards",
    "hero.secondaryCta": "How it works",
    "hero.note": "Free to join. No payment required to start.",
    "hero.demo.stepOffer": "Pick an offer",
    "hero.demo.offerTitle": "Space Frontier",
    "hero.demo.offerRequirement": "Reach level 5",
    "hero.demo.stepProof": "Send your proof",
    "hero.demo.proofLabel": "Screenshot uploaded",
    "hero.demo.proofStatus": "In verification",
    "hero.demo.stepReward": "Get paid",
    "hero.demo.walletLabel": "Wallet",
    "hero.demo.walletNote": "Credited after verification",

    // ------------------------------------------------ featured strip (homepage)
    "featured.title": "Featured right now",
    "featured.subtitle": "Hand-picked opportunities, chosen by our team.",

    // ------------------------------------------------ landing: how it works
    "how.title": "Three steps, start to finish",
    "how.subtitle": "Clear requirements, transparent rewards, and a straightforward verification process.",
    "how.step1Title": "Choose a task",
    "how.step1Body": "Find a game or app and pick an available reward.",
    "how.step2Title": "Complete it",
    "how.step2Body": "Follow the requirement, such as reaching a specific level.",
    "how.step3Title": "Get rewarded",
    "how.step3Body": "Submit your proof. Once it passes verification, the reward is credited to your wallet.",

    // ------------------------------------------------ landing: offers
    "offers.title": "Ways to earn",
    "offers.subtitle": "Pick a task that fits you, complete it, and submit your proof.",
    "offers.browseAll": "Browse all offers",
    "offers.rewardLabel": "Reward",
    "offers.requirementLabel": "Requirement",
    "offers.timeLabel": "Estimated time",
    "offers.difficultyLabel": "Difficulty",
    "offers.viewOffer": "View offer",
    "offers.loading": "Loading offers…",
    "offers.emptyTitle": "No rewards published yet",
    "offers.emptyBody": "New rewards are on the way. Check back soon — or explore another category.",
    "offers.errorTitle": "Offers could not be loaded",
    "offers.errorBody": "Check your connection and try again.",

    // ------------------------------------------------ dedicated category pages
    "categoryPage.games.title": "Games",
    "categoryPage.games.subtitle": "Play, complete the objective, and earn — every game lists its reward up front.",
    "categoryPage.apps.title": "Apps",
    "categoryPage.apps.subtitle": "Try quality apps, meet the requirement, and collect your reward.",
    "categoryPage.websites.title": "Websites",
    "categoryPage.websites.subtitle": "Explore websites, finish the task, and get rewarded for your time.",
    "categoryPage.emptyTitle": "No {category} available right now",
    "categoryPage.emptyBody": "New rewards for this category are on the way. Check back soon — or explore another category.",

    // ------------------------------------------------ landing: trust + cta + footer
    "trust.title": "How rewards actually work",
    "trust.subtitle": "Every reward is tied to a task, and every payout is traceable.",
    "trust.tiedTitle": "Rewards are tied to tasks",
    "trust.tiedBody": "Each offer states its requirement and its exact reward before you start.",
    "trust.proofTitle": "You submit proof",
    "trust.proofBody": "Finish the requirement, then upload a screenshot showing it is done.",
    "trust.reviewTitle": "Verified before payout",
    "trust.reviewBody": "Submissions are reviewed through our verification process before rewards are issued.",
    "trust.approvedTitle": "Approved rewards reach your wallet",
    "trust.approvedBody": "An approved submission creates a wallet transaction you can trace back to the offer.",
    "trust.rejectedTitle": "Rejections come with a reason",
    "trust.rejectedBody": "If a submission is rejected, you receive the reason in the app and can try again.",
    "cta.title": "Ready to start?",
    "cta.body": "Create your account and explore the rewards that are available.",
    "cta.button": "Create free account",
    "footer.description": "Complete simple tasks across games, apps and websites, and earn rewards once they're verified.",
    "footer.product": "Product",
    "footer.account": "Account",
    "footer.legal": "Legal",
    "footer.legalSoon": "Terms and privacy pages are being prepared.",
    "footer.rights": "All rights reserved.",

    // ------------------------------------------------ auth
    "auth.notConfiguredTitle": "Sign-in is not configured yet",
    "auth.notConfiguredBody": "Firebase credentials are missing from this environment, so accounts cannot be created or used.",
    "auth.loginTitle": "Welcome back",
    "auth.loginSubtitle": "Log in to continue where you left off.",
    "auth.registerTitle": "Create your account",
    "auth.registerSubtitle": "It takes a minute. You can browse offers straight away.",
    "auth.fields.email": "Email",
    "auth.fields.emailPlaceholder": "you@example.com",
    "auth.fields.password": "Password",
    "auth.fields.passwordPlaceholder": "At least 8 characters",
    "auth.fields.displayName": "Name",
    "auth.fields.displayNamePlaceholder": "How should we address you?",
    "auth.fields.confirmPassword": "Confirm password",
    "auth.loginSubmit": "Log in",
    "auth.registerSubmit": "Create account",
    "auth.google": "Continue with Google",
    "auth.orDivider": "or",
    "auth.forgotPassword": "Forgot password?",
    "auth.forgotPasswordTitle": "Reset your password",
    "auth.forgotPasswordSubtitle": "Enter your email and we'll send you a reset link.",
    "auth.forgotPasswordSentTitle": "Check your email",
    "auth.forgotPasswordSentBody": "If an account uses that address, a password reset link is on its way.",
    "auth.forgotPasswordSubmit": "Send reset link",
    "auth.forgotPasswordBack": "Back to log in",
    "auth.loginSwitchPrompt": "New here?",
    "auth.loginSwitchAction": "Create an account",
    "auth.registerSwitchPrompt": "Already have an account?",
    "auth.registerSwitchAction": "Log in",
    "auth.errors.fieldRequired": "This field is required.",
    "auth.errors.invalidEmail": "Enter a valid email address.",
    "auth.errors.weakPassword": "Use at least 8 characters.",
    "auth.errors.passwordMismatch": "Passwords do not match.",
    "auth.errors.invalid-credential": "Incorrect email or password.",
    "auth.errors.invalid-login-credentials": "Incorrect email or password.",
    "auth.errors.wrong-password": "Incorrect email or password.",
    "auth.errors.user-not-found": "Incorrect email or password.",
    "auth.errors.invalid-email": "Enter a valid email address.",
    "auth.errors.email-already-in-use": "An account already uses this email.",
    "auth.errors.weak-password-firebase": "Use at least 8 characters.",
    "auth.errors.too-many-requests": "Too many attempts. Wait a moment and try again.",
    "auth.errors.network-request-failed": "Network problem. Check your connection and try again.",
    "auth.errors.popup-closed-by-user": "The Google window was closed before finishing.",
    "auth.errors.cancelled-popup-request": "The Google window was closed before finishing.",
    "auth.errors.popup-blocked": "Your browser blocked the Google window. Allow popups and try again.",
    "auth.errors.operation-not-allowed": "This sign-in method is not enabled yet. Contact the site admin.",
    "auth.errors.generic": "Something went wrong. Please try again.",

    // ------------------------------------------------ email verification
    "verify.title": "Verify your email",
    "verify.loadingTitle": "Checking your session",
    "verify.guestTitle": "You need to log in first",
    "verify.guestBody": "Log in or create an account to verify an email address.",
    "verify.subtitle": "We sent a verification link to:",
    "verify.instructions": "Open the link in that email to verify your address. Check your spam folder if it does not arrive within a few minutes.",
    "verify.resendSentTitle": "Verification email sent",
    "verify.stillUnverified": "Still not verified. Check your inbox, or resend the email.",
    "verify.checkVerification": "I verified my email",
    "verify.resend": "Resend verification email",
    "verify.resendIn": "Resend available in {seconds}s",
    "verify.logout": "Log out",
    "verify.verifiedTitle": "Your email is verified",
    "verify.verifiedBody": "You're all set. Your dashboard is ready.",
    "verify.goHome": "Go to dashboard",

    // ------------------------------------------------ categories / statuses / difficulty
    "categories.game": "Game",
    "categories.app": "App",
    "categories.website": "Website",
    "categories.offer": "Offer",
    "categories.all": "All offers",
    "categoriesPlural.game": "Games",
    "categoriesPlural.app": "Apps",
    "categoriesPlural.website": "Websites",
    "categoriesPlural.offer": "Offers",
    "status.pending": "Pending",
    "status.approved": "Approved",
    "status.rejected": "Rejected",
    "difficulty.easy": "Easy",
    "difficulty.medium": "Medium",
    "difficulty.hard": "Hard",

    // ------------------------------------------------ user dashboard
    "dashboard.welcome": "Welcome back",
    "dashboard.subtitle": "Your rewards, activity and opportunities at a glance.",
    "dashboard.stats.wallet": "Wallet balance",
    "dashboard.stats.completed": "Completed tasks",
    "dashboard.stats.pending": "Pending reviews",
    "dashboard.featured.title": "Featured opportunities",
    "dashboard.featured.subtitle": "Active offers you can complete right now.",
    "dashboard.featured.viewAll": "View all offers",
    "dashboard.activity.title": "Recent activity",
    "dashboard.activity.viewAll": "View all submissions",
    "dashboard.quick.title": "Quick actions",
    "dashboard.quick.browseGames": "Browse games",
    "dashboard.quick.browseApps": "Browse apps",
    "dashboard.quick.browseWebsites": "Browse websites",
    "dashboard.quick.browseOffers": "Browse offers",
    "dashboard.quick.profile": "Profile",
    "dashboard.quick.withdraw": "Withdraw",
    "dashboard.empty.featuredTitle": "No rewards available yet",
    "dashboard.empty.featuredBody": "The team is preparing new opportunities. You will see them here as soon as they go live.",
    "dashboard.empty.activityTitle": "No submissions yet",
    "dashboard.empty.activityBody": "Pick your first offer, complete the task, and submit your proof — it will appear here.",

    // ------------------------------------------------ offers browser page
    "offersPage.title": "Browse offers",
    "offersPage.subtitle": "Games, apps, websites and offers — pick a task, complete it, get rewarded.",
    "offersPage.loading": "Loading offers…",
    "offersPage.emptyTitle": "No rewards in this category yet",
    "offersPage.emptyBody": "No offers match this category right now. Try another category or check back soon.",
    "offersPage.errorTitle": "Offers could not be loaded",
    "offersPage.errorBody": "Check your connection and try again.",

    // ------------------------------------------------ offer details page
    "offer.aboutTitle": "About this offer",
    "offer.requirementsTitle": "Requirements",
    "offer.instructionsTitle": "Instructions",
    "offer.categoryLabel": "Category",
    "offer.rewardLabel": "Reward",
    "offer.timeLabel": "Estimated time",
    "offer.difficultyLabel": "Difficulty",
    "offer.notFoundTitle": "Offer not found",
    "offer.notFoundBody": "This offer may have ended or the link is incorrect.",
    "offer.notFoundCta": "Browse available offers",
    "offer.signInTitle": "Log in to start this task",
    "offer.signInBody": "Create a free account or log in to complete this offer and earn the reward.",
    "offer.signInCta": "Log in",
    "offer.signUpCta": "Create free account",
    "offer.verifyTitle": "Verify your email first",
    "offer.verifyBody": "Confirm your email address to unlock task submissions.",
    "offer.verifyCta": "Verify email",
    "offer.pendingTitle": "Your submission is being verified",
    "offer.pendingBody": "Your proof for this offer is in the verification queue. The decision will arrive in your notifications.",
    "offer.submit.title": "Submit your proof",
    "offer.submit.subtitle": "Complete the task first, then send the details below.",
    "offer.submit.taskTitle": "Task title",
    "offer.submit.taskTitlePlaceholder": "e.g. Reached level 5 in Space Frontier",
    "offer.submit.taskTitleHint": "A short title describing what you completed.",
    "offer.submit.message": "Message",
    "offer.submit.messagePlaceholder": "Details that help verify your completion…",
    "offer.submit.messageHint": "Optional — a clear message speeds up verification.",
    "offer.submit.walletNumber": "Wallet number",
    "offer.submit.walletNumberPlaceholder": "Your payout wallet ID",
    "offer.submit.walletNumberHint": "Used to send your payout after verification.",
    "offer.submit.proofImages": "Proof images",
    "offer.submit.proofHint": "Up to 5 images (JPG, PNG, WebP), max 5 MB each.",
    "offer.submit.addImages": "Add images",
    "offer.submit.removeImage": "Remove image",
    "offer.submit.submit": "Submit proof",
    "offer.submit.uploading": "Uploading proof…",
    "offer.submit.successTitle": "Proof submitted",
    "offer.submit.successBody": "Your submission is now in the verification queue. You will be notified as soon as the review is complete.",
    "offer.submit.successCta": "View my submissions",
    "offer.submit.errors.taskTitleRequired": "Enter a short task title.",
    "offer.submit.errors.walletRequired": "Enter your wallet number.",
    "offer.submit.errors.imagesRequired": "Attach at least one proof image.",
    "offer.submit.errors.fileTooLarge": "\"{name}\" is larger than 5 MB.",
    "offer.submit.errors.tooManyFiles": "Up to 5 images allowed.",
    "offer.submit.errors.invalidType": "\"{name}\" is not a supported image.",
    "offer.submit.errorTitle": "Submission failed",
    "offer.submit.errorBody": "Your proof was not sent. Check your connection and try again.",

    // ------------------------------------------------ my submissions
    "submissions.title": "My submissions",
    "submissions.subtitle": "Every proof you sent, and where it stands.",
    "submissions.offerLabel": "Offer",
    "submissions.rewardLabel": "Reward",
    "submissions.submittedLabel": "Submitted",
    "submissions.reviewedLabel": "Reviewed",
    "submissions.reasonLabel": "Reason",
    "submissions.statusLabel": "Status",
    "submissions.emptyTitle": "No submissions yet",
    "submissions.emptyBody": "Pick a task, complete it, and submit your proof — everything you send shows up here.",
    "submissions.emptyCta": "Browse offers",

    // ------------------------------------------------ wallet
    "wallet.title": "Your wallet",
    "wallet.subtitle": "Rewards land here after verification. Withdraw whenever you're ready.",
    "wallet.balance": "Current balance",
    "wallet.withdrawCta": "Withdraw funds",
    "wallet.historyTitle": "Transaction history",
    "wallet.historySubtitle": "Every reward, withdrawal and adjustment on your account.",
    "wallet.emptyTitle": "No transactions yet",
    "wallet.emptyBody": "Your first reward appears here as soon as a submission is verified.",
    "transaction.type.reward": "Task reward",
    "transaction.type.withdrawal": "Withdrawal",
    "transaction.type.adjustment": "Manual adjustment",
    "wallet.descriptionLabel": "Description",
    "wallet.dateLabel": "Date",

    // ------------------------------------------------ withdrawals
    "withdraw.title": "Withdraw funds",
    "withdraw.subtitle": "Requests go through a standard verification process and are typically completed within a few days.",
    "withdraw.amount": "Amount (USD)",
    "withdraw.amountPlaceholder": "e.g. 5.00",
    "withdraw.walletNumber": "Wallet number",
    "withdraw.walletNumberPlaceholder": "Where should we send your money?",
    "withdraw.available": "Available to withdraw",
    "withdraw.submit": "Request withdrawal",
    "withdraw.successTitle": "Withdrawal requested",
    "withdraw.successBody": "Your request is now in verification. You'll be notified once it's processed.",
    "withdraw.requestsTitle": "Your withdrawal requests",
    "withdraw.requestsSubtitle": "Track each request from submission to payout.",
    "withdraw.emptyTitle": "No withdrawal requests",
    "withdraw.emptyBody": "Your withdrawal requests will appear here once you make one.",
    "withdraw.errors.amountRequired": "Enter an amount.",
    "withdraw.errors.amountInvalid": "Enter a valid amount.",
    "withdraw.errors.minimum": "The minimum withdrawal is {amount}.",
    "withdraw.errors.insufficient": "This amount is more than your available balance.",
    "withdraw.errors.walletRequired": "Enter your wallet number.",
    "withdraw.errorTitle": "Request failed",
    "withdraw.errorBody": "Your withdrawal request was not sent. Please try again.",

    // ------------------------------------------------ notifications
    "notifications.title": "Notifications",
    "notifications.subtitle": "Decisions on your submissions and withdrawals land here.",
    "notifications.markAllRead": "Mark all as read",
    "notifications.unreadCount": "{count} unread",
    "notifications.markRead": "Mark as read",
    "notifications.emptyTitle": "No notifications yet",
    "notifications.emptyBody": "You will be notified here when a submission or withdrawal is reviewed.",
    "notifications.types.submission_approved.title": "Submission approved 🎉",
    "notifications.types.submission_approved.body": "Your proof for \"{offer}\" was approved. {amount} was added to your wallet.",
    "notifications.types.submission_rejected.title": "Submission rejected",
    "notifications.types.submission_rejected.body": "Your proof for \"{offer}\" was rejected. Reason: {reason}",
    "notifications.types.withdrawal_approved.title": "Withdrawal approved",
    "notifications.types.withdrawal_approved.body": "Your withdrawal of {amount} was approved and is being processed.",
    "notifications.types.withdrawal_rejected.title": "Withdrawal rejected",
    "notifications.types.withdrawal_rejected.body": "Your withdrawal of {amount} was rejected. Reason: {reason}",

    // ------------------------------------------------ profile
    "profile.title": "Your profile",
    "profile.subtitle": "Your details and account standing.",
    "profile.name": "Full name",
    "profile.email": "Email",
    "profile.walletBalance": "Wallet balance",
    "profile.completedTasks": "Completed tasks",
    "profile.pendingTasks": "Pending tasks",
    "profile.joined": "Member since",
    "profile.editProfile": "Edit profile",
    "profile.logout": "Log out",
    "profile.edit.title": "Edit profile",
    "profile.edit.name": "Full name",
    "profile.edit.avatar": "Profile picture",
    "profile.edit.avatarHint": "JPG or PNG, up to 2 MB.",
    "profile.edit.removeAvatar": "Remove picture",
    "profile.edit.save": "Save changes",
    "profile.edit.success": "Profile updated.",
    "profile.edit.errors.nameRequired": "Enter your name.",
    "profile.edit.errors.uploadFailed": "The picture could not be uploaded. Try again.",

    // ------------------------------------------------ admin: login + shell
    "admin.loginTitle": "Admin sign in",
    "admin.loginSubtitle": "Administration access only.",
    "admin.login.identifier": "Email or username",
    "admin.login.identifierPlaceholder": "admin@example.com",
    "admin.login.password": "Password",
    "admin.login.submit": "Sign in",
    "admin.login.checking": "Checking access…",
    "admin.login.notAdmin": "This account does not have administrator access.",
    "admin.login.backToSite": "Back to website",
    "admin.login.redirecting": "Access confirmed. Opening the panel…",
    "admin.shell.title": "Admin panel",
    "admin.nav.overview": "Overview",
    "admin.nav.offers": "Offers",
    "admin.nav.content": "Content",
    "admin.nav.submissions": "Submissions",
    "admin.nav.users": "Users",
    "admin.nav.wallet": "Wallet",
    "admin.nav.withdrawals": "Withdrawals",
    "admin.nav.viewSite": "View website",
    "admin.nav.logout": "Log out",
    "admin.guard.deniedTitle": "Administrator access only",
    "admin.guard.deniedBody": "This area is restricted to administrators.",

    // ------------------------------------------------ admin: overview
    "admin.overview.title": "Overview",
    "admin.overview.subtitle": "Platform health at a glance.",
    "admin.overview.users": "Users",
    "admin.overview.offers": "Offers",
    "admin.overview.content": "Total content",
    "admin.overview.games": "Games",
    "admin.overview.apps": "Apps",
    "admin.overview.websites": "Websites",
    "admin.overview.offersCategory": "Offers",
    "admin.overview.rejectedReviews": "Rejected reviews",
    "admin.overview.pendingReviews": "Pending reviews",
    "admin.overview.approvedReviews": "Approved reviews",
    "admin.overview.recentPending": "Latest pending submissions",
    "admin.overview.viewAll": "View all",
    "admin.overview.emptyPendingTitle": "Nothing waiting for review",
    "admin.overview.emptyPendingBody": "New submissions will appear here the moment they arrive.",

    // ------------------------------------------------ admin: offers
    "admin.offers.title": "Offer management",
    "admin.offers.subtitle": "Create and control every game, app and website offer.",
    "admin.offers.new": "New offer",
    "admin.offers.searchPlaceholder": "Search offers…",
    "admin.offers.emptyTitle": "No offers yet",
    "admin.offers.emptyBody": "Create your first offer — it appears on the website immediately.",
    "admin.offers.active": "Active",
    "admin.offers.inactive": "Inactive",
    "admin.offers.activate": "Activate",
    "admin.offers.deactivate": "Deactivate",
    "admin.offers.deleteConfirm": "Delete this offer permanently? This cannot be undone.",
    "admin.offers.form.newTitle": "Create a new offer",
    "admin.offers.form.editTitle": "Edit offer",
    "admin.offers.form.contentTitle": "Content",
    "admin.offers.form.contentArabic": "Arabic content",
    "admin.offers.form.contentArabicHint": "Optional — shown to Arabic visitors. English is used when empty.",
    "admin.offers.form.title": "Title",
    "admin.offers.form.titleAr": "Title (Arabic)",
    "admin.offers.form.description": "Description",
    "admin.offers.form.descriptionAr": "Description (Arabic)",
    "admin.offers.form.category": "Category",
    "admin.offers.form.reward": "Reward (USD)",
    "admin.offers.form.rewardHint": "Amount credited to the user's wallet after approval, e.g. 0.50",
    "admin.offers.form.difficulty": "Difficulty",
    "admin.offers.form.time": "Estimated time",
    "admin.offers.form.timeAr": "Estimated time (Arabic)",
    "admin.offers.form.timePlaceholder": "e.g. 10–15 minutes",
    "admin.offers.form.requirements": "Requirements",
    "admin.offers.form.requirementsPlaceholder": "One requirement per line",
    "admin.offers.form.requirementsAr": "Requirements (Arabic)",
    "admin.offers.form.instructions": "Instructions",
    "admin.offers.form.instructionsAr": "Instructions (Arabic)",
    "admin.offers.form.image": "Cover image",
    "admin.offers.form.imageUpload": "Upload image",
    "admin.offers.form.imageUrl": "Image URL",
    "admin.offers.form.imageHint": "JPG or PNG up to 5 MB, or paste a hosted image URL. A generated cover is used when empty.",
    "admin.offers.form.activeLabel": "Active — visible to users",
    "admin.offers.form.status": "Status",

    // ------------------------------------------------ admin: content management
    "admin.content.title": "Content management",
    "admin.content.subtitle": "Every game, app, website and offer on the platform — no code required.",
    "admin.content.new": "New content",
    "admin.content.searchPlaceholder": "Search content…",
    "admin.content.filter.all": "All",
    "admin.content.published": "Published",
    "admin.content.draft": "Draft",
    "admin.content.publish": "Publish",
    "admin.content.unpublish": "Unpublish",
    "admin.content.publishedToast": "Content published — live on the website.",
    "admin.content.unpublishedToast": "Moved to draft — hidden from the website.",
    "admin.content.featuredToast": "Featured setting updated.",
    "admin.content.reorderFailed": "The display order could not be changed.",
    "admin.content.order": "Display order",
    "admin.content.moveUp": "Move up",
    "admin.content.moveDown": "Move down",
    "admin.content.toggleFeatured": "Toggle featured",
    "admin.content.deleteTitle": "Delete this content?",
    "admin.content.deleteConfirm": "This permanently removes the content from the website. This cannot be undone.",
    "admin.content.deletedToast": "Content deleted.",
    "admin.content.backToList": "← Back to content",
    "admin.content.emptyTitle": "No content yet",
    "admin.content.emptyBody": "Create your first game, app, website or offer — it appears on the website the moment you publish it.",

    // ------------------------------------------------ admin: content form page
    "admin.content.form.newTitle": "Add content",
    "admin.content.form.newSubtitle": "Publish a game, app, website or offer — it appears on the site instantly.",
    "admin.content.form.editTitle": "Edit content",
    "admin.content.form.editSubtitle": "Changes go live the moment you save.",
    "admin.content.form.categoryHint": "Where the content appears: Games, Apps, Websites or Offers.",
    "admin.content.form.shortDescriptionHint": "One or two lines shown on content cards.",
    "admin.content.form.fullDescription": "Full description",
    "admin.content.form.fullDescriptionHint": "Shown on the details page. The short description is used when empty.",
    "admin.content.form.fullDescriptionAr": "Full description (Arabic)",
    "admin.content.form.instructionsHint": "Step-by-step guide shown on the details page.",
    "admin.content.form.detailsTitle": "Task details",
    "admin.content.form.mediaTitle": "Media",
    "admin.content.form.thumbnailUpload": "Thumbnail image",
    "admin.content.form.bannerUpload": "Banner image",
    "admin.content.form.imageHint": "JPG, PNG or WebP up to 5 MB, or paste a hosted URL. A generated cover is used when empty.",
    "admin.content.form.publishingTitle": "Publishing",
    "admin.content.form.statusHint": "Draft content is hidden from the website until you publish it.",
    "admin.content.form.featuredLabel": "Featured — show in the featured sections",
    "admin.content.form.orderHint": "Lower numbers appear first.",
    "admin.content.form.saved": "Content saved.",
    "admin.content.form.notFoundTitle": "Content not found",
    "admin.content.form.notFoundBody": "This item may have been deleted. Go back to the content list.",
    "admin.offers.form.errors.titleRequired": "Enter a title.",
    "admin.offers.form.errors.rewardInvalid": "Enter a valid reward amount.",
    "admin.offers.form.saved": "Offer saved.",
    "admin.offers.form.deleteFailed": "The offer could not be deleted.",
    "admin.offers.form.saveFailed": "The offer could not be saved.",

    // ------------------------------------------------ admin: submissions
    "admin.submissions.title": "Submission review",
    "admin.submissions.user": "User",
    "admin.submissions.offer": "Offer",
    "admin.submissions.subtitle": "Check proof, then approve to credit the reward — or reject with a reason.",
    "admin.submissions.filter.all": "All",
    "admin.submissions.emptyTitle": "No submissions here",
    "admin.submissions.emptyBody": "Submissions matching this filter will appear here.",
    "admin.submissions.taskTitle": "Task title",
    "admin.submissions.message": "Message",
    "admin.submissions.walletNumber": "Wallet number",
    "admin.submissions.proofImages": "Proof images",
    "admin.submissions.submittedAt": "Submitted",
    "admin.submissions.rewardSnapshot": "Promised reward",
    "admin.submissions.currentReward": "Offer reward now",
    "admin.submissions.approve": "Approve",
    "admin.submissions.approveConfirm": "Approve this submission and credit {amount} to {name}?",
    "admin.submissions.reject": "Reject",
    "admin.submissions.rejectReasonLabel": "Rejection reason",
    "admin.submissions.rejectReasonPlaceholder": "Explain why, so the user can fix it next time…",
    "admin.submissions.rejectReasonRequired": "A rejection reason is required.",
    "admin.submissions.reviewedBy": "Reviewed by",
    "admin.submissions.reasonLabel": "Reason",
    "admin.submissions.openProof": "Open image",
    "admin.submissions.approvedToast": "Submission approved — reward credited.",
    "admin.submissions.rejectedToast": "Submission rejected — user notified.",
    "admin.submissions.actionFailed": "The action failed. Please try again.",

    // ------------------------------------------------ admin: users
    "admin.users.title": "User management",
    "admin.users.subtitle": "Search accounts and inspect their activity.",
    "admin.users.searchPlaceholder": "Search by name or email…",
    "admin.users.emptyTitle": "No users found",
    "admin.users.emptyBody": "No account matches this search.",
    "admin.users.roleUser": "User",
    "admin.users.roleAdmin": "Admin",
    "admin.users.joined": "Joined",
    "admin.users.viewActivity": "View activity",
    "admin.users.activityTitle": "Account activity",
    "admin.users.activity.balance": "Wallet balance",
    "admin.users.activity.completed": "Completed tasks",
    "admin.users.activity.pending": "Pending submissions",
    "admin.users.activity.recentSubmissions": "Recent submissions",
    "admin.users.activity.noSubmissions": "No submissions yet.",
    "admin.users.activity.recentTransactions": "Recent transactions",
    "admin.users.activity.noTransactions": "No transactions yet.",

    // ------------------------------------------------ admin: wallet
    "admin.wallet.title": "Wallet management",
    "admin.wallet.subtitle": "Every transaction on the platform, plus manual adjustments.",
    "admin.wallet.addAdjustment": "Add adjustment",
    "admin.wallet.tableUser": "User",
    "admin.wallet.tableType": "Type",
    "admin.wallet.tableAmount": "Amount",
    "admin.wallet.tableDescription": "Description",
    "admin.wallet.tableDate": "Date",
    "admin.wallet.emptyTitle": "No transactions yet",
    "admin.wallet.emptyBody": "Approved rewards and withdrawals will be listed here.",
    "admin.wallet.adjust.title": "Add a manual adjustment",
    "admin.wallet.adjust.subtitle": "Credits (positive) or deducts (negative) from a user's wallet.",
    "admin.wallet.adjust.user": "User",
    "admin.wallet.adjust.userPlaceholder": "Search by name or email…",
    "admin.wallet.adjust.amount": "Amount (USD)",
    "admin.wallet.adjust.amountPlaceholder": "e.g. 2.00 or -1.00",
    "admin.wallet.adjust.description": "Description",
    "admin.wallet.adjust.descriptionPlaceholder": "Why is this adjustment being made?",
    "admin.wallet.adjust.errors.userRequired": "Choose a user.",
    "admin.wallet.adjust.errors.amountInvalid": "Enter a valid non-zero amount.",
    "admin.wallet.adjust.errors.descriptionRequired": "Enter a short description.",
    "admin.wallet.adjust.success": "Adjustment saved.",
    "admin.wallet.adjust.failed": "The adjustment could not be saved.",

    // ------------------------------------------------ admin: withdrawals
    "admin.withdrawals.title": "Withdrawal requests",
    "admin.withdrawals.subtitle": "Approve to record the payout — or reject with a reason.",
    "admin.withdrawals.emptyTitle": "No withdrawal requests",
    "admin.withdrawals.emptyBody": "Requests matching this filter will appear here.",
    "admin.withdrawals.user": "User",
    "admin.withdrawals.amount": "Amount",
    "admin.withdrawals.walletNumber": "Wallet number",
    "admin.withdrawals.requestedAt": "Requested",
    "admin.withdrawals.processedAt": "Processed",
    "admin.withdrawals.userBalance": "User balance",
    "admin.withdrawals.approve": "Approve",
    "admin.withdrawals.approveConfirm": "Approve this withdrawal of {amount} to {name}? A payout transaction will be recorded.",
    "admin.withdrawals.reject": "Reject",
    "admin.withdrawals.rejectReasonLabel": "Rejection reason",
    "admin.withdrawals.rejectReasonRequired": "A rejection reason is required.",
    "admin.withdrawals.approvedToast": "Withdrawal approved — payout recorded.",
    "admin.withdrawals.rejectedToast": "Withdrawal rejected — user notified.",
    "admin.withdrawals.actionFailed": "The action failed. Please try again.",
    "admin.withdrawals.insufficientBalance": "Note: the user's balance ({balance}) is lower than this withdrawal.",
  },

  /* ============================== ARABIC ============================== */
  ar: {
    // ------------------------------------------------ عام
    "common.skipToContent": "تخطَّ إلى المحتوى",
    "common.demoLabel": "عرض تجريبي",
    "common.demoNotice": "محتوى تجريبي يظهر إلى حين نشر محتوى حقيقي.",
    "common.loading": "جارٍ التحميل…",
    "common.errorTitle": "حدث خطأ ما",
    "common.errorBody": "لم نتمكن من تحميل هذا الآن. يُرجى المحاولة مجددًا.",
    "common.retry": "أعد المحاولة",
    "common.cancel": "إلغاء",
    "common.save": "حفظ",
    "common.close": "إغلاق",
    "common.delete": "حذف",
    "common.edit": "تعديل",
    "common.view": "عرض",
    "common.search": "بحث",
    "common.back": "رجوع",
    "common.optional": "اختياري",
    "common.backToDashboard": "العودة إلى لوحة التحكم",
    "common.backHome": "العودة إلى الرئيسية",
    "common.viewAll": "عرض الكل",
    "common.featuredLabel": "مميز",

    // ------------------------------------------------ التنقل
    "nav.primary": "الرئيسية",
    "nav.home": "الرئيسية",
    "nav.games": "الألعاب",
    "nav.apps": "التطبيقات",
    "nav.websites": "المواقع",
    "nav.offers": "العروض",
    "nav.howItWorks": "كيف يعمل",
    "nav.login": "تسجيل الدخول",
    "nav.signUp": "إنشاء حساب",
    "nav.logout": "تسجيل الخروج",
    "nav.dashboard": "لوحة التحكم",
    "nav.wallet": "المحفظة",
    "nav.notifications": "الإشعارات",
    "nav.profile": "الملف الشخصي",
    "nav.submissions": "طلباتي",
    "nav.openMenu": "فتح القائمة",

    // ------------------------------------------------ عناوين الصفحات
    "meta.title": "The App — العب. جرّب. اكسب.",
    "meta.loginTitle": "مرحبًا بعودتك — The App",
    "meta.registerTitle": "أنشئ حسابك — The App",
    "meta.dashboardTitle": "لوحة التحكم — The App",
    "meta.profileTitle": "ملفك الشخصي — The App",
    "meta.offersTitle": "تصفّح العروض — The App",
    "meta.offerTitle": "تفاصيل العرض — The App",
    "meta.walletTitle": "محفظتك — The App",
    "meta.withdrawTitle": "سحب الأموال — The App",
    "meta.notificationsTitle": "الإشعارات — The App",
    "meta.submissionsTitle": "طلباتي — The App",
    "meta.gamesTitle": "الألعاب — The App",
    "meta.appsTitle": "التطبيقات — The App",
    "meta.websitesTitle": "المواقع — The App",

    // ------------------------------------------------ صفحة 404
    "error404.metaTitle": "الصفحة غير موجودة — The App",
    "error404.title": "الصفحة غير موجودة",
    "error404.body": "الصفحة التي تبحث عنها غير موجودة أو ربما تم نقلها.",
    "error404.cta": "العودة إلى الرئيسية",

    // ------------------------------------------------ الصفحة الرئيسية: البطل
    "hero.play": "العب.",
    "hero.tryIt": "جرّب.",
    "hero.earn": "اكسب.",
    "hero.subtitle": "اكتشف الألعاب والتطبيقات والمواقع، أنجز مهمة بسيطة، واكسب مكافآتك فور اجتياز التحقق من إثباتك.",
    "hero.primaryCta": "تصفّح المكافآت",
    "hero.secondaryCta": "كيف يعمل",
    "hero.note": "الانضمام مجاني. لا حاجة لأي دفعة للبدء.",
    "hero.demo.stepOffer": "اختر عرضًا",
    "hero.demo.offerTitle": "جبهة الفضاء",
    "hero.demo.offerRequirement": "الوصول إلى المستوى 5",
    "hero.demo.stepProof": "أرسل إثباتك",
    "hero.demo.proofLabel": "تم رفع لقطة الشاشة",
    "hero.demo.proofStatus": "قيد التحقق",
    "hero.demo.stepReward": "استلم أموالك",
    "hero.demo.walletLabel": "المحفظة",
    "hero.demo.walletNote": "تُضاف بعد التحقق",

    // ------------------------------------------------ المحتوى المميز (الرئيسية)
    "featured.title": "مميز الآن",
    "featured.subtitle": "فرص مختارة بعناية من فريقنا.",

    // ------------------------------------------------ الصفحة الرئيسية: كيف يعمل
    "how.title": "ثلاث خطوات من البداية إلى النهاية",
    "how.subtitle": "شروط واضحة، ومكافآت شفافة، وعملية تحقق بسيطة ومباشرة.",
    "how.step1Title": "اختر مهمة",
    "how.step1Body": "ابحث عن لعبة أو تطبيق واختر المكافأة المتاحة.",
    "how.step2Title": "أنجزها",
    "how.step2Body": "اتبع المتطلب، مثل الوصول إلى مستوى معيّن.",
    "how.step3Title": "استلم مكافأتك",
    "how.step3Body": "أرسل إثباتك. فور اجتياز التحقق تُضاف المكافأة إلى محفظتك.",

    // ------------------------------------------------ الصفحة الرئيسية: العروض
    "offers.title": "طرق الكسب",
    "offers.subtitle": "اختر المهمة المناسبة لك، أنجزها، وأرسل إثباتك.",
    "offers.browseAll": "تصفّح جميع العروض",
    "offers.rewardLabel": "المكافأة",
    "offers.requirementLabel": "المتطلب",
    "offers.timeLabel": "الوقت المتوقع",
    "offers.difficultyLabel": "الصعوبة",
    "offers.viewOffer": "عرض التفاصيل",
    "offers.loading": "جارٍ تحميل العروض…",
    "offers.emptyTitle": "لا توجد مكافآت منشورة بعد",
    "offers.emptyBody": "مكافآت جديدة في الطريق. عُد قريبًا أو استكشف تصنيفًا آخر.",
    "offers.errorTitle": "تعذّر تحميل العروض",
    "offers.errorBody": "تحقّق من اتصالك وأعد المحاولة.",

    // ------------------------------------------------ صفحات التصنيفات
    "categoryPage.games.title": "الألعاب",
    "categoryPage.games.subtitle": "العب، حقّق الهدف، واكسب — كل لعبة تعرض مكافأتها بوضوح قبل البدء.",
    "categoryPage.apps.title": "التطبيقات",
    "categoryPage.apps.subtitle": "جرّب تطبيقات مميزة، حقّق الشرط، واحصل على مكافأتك.",
    "categoryPage.websites.title": "المواقع",
    "categoryPage.websites.subtitle": "استكشف المواقع، أنجز المهمة، واحصل على مقابل لوقتك.",
    "categoryPage.emptyTitle": "لا توجد {category} متاحة الآن",
    "categoryPage.emptyBody": "مكافآت جديدة لهذا التصنيف في الطريق. عُد قريبًا أو استكشف تصنيفًا آخر.",

    // ------------------------------------------------ الصفحة الرئيسية: الثقة + الدعوة + التذييل
    "trust.title": "كيف تعمل المكافآت فعلًا",
    "trust.subtitle": "كل مكافأة مرتبطة بمهمة، وكل دفعة قابلة للتتبّع.",
    "trust.tiedTitle": "المكافآت مرتبطة بمهام",
    "trust.tiedBody": "كل عرض يوضّح متطلبه ومكافأته بالضبط قبل أن تبدأ.",
    "trust.proofTitle": "أرسل إثباتك",
    "trust.proofBody": "أنجز المتطلب ثم ارفع لقطة شاشة تُثبت ذلك.",
    "trust.reviewTitle": "تحقّق قبل صرف المكافأة",
    "trust.reviewBody": "تخضع الطلبات لعملية تحقق لدينا قبل صرف أي مكافأة.",
    "trust.approvedTitle": "المكافآت المعتمدة تصل محفظتك",
    "trust.approvedBody": "الطلب المعتمد يُنشئ حركة في المحفظة يمكنك تتبّعها حتى العرض نفسه.",
    "trust.rejectedTitle": "الرفض يأتي مع سبب",
    "trust.rejectedBody": "إذا رُفض طلبك فستصلك الأسباب داخل التطبيق ويمكنك المحاولة مجددًا.",
    "cta.title": "جاهز للبدء؟",
    "cta.body": "أنشئ حسابك واستكشف المكافآت المتاحة الآن.",
    "cta.button": "أنشئ حسابًا مجانيًا",
    "footer.description": "أنجز مهام بسيطة في الألعاب والتطبيقات والمواقع، واكسب مكافآتك بعد اجتياز التحقق.",
    "footer.product": "المنتج",
    "footer.account": "الحساب",
    "footer.legal": "قانوني",
    "footer.legalSoon": "صفحتا الشروط وسياسة الخصوصية قيد الإعداد.",
    "footer.rights": "جميع الحقوق محفوظة.",

    // ------------------------------------------------ الدخول والتسجيل
    "auth.notConfiguredTitle": "تسجيل الدخول غير مُهيّأ بعد",
    "auth.notConfiguredBody": "بيانات Firebase غير متوفرة في هذه البيئة، لذا لا يمكن إنشاء الحسابات أو استخدامها.",
    "auth.loginTitle": "مرحبًا بعودتك",
    "auth.loginSubtitle": "سجّل دخولك لتتابع من حيث توقفت.",
    "auth.registerTitle": "أنشئ حسابك",
    "auth.registerSubtitle": "لن يستغرق دقيقة. يمكنك تصفّح العروض فورًا.",
    "auth.fields.email": "البريد الإلكتروني",
    "auth.fields.emailPlaceholder": "you@example.com",
    "auth.fields.password": "كلمة المرور",
    "auth.fields.passwordPlaceholder": "8 أحرف على الأقل",
    "auth.fields.displayName": "الاسم",
    "auth.fields.displayNamePlaceholder": "كيف نناديك؟",
    "auth.fields.confirmPassword": "تأكيد كلمة المرور",
    "auth.loginSubmit": "تسجيل الدخول",
    "auth.registerSubmit": "إنشاء الحساب",
    "auth.google": "المتابعة بحساب Google",
    "auth.orDivider": "أو",
    "auth.forgotPassword": "نسيت كلمة المرور؟",
    "auth.forgotPasswordTitle": "إعادة تعيين كلمة المرور",
    "auth.forgotPasswordSubtitle": "أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين.",
    "auth.forgotPasswordSentTitle": "تحقّق من بريدك",
    "auth.forgotPasswordSentBody": "إذا كان هذا البريد مستخدمًا لحساب، فسيصله رابط إعادة تعيين كلمة المرور.",
    "auth.forgotPasswordSubmit": "أرسل رابط إعادة التعيين",
    "auth.forgotPasswordBack": "العودة لتسجيل الدخول",
    "auth.loginSwitchPrompt": "أول مرة هنا؟",
    "auth.loginSwitchAction": "أنشئ حسابًا",
    "auth.registerSwitchPrompt": "لديك حساب بالفعل؟",
    "auth.registerSwitchAction": "سجّل الدخول",
    "auth.errors.fieldRequired": "هذا الحقل مطلوب.",
    "auth.errors.invalidEmail": "أدخل بريدًا إلكترونيًا صحيحًا.",
    "auth.errors.weakPassword": "استخدم 8 أحرف على الأقل.",
    "auth.errors.passwordMismatch": "كلمتا المرور غير متطابقتين.",
    "auth.errors.invalid-credential": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    "auth.errors.invalid-login-credentials": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    "auth.errors.wrong-password": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    "auth.errors.user-not-found": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    "auth.errors.invalid-email": "أدخل بريدًا إلكترونيًا صحيحًا.",
    "auth.errors.email-already-in-use": "هناك حساب يستخدم هذا البريد بالفعل.",
    "auth.errors.weak-password-firebase": "استخدم 8 أحرف على الأقل.",
    "auth.errors.too-many-requests": "محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.",
    "auth.errors.network-request-failed": "مشكلة في الشبكة. تحقّق من اتصالك وأعد المحاولة.",
    "auth.errors.popup-closed-by-user": "أُغلقت نافذة Google قبل إكمال الدخول.",
    "auth.errors.cancelled-popup-request": "أُغلقت نافذة Google قبل إكمال الدخول.",
    "auth.errors.popup-blocked": "منع متصفحك نافذة Google. اسمح بالنوافذ المنبثقة وأعد المحاولة.",
    "auth.errors.operation-not-allowed": "طريقة الدخول هذه غير مُفعّلة بعد. تواصل مع مشرف الموقع.",
    "auth.errors.generic": "حدث خطأ ما. يُرجى المحاولة مجددًا.",

    // ------------------------------------------------ تأكيد البريد
    "verify.title": "أكِّد بريدك الإلكتروني",
    "verify.loadingTitle": "جارٍ التحقق من جلستك",
    "verify.guestTitle": "يجب تسجيل الدخول أولًا",
    "verify.guestBody": "سجّل دخولك أو أنشئ حسابًا لتأكيد بريدك الإلكتروني.",
    "verify.subtitle": "أرسلنا رابط التأكيد إلى:",
    "verify.instructions": "افتح الرابط في تلك الرسالة لتأكيد بريدك. إن لم تصلك خلال دقائق، فتفضّل بفحص مجلد الرسائل غير المرغوبة.",
    "verify.resendSentTitle": "أُرسلت رسالة التأكيد",
    "verify.stillUnverified": "لم يتم التأكيد بعد. تحقّق من بريدك أو أعد إرسال الرسالة.",
    "verify.checkVerification": "لقد أكّدت بريدي",
    "verify.resend": "إعادة إرسال رسالة التأكيد",
    "verify.resendIn": "يمكن إعادة الإرسال بعد {seconds} ثانية",
    "verify.logout": "تسجيل الخروج",
    "verify.verifiedTitle": "تم تأكيد بريدك الإلكتروني",
    "verify.verifiedBody": "كل شيء جاهز. لوحة التحكم في انتظارك.",
    "verify.goHome": "الانتقال إلى لوحة التحكم",

    // ------------------------------------------------ التصنيفات والحالات والصعوبة
    "categories.game": "لعبة",
    "categories.app": "تطبيق",
    "categories.website": "موقع",
    "categories.offer": "عرض",
    "categories.all": "جميع العروض",
    "categoriesPlural.game": "الألعاب",
    "categoriesPlural.app": "التطبيقات",
    "categoriesPlural.website": "المواقع",
    "categoriesPlural.offer": "العروض",
    "status.pending": "قيد المراجعة",
    "status.approved": "معتمد",
    "status.rejected": "مرفوض",
    "difficulty.easy": "سهل",
    "difficulty.medium": "متوسط",
    "difficulty.hard": "صعب",

    // ------------------------------------------------ لوحة تحكم المستخدم
    "dashboard.welcome": "مرحبًا بعودتك",
    "dashboard.subtitle": "مكافآتك ونشاطك وفرصك في لمحة واحدة.",
    "dashboard.stats.wallet": "رصيد المحفظة",
    "dashboard.stats.completed": "المهام المكتملة",
    "dashboard.stats.pending": "الطلبات قيد المراجعة",
    "dashboard.featured.title": "فرص مميزة",
    "dashboard.featured.subtitle": "عروض نشطة يمكنك إنجازها الآن.",
    "dashboard.featured.viewAll": "عرض جميع العروض",
    "dashboard.activity.title": "النشاط الأخير",
    "dashboard.activity.viewAll": "عرض جميع الطلبات",
    "dashboard.quick.title": "إجراءات سريعة",
    "dashboard.quick.browseGames": "تصفّح الألعاب",
    "dashboard.quick.browseApps": "تصفّح التطبيقات",
    "dashboard.quick.browseWebsites": "تصفّح المواقع",
    "dashboard.quick.browseOffers": "تصفّح العروض",
    "dashboard.quick.profile": "الملف الشخصي",
    "dashboard.quick.withdraw": "سحب الأموال",
    "dashboard.empty.featuredTitle": "لا توجد مكافآت متاحة بعد",
    "dashboard.empty.featuredBody": "الفريق يجهّز فرصًا جديدة. ستظهر هنا فور نشرها.",
    "dashboard.empty.activityTitle": "لا توجد طلبات بعد",
    "dashboard.empty.activityBody": "اختر أول عرض لك، أنجز المهمة، وأرسل إثباتك — وسيظهر هنا.",

    // ------------------------------------------------ صفحة تصفّح العروض
    "offersPage.title": "تصفّح العروض",
    "offersPage.subtitle": "ألعاب وتطبيقات ومواقع وعروض — اختر مهمة، أنجزها، واحصل على مكافأتك.",
    "offersPage.loading": "جارٍ تحميل العروض…",
    "offersPage.emptyTitle": "لا توجد مكافآت في هذا التصنيف بعد",
    "offersPage.emptyBody": "لا توجد عروض في هذا التصنيف حاليًا. جرّب تصنيفًا آخر أو عُد لاحقًا.",
    "offersPage.errorTitle": "تعذّر تحميل العروض",
    "offersPage.errorBody": "تحقّق من اتصالك وأعد المحاولة.",

    // ------------------------------------------------ صفحة تفاصيل العرض
    "offer.aboutTitle": "عن هذا العرض",
    "offer.requirementsTitle": "المتطلبات",
    "offer.instructionsTitle": "التعليمات",
    "offer.categoryLabel": "التصنيف",
    "offer.rewardLabel": "المكافأة",
    "offer.timeLabel": "الوقت المتوقع",
    "offer.difficultyLabel": "الصعوبة",
    "offer.notFoundTitle": "العرض غير موجود",
    "offer.notFoundBody": "ربما انتهى هذا العرض أو أن الرابط غير صحيح.",
    "offer.notFoundCta": "تصفّح العروض المتاحة",
    "offer.signInTitle": "سجّل دخولك لبدء هذه المهمة",
    "offer.signInBody": "أنشئ حسابًا مجانيًا أو سجّل دخولك لإنجاز هذا العرض وكسب المكافأة.",
    "offer.signInCta": "تسجيل الدخول",
    "offer.signUpCta": "إنشاء حساب مجاني",
    "offer.verifyTitle": "أكِّد بريدك الإلكتروني أولًا",
    "offer.verifyBody": "أكِّد بريدك الإلكتروني لتفعيل إرسال الإثباتات.",
    "offer.verifyCta": "تأكيد البريد",
    "offer.pendingTitle": "طلبك قيد التحقق",
    "offer.pendingBody": "إثباتك لهذا العرض في مرحلة التحقق. ستصلك النتيجة عبر الإشعارات.",
    "offer.submit.title": "أرسل إثباتك",
    "offer.submit.subtitle": "أنجز المهمة أولًا ثم أرسل التفاصيل أدناه.",
    "offer.submit.taskTitle": "عنوان المهمة",
    "offer.submit.taskTitlePlaceholder": "مثال: وصول إلى المستوى 5 في لعبة جبهة الفضاء",
    "offer.submit.taskTitleHint": "عنوان قصير يصف ما أنجزته.",
    "offer.submit.message": "رسالة",
    "offer.submit.messagePlaceholder": "أي تفاصيل تساعد على التحقق من إنجازك…",
    "offer.submit.messageHint": "اختيارية — الرسالة الواضحة تُسرّع التحقق.",
    "offer.submit.walletNumber": "رقم المحفظة",
    "offer.submit.walletNumberPlaceholder": "معرّف محفظتك لاستلام الأموال",
    "offer.submit.walletNumberHint": "يُستخدم لتحويل مكافأتك بعد اجتياز التحقق.",
    "offer.submit.proofImages": "صور الإثبات",
    "offer.submit.proofHint": "حتى 5 صور (JPG أو PNG أو WebP)، وبحد أقصى 5 ميغابايت للصورة.",
    "offer.submit.addImages": "إضافة صور",
    "offer.submit.removeImage": "إزالة الصورة",
    "offer.submit.submit": "إرسال الإثبات",
    "offer.submit.uploading": "جارٍ رفع الإثبات…",
    "offer.submit.successTitle": "تم إرسال الإثبات",
    "offer.submit.successBody": "طلبك الآن في مرحلة التحقق. ستصلك رسالة فور اكتمال المراجعة.",
    "offer.submit.successCta": "عرض طلباتي",
    "offer.submit.errors.taskTitleRequired": "أدخل عنوانًا قصيرًا للمهمة.",
    "offer.submit.errors.walletRequired": "أدخل رقم محفظتك.",
    "offer.submit.errors.imagesRequired": "أرفق صورة إثبات واحدة على الأقل.",
    "offer.submit.errors.fileTooLarge": "حجم «{name}» أكبر من 5 ميغابايت.",
    "offer.submit.errors.tooManyFiles": "يمكن إرفاق 5 صور كحد أقصى.",
    "offer.submit.errors.invalidType": "«{name}» ليست صورة بصيغة مدعومة.",
    "offer.submit.errorTitle": "فشل الإرسال",
    "offer.submit.errorBody": "لم يُرسَل إثباتك. تحقّق من اتصالك وأعد المحاولة.",

    // ------------------------------------------------ مهامي المُرسلة
    "submissions.title": "طلباتي",
    "submissions.subtitle": "كل إثبات أرسلته، وحالته الآن.",
    "submissions.offerLabel": "العرض",
    "submissions.rewardLabel": "المكافأة",
    "submissions.submittedLabel": "أُرسل في",
    "submissions.reviewedLabel": "تمت مراجعته",
    "submissions.reasonLabel": "السبب",
    "submissions.statusLabel": "الحالة",
    "submissions.emptyTitle": "لا توجد طلبات بعد",
    "submissions.emptyBody": "اختر مهمة وأنجزها وأرسل إثباتك — كل ما ترسله يظهر هنا.",
    "submissions.emptyCta": "تصفّح العروض",

    // ------------------------------------------------ المحفظة
    "wallet.title": "محفظتك",
    "wallet.subtitle": "تصل المكافآت إلى هنا بعد اجتياز التحقق. اسحب متى شئت.",
    "wallet.balance": "الرصيد الحالي",
    "wallet.withdrawCta": "سحب الأموال",
    "wallet.historyTitle": "سجل الحركات",
    "wallet.historySubtitle": "كل مكافأة وسحب وتعديل في حسابك.",
    "wallet.emptyTitle": "لا توجد حركات بعد",
    "wallet.emptyBody": "فور اعتماد طلبك الأول ستظهر مكافأتك هنا.",
    "transaction.type.reward": "مكافأة مهمة",
    "transaction.type.withdrawal": "سحب أموال",
    "transaction.type.adjustment": "تعديل يدوي",
    "wallet.descriptionLabel": "الوصف",
    "wallet.dateLabel": "التاريخ",

    // ------------------------------------------------ السحب
    "withdraw.title": "سحب الأموال",
    "withdraw.subtitle": "تخضع الطلبات لعملية تحقق معتادة وتُنجز عادةً خلال أيام قليلة.",
    "withdraw.amount": "المبلغ (بالدولار)",
    "withdraw.amountPlaceholder": "مثال: 5.00",
    "withdraw.walletNumber": "رقم المحفظة",
    "withdraw.walletNumberPlaceholder": "إلى أين نرسل أموالك؟",
    "withdraw.available": "المتاح للسحب",
    "withdraw.submit": "طلب سحب",
    "withdraw.successTitle": "تم إرسال طلب السحب",
    "withdraw.successBody": "طلبك الآن قيد التحقق. سيصلك إشعار فور معالجته.",
    "withdraw.requestsTitle": "طلبات السحب الخاصة بك",
    "withdraw.requestsSubtitle": "تابع كل طلب من إرساله حتى الدفع.",
    "withdraw.emptyTitle": "لا توجد طلبات سحب",
    "withdraw.emptyBody": "ستظهر طلبات السحب هنا بمجرد إنشائها.",
    "withdraw.errors.amountRequired": "أدخل المبلغ.",
    "withdraw.errors.amountInvalid": "أدخل مبلغًا صحيحًا.",
    "withdraw.errors.minimum": "الحد الأدنى للسحب هو {amount}.",
    "withdraw.errors.insufficient": "هذا المبلغ يتجاوز رصيدك المتاح.",
    "withdraw.errors.walletRequired": "أدخل رقم محفظتك.",
    "withdraw.errorTitle": "فشل الطلب",
    "withdraw.errorBody": "لم يُرسَل طلب السحب. يُرجى المحاولة مجددًا.",

    // ------------------------------------------------ الإشعارات
    "notifications.title": "الإشعارات",
    "notifications.subtitle": "تصل هنا قرارات المراجعة على طلباتك وسحوباتك.",
    "notifications.markAllRead": "تحديد الكل كمقروء",
    "notifications.unreadCount": "{count} غير مقروء",
    "notifications.markRead": "تحديد كمقروء",
    "notifications.emptyTitle": "لا توجد إشعارات بعد",
    "notifications.emptyBody": "سيصلك إشعار هنا عند مراجعة أي طلب أو سحب.",
    "notifications.types.submission_approved.title": "تم اعتماد طلبك 🎉",
    "notifications.types.submission_approved.body": "تمت الموافقة على إثباتك لعرض «{offer}». أُضيف مبلغ {amount} إلى محفظتك.",
    "notifications.types.submission_rejected.title": "تم رفض طلبك",
    "notifications.types.submission_rejected.body": "رُفض إثباتك لعرض «{offer}». السبب: {reason}",
    "notifications.types.withdrawal_approved.title": "تمت الموافقة على السحب",
    "notifications.types.withdrawal_approved.body": "تمت الموافقة على سحبك بمبلغ {amount} وجارٍ معالجته.",
    "notifications.types.withdrawal_rejected.title": "تم رفض السحب",
    "notifications.types.withdrawal_rejected.body": "رُفض طلب سحبك بمبلغ {amount}. السبب: {reason}",

    // ------------------------------------------------ الملف الشخصي
    "profile.title": "ملفك الشخصي",
    "profile.subtitle": "بياناتك وحالة حسابك.",
    "profile.name": "الاسم الكامل",
    "profile.email": "البريد الإلكتروني",
    "profile.walletBalance": "رصيد المحفظة",
    "profile.completedTasks": "المهام المكتملة",
    "profile.pendingTasks": "الطلبات قيد المراجعة",
    "profile.joined": "عضو منذ",
    "profile.editProfile": "تعديل الملف",
    "profile.logout": "تسجيل الخروج",
    "profile.edit.title": "تعديل الملف الشخصي",
    "profile.edit.name": "الاسم الكامل",
    "profile.edit.avatar": "الصورة الشخصية",
    "profile.edit.avatarHint": "JPG أو PNG، حتى 2 ميغابايت.",
    "profile.edit.removeAvatar": "إزالة الصورة",
    "profile.edit.save": "حفظ التغييرات",
    "profile.edit.success": "تم تحديث الملف الشخصي.",
    "profile.edit.errors.nameRequired": "أدخل اسمك.",
    "profile.edit.errors.uploadFailed": "تعذّر رفع الصورة. أعد المحاولة.",

    // ------------------------------------------------ المشرف: الدخول والهيكل
    "admin.loginTitle": "دخول المشرفين",
    "admin.loginSubtitle": "للمشرفين فقط.",
    "admin.login.identifier": "البريد الإلكتروني أو اسم المستخدم",
    "admin.login.identifierPlaceholder": "admin@example.com",
    "admin.login.password": "كلمة المرور",
    "admin.login.submit": "تسجيل الدخول",
    "admin.login.checking": "جارٍ التحقق من الصلاحيات…",
    "admin.login.notAdmin": "هذا الحساب لا يملك صلاحيات مشرف.",
    "admin.login.backToSite": "العودة إلى الموقع",
    "admin.login.redirecting": "تم تأكيد الصلاحية. جارٍ فتح اللوحة…",
    "admin.shell.title": "لوحة المشرف",
    "admin.nav.overview": "نظرة عامة",
    "admin.nav.offers": "العروض",
    "admin.nav.content": "المحتوى",
    "admin.nav.submissions": "الطلبات",
    "admin.nav.users": "المستخدمون",
    "admin.nav.wallet": "المحفظة",
    "admin.nav.withdrawals": "السحوبات",
    "admin.nav.viewSite": "عرض الموقع",
    "admin.nav.logout": "تسجيل الخروج",
    "admin.guard.deniedTitle": "للمشرفين فقط",
    "admin.guard.deniedBody": "هذه المنطقة مخصصة للمشرفين.",

    // ------------------------------------------------ المشرف: النظرة العامة
    "admin.overview.title": "نظرة عامة",
    "admin.overview.subtitle": "حالة المنصة في لمحة.",
    "admin.overview.users": "المستخدمون",
    "admin.overview.offers": "العروض",
    "admin.overview.content": "إجمالي المحتوى",
    "admin.overview.games": "الألعاب",
    "admin.overview.apps": "التطبيقات",
    "admin.overview.websites": "المواقع",
    "admin.overview.offersCategory": "العروض",
    "admin.overview.rejectedReviews": "طلبات مرفوضة",
    "admin.overview.pendingReviews": "طلبات قيد المراجعة",
    "admin.overview.approvedReviews": "طلبات معتمدة",
    "admin.overview.recentPending": "أحدث الطلبات قيد المراجعة",
    "admin.overview.viewAll": "عرض الكل",
    "admin.overview.emptyPendingTitle": "لا شيء ينتظر المراجعة",
    "admin.overview.emptyPendingBody": "ستظهر الطلبات الجديدة هنا فور وصولها.",

    // ------------------------------------------------ المشرف: العروض
    "admin.offers.title": "إدارة العروض",
    "admin.offers.subtitle": "أنشئ وتحكّم في كل عروض الألعاب والتطبيقات والمواقع.",
    "admin.offers.new": "عرض جديد",
    "admin.offers.searchPlaceholder": "ابحث في العروض…",
    "admin.offers.emptyTitle": "لا توجد عروض بعد",
    "admin.offers.emptyBody": "أنشئ أول عرض — سيظهر على الموقع فورًا.",
    "admin.offers.active": "نشط",
    "admin.offers.inactive": "غير نشط",
    "admin.offers.activate": "تنشيط",
    "admin.offers.deactivate": "إيقاف",
    "admin.offers.deleteConfirm": "حذف هذا العرض نهائيًا؟ لا يمكن التراجع.",
    "admin.offers.form.newTitle": "إنشاء عرض جديد",
    "admin.offers.form.editTitle": "تعديل العرض",
    "admin.offers.form.contentTitle": "المحتوى",
    "admin.offers.form.contentArabic": "المحتوى العربي",
    "admin.offers.form.contentArabicHint": "اختياري — يُعرض للزوار العرب. يُستخدم الإنجليزي عند الفراغ.",
    "admin.offers.form.title": "العنوان",
    "admin.offers.form.titleAr": "العنوان (بالعربية)",
    "admin.offers.form.description": "الوصف",
    "admin.offers.form.descriptionAr": "الوصف (بالعربية)",
    "admin.offers.form.category": "التصنيف",
    "admin.offers.form.reward": "المكافأة (بالدولار)",
    "admin.offers.form.rewardHint": "المبلغ الذي يُضاف لمحفظة المستخدم بعد الموافقة، مثل 0.50",
    "admin.offers.form.difficulty": "الصعوبة",
    "admin.offers.form.time": "الوقت المتوقع",
    "admin.offers.form.timeAr": "الوقت المتوقع (بالعربية)",
    "admin.offers.form.timePlaceholder": "مثال: 10–15 دقيقة",
    "admin.offers.form.requirements": "المتطلبات",
    "admin.offers.form.requirementsPlaceholder": "متطلب واحد في كل سطر",
    "admin.offers.form.requirementsAr": "المتطلبات (بالعربية)",
    "admin.offers.form.instructions": "التعليمات",
    "admin.offers.form.instructionsAr": "التعليمات (بالعربية)",
    "admin.offers.form.image": "صورة الغلاف",
    "admin.offers.form.imageUpload": "رفع صورة",
    "admin.offers.form.imageUrl": "رابط الصورة",
    "admin.offers.form.imageHint": "JPG أو PNG أو WebP حتى 5 ميغابايت، أو الصق رابط صورة مستضافة. تُستخدم صورة مُولَّدة عند الفراغ.",
    "admin.offers.form.activeLabel": "نشط — مرئي للمستخدمين",
    "admin.offers.form.status": "الحالة",

    // ------------------------------------------------ المشرف: إدارة المحتوى
    "admin.content.title": "إدارة المحتوى",
    "admin.content.subtitle": "كل الألعاب والتطبيقات والمواقع والعروض على المنصة — دون الحاجة لأي برمجة.",
    "admin.content.new": "محتوى جديد",
    "admin.content.searchPlaceholder": "ابحث في المحتوى…",
    "admin.content.filter.all": "الكل",
    "admin.content.published": "منشور",
    "admin.content.draft": "مسودة",
    "admin.content.publish": "نشر",
    "admin.content.unpublish": "إلغاء النشر",
    "admin.content.publishedToast": "تم النشر — المحتوى ظاهر الآن على الموقع.",
    "admin.content.unpublishedToast": "تم التحويل إلى مسودة — المحتوى مخفي عن الموقع.",
    "admin.content.featuredToast": "تم تحديث إعداد التمييز.",
    "admin.content.reorderFailed": "تعذّر تغيير ترتيب العرض.",
    "admin.content.order": "ترتيب العرض",
    "admin.content.moveUp": "نقل لأعلى",
    "admin.content.moveDown": "نقل لأسفل",
    "admin.content.toggleFeatured": "تبديل التمييز",
    "admin.content.deleteTitle": "حذف هذا المحتوى؟",
    "admin.content.deleteConfirm": "سيؤدي هذا إلى إزالة المحتوى نهائيًا من الموقع. لا يمكن التراجع عن هذا الإجراء.",
    "admin.content.deletedToast": "تم حذف المحتوى.",
    "admin.content.backToList": "← العودة إلى المحتوى",
    "admin.content.emptyTitle": "لا يوجد محتوى بعد",
    "admin.content.emptyBody": "أنشئ أول لعبة أو تطبيق أو موقع أو عرض — سيظهر على الموقع فور نشره.",

    // ------------------------------------------------ المشرف: نموذج المحتوى
    "admin.content.form.newTitle": "إضافة محتوى",
    "admin.content.form.newSubtitle": "انشر لعبة أو تطبيقًا أو موقعًا أو عرضًا — يظهر على الموقع فورًا.",
    "admin.content.form.editTitle": "تعديل المحتوى",
    "admin.content.form.editSubtitle": "التغييرات تظهر فور الحفظ.",
    "admin.content.form.categoryHint": "مكان ظهور المحتوى: الألعاب أو التطبيقات أو المواقع أو العروض.",
    "admin.content.form.shortDescriptionHint": "سطر أو سطران يظهران على بطاقات المحتوى.",
    "admin.content.form.fullDescription": "الوصف الكامل",
    "admin.content.form.fullDescriptionHint": "يظهر في صفحة التفاصيل. يُستخدم الوصف المختصر عند تركه فارغًا.",
    "admin.content.form.fullDescriptionAr": "الوصف الكامل (بالعربية)",
    "admin.content.form.instructionsHint": "دليل خطوة بخطوة يظهر في صفحة التفاصيل.",
    "admin.content.form.detailsTitle": "تفاصيل المهمة",
    "admin.content.form.mediaTitle": "الوسائط",
    "admin.content.form.thumbnailUpload": "صورة مصغّرة",
    "admin.content.form.bannerUpload": "صورة بانر",
    "admin.content.form.imageHint": "JPG أو PNG أو WebP بحد أقصى 5 ميغابايت، أو الصق رابط صورة. تُستخدم صورة مولّدة عند تركه فارغًا.",
    "admin.content.form.publishingTitle": "النشر",
    "admin.content.form.statusHint": "المسودة مخفية عن الموقع حتى تنشرها.",
    "admin.content.form.featuredLabel": "مميز — يظهر في أقسام المحتوى المميز",
    "admin.content.form.orderHint": "الأرقام الأقل تظهر أولًا.",
    "admin.content.form.saved": "تم حفظ المحتوى.",
    "admin.content.form.notFoundTitle": "المحتوى غير موجود",
    "admin.content.form.notFoundBody": "ربما تم حذف هذا العنصر. عُد إلى قائمة المحتوى.",
    "admin.offers.form.errors.titleRequired": "أدخل العنوان.",
    "admin.offers.form.errors.rewardInvalid": "أدخل مبلغ مكافأة صحيحًا.",
    "admin.offers.form.saved": "تم حفظ العرض.",
    "admin.offers.form.deleteFailed": "تعذّر حذف العرض.",
    "admin.offers.form.saveFailed": "تعذّر حفظ العرض.",

    // ------------------------------------------------ المشرف: الطلبات
    "admin.submissions.title": "مراجعة الطلبات",
    "admin.submissions.subtitle": "افحص الإثبات ثم اعتمده لإضافة المكافأة — أو ارفضه مع ذكر السبب.",
    "admin.submissions.filter.all": "الكل",
    "admin.submissions.emptyTitle": "لا توجد طلبات هنا",
    "admin.submissions.emptyBody": "ستظهر الطلبات المطابقة لهذه التصفية هنا.",
    "admin.submissions.taskTitle": "عنوان المهمة",
    "admin.submissions.user": "المستخدم",
    "admin.submissions.offer": "العرض",
    "admin.submissions.message": "الرسالة",
    "admin.submissions.walletNumber": "رقم المحفظة",
    "admin.submissions.proofImages": "صور الإثبات",
    "admin.submissions.submittedAt": "أُرسل في",
    "admin.submissions.rewardSnapshot": "المكافأة الموعودة",
    "admin.submissions.currentReward": "مكافأة العرض حاليًا",
    "admin.submissions.approve": "اعتماد",
    "admin.submissions.approveConfirm": "اعتماد هذا الطلب وإضافة {amount} إلى حساب {name}؟",
    "admin.submissions.reject": "رفض",
    "admin.submissions.rejectReasonLabel": "سبب الرفض",
    "admin.submissions.rejectReasonPlaceholder": "اشرح السبب ليتمكن المستخدم من التصحيح في المرة القادمة…",
    "admin.submissions.rejectReasonRequired": "سبب الرفض مطلوب.",
    "admin.submissions.reviewedBy": "راجعه",
    "admin.submissions.reasonLabel": "السبب",
    "admin.submissions.openProof": "فتح الصورة",
    "admin.submissions.approvedToast": "تم اعتماد الطلب — أُضيفت المكافأة.",
    "admin.submissions.rejectedToast": "تم رفض الطلب — أُرسل إشعار للمستخدم.",
    "admin.submissions.actionFailed": "فشل تنفيذ الإجراء. يُرجى المحاولة مجددًا.",

    // ------------------------------------------------ المشرف: المستخدمون
    "admin.users.title": "إدارة المستخدمين",
    "admin.users.subtitle": "ابحث في الحسابات واطّلع على نشاطها.",
    "admin.users.searchPlaceholder": "ابحث بالاسم أو البريد…",
    "admin.users.emptyTitle": "لا يوجد مستخدمون",
    "admin.users.emptyBody": "لا يوجد حساب مطابق لهذا البحث.",
    "admin.users.roleUser": "مستخدم",
    "admin.users.roleAdmin": "مشرف",
    "admin.users.joined": "انضم في",
    "admin.users.viewActivity": "عرض النشاط",
    "admin.users.activityTitle": "نشاط الحساب",
    "admin.users.activity.balance": "رصيد المحفظة",
    "admin.users.activity.completed": "المهام المكتملة",
    "admin.users.activity.pending": "الطلبات قيد المراجعة",
    "admin.users.activity.recentSubmissions": "أحدث الطلبات",
    "admin.users.activity.noSubmissions": "لا توجد طلبات بعد.",
    "admin.users.activity.recentTransactions": "أحدث الحركات",
    "admin.users.activity.noTransactions": "لا توجد حركات بعد.",

    // ------------------------------------------------ المشرف: المحفظة
    "admin.wallet.title": "إدارة المحفظة",
    "admin.wallet.subtitle": "كل حركات المنصة، مع إمكانية التعديلات اليدوية.",
    "admin.wallet.addAdjustment": "إضافة تعديل",
    "admin.wallet.tableUser": "المستخدم",
    "admin.wallet.tableType": "النوع",
    "admin.wallet.tableAmount": "المبلغ",
    "admin.wallet.tableDescription": "الوصف",
    "admin.wallet.tableDate": "التاريخ",
    "admin.wallet.emptyTitle": "لا توجد حركات بعد",
    "admin.wallet.emptyBody": "ستُدرج هنا المكافآت والسحوبات المعتمدة.",
    "admin.wallet.adjust.title": "إضافة تعديل يدوي",
    "admin.wallet.adjust.subtitle": "يضيف (موجب) أو يخصم (سالب) من محفظة مستخدم.",
    "admin.wallet.adjust.user": "المستخدم",
    "admin.wallet.adjust.userPlaceholder": "ابحث بالاسم أو البريد…",
    "admin.wallet.adjust.amount": "المبلغ (بالدولار)",
    "admin.wallet.adjust.amountPlaceholder": "مثال: 2.00 أو -1.00",
    "admin.wallet.adjust.description": "الوصف",
    "admin.wallet.adjust.descriptionPlaceholder": "ما سبب هذا التعديل؟",
    "admin.wallet.adjust.errors.userRequired": "اختر مستخدمًا.",
    "admin.wallet.adjust.errors.amountInvalid": "أدخل مبلغًا صحيحًا غير صفري.",
    "admin.wallet.adjust.errors.descriptionRequired": "أدخل وصفًا قصيرًا.",
    "admin.wallet.adjust.success": "تم حفظ التعديل.",
    "admin.wallet.adjust.failed": "تعذّر حفظ التعديل.",

    // ------------------------------------------------ المشرف: السحوبات
    "admin.withdrawals.title": "طلبات السحب",
    "admin.withdrawals.subtitle": "اعتمد الطلب لتسجيل الدفعة — أو ارفضه مع ذكر السبب.",
    "admin.withdrawals.emptyTitle": "لا توجد طلبات سحب",
    "admin.withdrawals.emptyBody": "ستظهر الطلبات المطابقة لهذه التصفية هنا.",
    "admin.withdrawals.user": "المستخدم",
    "admin.withdrawals.amount": "المبلغ",
    "admin.withdrawals.walletNumber": "رقم المحفظة",
    "admin.withdrawals.requestedAt": "طُلب في",
    "admin.withdrawals.processedAt": "عولج في",
    "admin.withdrawals.userBalance": "رصيد المستخدم",
    "admin.withdrawals.approve": "اعتماد",
    "admin.withdrawals.approveConfirm": "اعتماد سحب {amount} إلى {name}؟ سيُسجَّل بيان دفع.",
    "admin.withdrawals.reject": "رفض",
    "admin.withdrawals.rejectReasonLabel": "سبب الرفض",
    "admin.withdrawals.rejectReasonRequired": "سبب الرفض مطلوب.",
    "admin.withdrawals.approvedToast": "تم اعتماد السحب — سُجِّل الدفع.",
    "admin.withdrawals.rejectedToast": "تم رفض السحب — أُرسل إشعار للمستخدم.",
    "admin.withdrawals.actionFailed": "فشل تنفيذ الإجراء. يُرجى المحاولة مجددًا.",
    "admin.withdrawals.insufficientBalance": "ملاحظة: رصيد المستخدم ({balance}) أقل من مبلغ هذا السحب.",
  },
};

export { t, localizedText, getLocale, isRTL, setLocale, onLocaleChange, applyTranslations, SUPPORTED_LOCALES };
