# Admin role switching

User explicitly chose real changes rather than read-only preview. Implement a web administration tool, retaining the original authenticated admin session. Select any active club, supported golf role, and an existing eligible person. Empty roles explain that someone must first be appointed. Do not create memberships or fictional players. Native administration remains web-focused.

1. Shared role labels, landing routes, mutation allowlist; server signed session-bound one-hour context. Validate original active operator and current target eligibility on each request. No credentials copied or target login required.
2. API options/start/exit with same-origin mutation checks and durable audit. Resolve currentUser to effective person for normal business authorization, expose initiating admin in acting context. Limit golf access to selected club/role, preserve original session for exit, disallow account/security mutations while acting. Audit attempted mutations with original admin and effective person.
3. Global accessible switcher with club/role/person fields, banner, error handling, and return to Admin. Selected home context follows acting role. Preserve unsaved navigation protection.
4. Policy tests for tampering, expiry, session binding, role paths; root/mobile checks and regression suite. Review security, verify browser state, deploy. Do not commit/push.
