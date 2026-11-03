# Notifications and inbox

Use the existing snooker notification framework across Better By Par web/PWA and native, with one inbox and channel preferences per person.

User confirmed a free Apple Personal Team and requested the same free web-push approach as snooker. Use Safari Home Screen web push for background iPhone alerts. Add native inbox and settings without claiming APNs support or requiring a paid account. Email uses Resend and requires the Better By Par sender domain to be verified.

1. Reuse ownership, expiry, source-access checks, announcement receipts, quiet hours and per-event channel decisions. Preserve existing choices.
2. Add shared golf notification contracts and safe native destination mapping.
3. Add native inbox, unread badge, read/all filters, message details, settings and read/remove actions.
4. Configure dedicated VAPID keys, delivery scheduling and email readiness. Provide native links and instructions to enable web push from the installed website.
5. Verify navigation, ownership and channel behavior; run web/native checks, review, deploy and install. Explicitly identify outstanding email provider setup.

Verification and rollout: 693 automated tests passed; root and mobile TypeScript and mobile ESLint passed. Android Hermes export succeeded. Reviewer findings about stale settings drafts and duplicate navigation prompts were fixed and rechecked. Web deployment dpl_29qCLSoqcLTwdLyiKRZSP3qVxbbh is READY at www.betterbypar.com. Signed iPhone Release build succeeded and installed; automatic launch was blocked by the phone lock. Unique production VAPID credentials configured. Resend sender mail.betterbypar.com created with its three DNS records; Resend reports DNS verified and domain verification pending. Sending key remains user setup; no real notification receipt or email delivery is claimed.

Email configuration completed: saved Resend key accepted by provider; mail.betterbypar.com verified. Production RESEND_API_KEY and INVITE_FROM_EMAIL configured securely; deployment dpl_7fFadyPNbFpREG8rLnxKmBwhHadE READY and aliased to www.betterbypar.com. Eight email-worker tests passed. No test email was sent; successful inbox receipt is not claimed. Existing channel preferences remain unchanged.
