# League of Friends

A private, persistent Age of Empires II league for friends. The product turns real games into lasting statistics, standings, achievements, rivalries, War Room challenges, titles, and an in-league Gold economy.

## Status

The Google Sheets / Apps Script prototype has completed its job as a domain prototype. The project is now being rebuilt on Firebase and Cloud Firestore.

Current phase: **Phase 2 — Firestore data architecture and backend foundation**.

## Architectural principles

- Match results and extracted game facts are authoritative history.
- League Points, War Room Points, and Gold are separate accounting systems.
- A Match is one competitive encounter; a Match contains one or more Games.
- One `.aoe2record` corresponds to one Game.
- Event configuration is snapshotted so historical competition stays reproducible.
- Raw facts, derived statistics, and inferred league knowledge stay separate.
- Client applications read Firestore directly but do not directly mutate authoritative competition data.
- Privileged and state-changing operations run through authenticated Cloud Functions.
- All scoring/economy processing must be idempotent and corrections must be auditable.

See [`docs/architecture/phase-2-firestore.md`](docs/architecture/phase-2-firestore.md) for the current database design.

## Repository layout

```text
.
├── docs/architecture/       Architecture decisions
├── functions/               Firebase Cloud Functions backend (TypeScript)
├── firebase.json            Firebase/Emulator configuration
├── firestore.rules          Firestore access policy
└── firestore.indexes.json   Firestore index configuration
```

## Backend stack

- Node.js 22
- TypeScript
- Cloud Functions for Firebase, 2nd gen
- Cloud Firestore
- Firebase Authentication (Google sign-in)
- Firebase Local Emulator Suite

## Local development

A production Firebase project ID is intentionally not committed yet. Until the real Firebase project is connected, use the Emulator Suite with a demo project ID.

```bash
npm --prefix functions install
npm --prefix functions run build
firebase emulators:start --project demo-league-of-friends
```

Do not commit Firebase service-account keys or other secrets.
