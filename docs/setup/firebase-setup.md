# Firebase implementation walkthrough

This is the setup path for connecting the repository to the real League of Friends Firebase project.

## 1. Local prerequisites

Use Node.js 22 because the Cloud Functions backend is configured for Node 22.

Verify:

```bash
node --version
npm --version
```

Install the Firebase CLI:

```bash
npm install -g firebase-tools
```

Then authenticate and verify access:

```bash
firebase login
firebase projects:list
```

## 2. Create the Firebase project

In Firebase Console:

1. Create a new project for League of Friends.
2. Pick a permanent project ID you are happy to keep.
3. Google Analytics is optional for the backend setup and may be left disabled initially.

Record the project ID. It will later be added to `.firebaserc`.

## 3. Firestore

Open **Databases & Storage → Firestore**.

Create the default **Cloud Firestore Standard** database with:

- location: `europe-west1` (Belgium)
- starting rules: **Production mode**

The repository contains the real rules in `firestore.rules`; Production mode is safer than temporarily exposing the database.

The Firestore location cannot be changed later.

## 4. Authentication

Open **Security → Authentication → Sign-in method**.

Enable **Google**.

No public email/password sign-in is required for Version 1.

The application model is:

```text
Google Auth UID
      ↓
authLinks/{uid}
      ↓
permanent Player ID
      ↓
players/{playerId}
```

This deliberately keeps permanent league identity separate from the Google account identifier.

## 5. Billing before production function deployment

The Firebase Local Emulator Suite can be used before enabling billing.

Deploying Cloud Functions requires the Firebase project to use the **Blaze** pay-as-you-go plan. This requires linking a Cloud Billing account.

Before production deployment, create a small billing budget and alerts in Google Cloud Billing. The league is tiny, but billing protection should still be configured.

## 6. Clone and install the repository

```bash
git clone https://github.com/Mathias-ao/League-of-Friends.git
cd League-of-Friends
npm --prefix functions install
npm --prefix functions run build
```

The build should finish without TypeScript errors.

## 7. Connect the local repo to Firebase

From the repository root:

```bash
firebase use --add
```

Select the League of Friends Firebase project and give the local alias:

```text
default
```

This creates `.firebaserc` locally. Commit it once the selected project ID is confirmed correct; it contains the project ID, not a secret.

Do **not** run `firebase init` over the project unless there is a specific reason. The repository already contains `firebase.json`, `firestore.rules`, `firestore.indexes.json`, and the Functions code.

## 8. Run the emulators

```bash
firebase emulators:start
```

The repository currently configures:

- Authentication emulator
- Firestore emulator
- Functions emulator
- Emulator Suite UI

The emulator does not touch production Firestore data.

## 9. First administrator bootstrap

The normal membership flow deliberately cannot create its own ADMIN. The first administrator therefore requires a one-time trusted bootstrap procedure.

Do not manually invent production Player/Auth documents yet. The project will add a dedicated bootstrap command/script before the first production test so this can be done safely and reproducibly.

## 10. Production deployment order

Once emulator tests pass and the first-admin bootstrap path is ready:

```bash
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only functions
```

Deploy functions in small groups later as their number grows.

## Region decision

League of Friends uses `europe-west1` for Cloud Functions and should use `europe-west1` for Firestore. The expected users are in/near Denmark and the product is a small private league, so a European regional database gives a good latency/cost fit without requiring multi-region availability.
