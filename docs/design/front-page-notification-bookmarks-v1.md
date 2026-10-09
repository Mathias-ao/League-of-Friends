# Front-page dispatches · V1

The masthead's former single “Answer the call” link becomes personal hanging cloth bookmarks. Each opens a small Chronicle parchment note with context, a deadline when available, and an explicit action. Opening the note never changes attendance or signup.

The order is Season entry, open check-in, Battle Orders/result review, available warm-up, unanswered signup, then muster confirmation. The header displays two actionable bookmarks and one automatic warm-up receipt; extra notices are accessible through a “More dispatches” bookmark. On narrow screens the bookmarks occupy a second masthead row.

Actions use existing authenticated repository calls. This is a state-derived dispatch system, not a persisted inbox: unresolved actions stay visible, completed actions disappear, and closing a note does not dismiss the underlying task. Schedule boundaries refresh while the page is open and when it regains focus. Play deadlines suppress invitations to play, but never suppress pending result review. Approved main matches end the muster notice even before the attendance clock deadline.

Only active members receive personal bookmarks. Match notices require participation, distinguish explicit main 1v1s from warm-ups, and exclude cancelled or postponed Events. Season actions and Event invitations apply to the current Season.

The existing counted-duel parchment is reused for the front-page receipt. Authenticated Event detail is fetched only for Events where the viewer has multiple non-cancelled warm-up matches (the live directory does not expose the scoring policy). Only the server's viewer-scoped selection can create a receipt. Failed, stale or cross-account responses do not create flags. Both eligible warm-ups contribute statistical accomplishments; only the selected best validated result earns points. No scoring or publication behaviour changes.

Verification: web production build and frontend suite, including dispatch deadline/access tests, explicit check-in action, focus restoration, resolution removal, authenticated receipt rendering and stale account-response suppression. Browser visual review remains a manual check.
