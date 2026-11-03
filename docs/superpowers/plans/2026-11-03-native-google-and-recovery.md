# Native Google sign-in and password recovery

Restore native access options without treating a browser website session as a native session. Use the existing Google web OAuth callback and installed Linking/Crypto/SecureStore modules. No new native libraries.

- Add a ten-minute Google attempt bound to a device-generated S256 PKCE challenge. Only the verified Google callback can authorize it, returning a fixed app deep link with a short-lived one-time code. No bearer token in URLs. Exchange locks/consumes the attempt and revalidates active account/person and credential snapshot before creating a normal hashed native session. Expiry, replay, challenge mismatch and revocation tests are required.
- Native starts the browser, stores verifier on-device, validates the callback attempt and exchanges code, then uses existing secure session bootstrap. Password sign-in cancels pending Google login. Callback route supports cold launch.
- Add Google button and inline Forgot password form to polished entry. Recovery uses existing web email/reset endpoint and generic response; report missing email configuration honestly, without account enumeration. Return from reset via app sign-in link.
- Preserve existing web OAuth and invitation behavior. Google account must have verified email; existing-account only native flow. Rate limit start attempts. Deploy additive migration, backend and signed app after checks/review. Live Google credentials/email configuration are external requirements; do not claim live end-to-end success without them. Do not commit/push.
