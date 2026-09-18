# Emperor's Favor

Emperor's Favor is the one-time invitation gate for creating a new Age of Friends league identity.

## Contract

- Google authentication happens before Favor redemption.
- A Favor is exactly six characters.
- Alphabet: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (32 symbols; I, O, 0 and 1 are excluded).
- Raw Favor codes are never stored in Firestore.
- Firestore stores an HMAC-SHA256 fingerprint keyed by a Firebase Secret.
- Five failed valid-format attempts within 15 minutes seal the gate for that Google account for 15 minutes.
- Favor redemption and player/auth-link creation happen in one Firestore transaction.
- A redeemed Favor can never create another player.
- Invalid and already-redeemed Favors return the same player-facing error.
- League membership becomes ACTIVE immediately after successful redemption.
- Season entry remains a separate step.

## Configure the server secret

Production and deployed environments require a strong server-only secret:

```bash
firebase functions:secrets:set EMPERORS_FAVOR_HMAC_KEY
```

Use at least 32 random characters. Never commit the value.

For local emulator work, create `functions/.secret.local` from `functions/.secret.local.example` and replace the placeholder.

## Issue the first 15

Sign in as an AoF administrator, open the account panel, and choose **Issue Emperor's Favors**.

The form defaults to:

- Batch name: **Founding Fifteen**
- Number of Favors: **15**

Create the batch and immediately use **Print Favors**. Each card contains:

- the Emperor's name;
- its sequence within the batch;
- the six-character Favor;
- the batch name;
- the warning that it may be invoked once.

The raw codes are returned only in the successful generation response. They cannot be recovered from Firestore later.

Additional batches can be created the same way. A batch may contain 1–50 Favors.

## Firestore records

`emperorFavorBatches/{batchId}` stores issuance metadata.

`emperorFavors/{hmacFingerprint}` stores the non-reversible lookup fingerprint, batch/serial metadata, Emperor, status, and redemption audit fields.

`emperorFavorAttempts/{authUid}` stores failed-attempt rate-limit state.

The raw six-character Favor is deliberately absent from every persisted record.
