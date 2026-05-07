# Security Specification for WARCET Database

## 1. Data Invariants
- An operator profile can only be created by the user themselves exactly once.
- Only the `admin` role (determined by `/operators/{uid}`) can read all operators.
- Log entries must have a valid `operatorId` matching the authenticated user.
- Log entries are immutable except for status updates (if any) or admin overrides.
- `role` in the `Operator` profile is immutable once set (or only modifiable by existing admins).

## 2. The Dirty Dozen Payloads

1. **Identity Theft**: Try to create an operator profile with a `userId` that doesn't match the auth UID. (Target: `/operators/{maliciousId}`)
2. **Privilege Escalation**: Try to create an operator profile with `role: "admin"`.
3. **Ghost Profile**: Try to create an operator profile with extra fields (e.g., `isVerified: true`).
4. **Log Spoofing**: Create a log entry where `operatorId` is another user's UID.
5. **Timestamp Fraud**: Submit a log entry with a hardcoded `timestamp` in the past/future instead of server time.
6. **Role Tampering**: Attempt to update an existing operator profile's `role` from "operator" to "admin".
7. **Cross-User Data Scraping**: List all entries without having an active operator profile.
8. **Resource Exhaustion**: Submit a log entry with a 1MB string in the `title`.
9. **Invalid Category**: Submit a log entry with `category: "hacking"`.
10. **ID Poisoning**: Use a document ID containing invalid characters for an entry.
11. **Shadow Update**: Update a log entry field that is not allowed (e.g., `operatorId`).
12. **PII Leak**: Attempt to read `/operators/{userId}` of another user without admin privileges.

## 3. Test Runner (Draft)
The `firestore.rules.test.ts` will verify these scenarios.
