# Security Specification

## 1. Data Invariants
- A `Course` must belong to the user (`userId == request.auth.uid`).
- A `Node` must belong to the user (`userId == request.auth.uid`).
- A `Link` must belong to the user (`userId == request.auth.uid`).
- A `Document` must belong to the user (`userId == request.auth.uid`).
- Timestamps like `createdAt` and `parsedAt` must match `request.time` exactly.
- Immutable fields like `userId`, `createdAt` cannot be changed during updates.
- All documents require the user's email to be verified.
- User ID is validated for the authenticated user making the request.

## 2. The "Dirty Dozen" Payloads
1. Unauthorized Create: Not signed in.
2. Spoofed Identity: `userId` doesn't match `request.auth.uid`.
3. Read Another User's Data: `get` a document with someone else's `userId`.
4. Extraneous Fields (Shadow Update): Adding a random `isAdmin` or `secret` field to `Course`.
5. Missing Required Fields: Creating a `Course` without `title`.
6. Invalid Data Types: Passing an array for `title` instead of a string.
7. Size Exceeded: Passing a `title` larger than 200 characters.
8. Modifying Immutable Fields: Changing `createdAt` or `userId` during an `update`.
9. Email Unverified: User is signed in but `email_verified` is false.
10. Unbounded Array: Adding 100+ tags into `tags` array on a `Node`.
11. Malicious ID: Querying or interacting with a document ID that contains special characters.
12. Blanket List Reads: Querying all courses globally without `where('userId', '==', uid)`.

## 3. The Test Runner
A test file will verify all 12 scenarios return `PERMISSION_DENIED`.
