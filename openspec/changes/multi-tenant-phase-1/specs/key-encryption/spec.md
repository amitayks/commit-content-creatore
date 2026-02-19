## ADDED Requirements

### Requirement: AES-256-GCM encryption service
The system SHALL provide an encryption service at `services/crypto.ts` that encrypts and decrypts strings using AES-256-GCM via `crypto.subtle`.

#### Scenario: Encrypt an API key
- **WHEN** `encrypt(env, plaintext)` is called with a valid plaintext string
- **THEN** the function generates a random 12-byte IV, encrypts using `ENCRYPTION_KEY` from env, and returns a base64-encoded string containing `IV + ciphertext + authTag`

#### Scenario: Decrypt an API key
- **WHEN** `decrypt(env, encryptedBlob)` is called with a valid base64-encoded blob
- **THEN** the function decodes the blob, extracts the 12-byte IV, decrypts using `ENCRYPTION_KEY`, and returns the original plaintext string

#### Scenario: Decrypt with wrong key fails
- **WHEN** `decrypt(env, encryptedBlob)` is called but `ENCRYPTION_KEY` doesn't match the key used for encryption
- **THEN** the function throws an error

#### Scenario: Each encryption produces unique output
- **WHEN** `encrypt(env, plaintext)` is called twice with the same plaintext
- **THEN** the two outputs SHALL be different (due to random IV generation)

### Requirement: ENCRYPTION_KEY Worker secret
The system SHALL require an `ENCRYPTION_KEY` property on the `Env` interface. This key SHALL be a 32-byte value (base64-encoded) set via `wrangler secret put`.

#### Scenario: ENCRYPTION_KEY missing from env
- **WHEN** encrypt or decrypt is called and `env.ENCRYPTION_KEY` is not set
- **THEN** the function throws a descriptive error

### Requirement: Key format is base64-encoded composite
The encrypted blob format SHALL be `base64(IV[12 bytes] + ciphertext + authTag[16 bytes])`. This is a single string suitable for storage in a D1 TEXT column.

#### Scenario: Stored blob can be decoded
- **WHEN** a base64-encoded blob is decoded
- **THEN** the first 12 bytes are the IV, the last 16 bytes are the auth tag, and the middle bytes are the ciphertext
