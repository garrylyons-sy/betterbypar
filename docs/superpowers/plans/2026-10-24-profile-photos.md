# Mobile profile photos

**Goal:** Allow signed-in users to upload/remove a profile photo; allow guardians to do the same for an active linked dependant.

**Design:** Retain existing `person.profile_image`, storing only a compact WebP data URI. Server-side Sharp processing enforces a maximum 512×512 bounding box, preserves aspect ratio, never enlarges a small image, auto-orients phone photos, strips metadata and caps encoded output at 150 KiB. The original is never persisted. JPEG, PNG and non-animated WebP are supported. Client preparation resizes large mobile photos before transmission; the server independently validates and transforms the input.

Add `/profile` with preview/save/remove, an account-menu link, and the same editor for dependants. Use authenticated `/api/profile/photo`; targets are the current person or a directly authorised active dependant in a specified club, never a client-supplied acting user. Existing Google avatars remain until replaced. No database migration or external storage credentials are required. Processing/storage is separate from Google login, which must preserve custom images.

## Implementation and verification

- [x] Add failing real-image tests for resizing, orientation, compression, supported formats, corrupt/oversized inputs and bounded multipart parsing.
- [x] Implement image policy/processor, profile-photo persistence with own/guardian checks and API routes.
- [x] Add profile editor/page/account link and dependant photo editing; keep ordinary account identifiers immutable.
- [x] Test storage scope and revocation in disposable PostgreSQL; run full suite, typecheck and production build; review.

Input limits: client source 20 MiB; server file 4 MiB; entire multipart body 4 MiB + 64 KiB; maximum decoded image 64 million pixels. Retry compression at lower quality when needed to keep the saved image at or below 150 KiB. Reject animations, SVG and invalid image bytes. Input format is verified by decoding rather than trusting a filename or MIME label.

No commits, pushes or live database operations. Repository AGENTS.md authorises inline implementation without intermediate design approval. React Native remains future work; server validation applies equally to a future native upload client.

## Verification and review

`pnpm test`: 537 passed, zero failed. `pnpm typecheck`: passed before final integration changes; production build checks final TypeScript. Actual image tests cover large/noisy images, small-image preservation, phone orientation, stripped EXIF, corrupt and unsupported content, forged MIME, animated WebP and chunked body limits. Disposable PostgreSQL tests cover owner/guardian writes, cross-club/role denial, revoked/inactive relationships and memberships, removal, and preservation through the production invitation-update SQL.

Independent review found no important issues; browser interactions were reviewed in code, not exercised against a live configured account. Live Supabase remains unconfigured. No commits, pushes, live database updates or original image persistence.

Implementation detail: an explicit removal is stored as empty text in the existing nullable profile image column. This distinguishes it from a never-set/null photo so Google sign-in cannot unexpectedly refill it. Invitations now fill only a null image, preserving both uploaded images and explicit removals.
