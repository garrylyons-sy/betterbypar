# Support email and agent plan

Status: proposed rollout, 24 October 2026. No mailbox has been provisioned and no monitoring is active. The owner confirmed the domain and email provider are not decided yet; both remain pending. This document does not authorise production changes or customer replies.

## Recommended setup

Create a dedicated system-wide address, `support@<chosen-domain>`, with a human-accessible mailbox. The exact address is a placeholder. Keep mailbox ownership with the business and make its credentials independent of the original Interclub Snooker app. Use the chosen provider's supported delegated or application access for the agent.

If the domain already uses Google Workspace or Microsoft 365, keep the mailbox there. Add agent integration through that provider after verifying that the required mailbox read, draft and send capabilities are supported. Gmail and Outlook Email connectors were found in the available plugin directory; neither is currently connected in this chat. A desktop connector can support a pilot, but ongoing production monitoring must have an explicit runtime and outage recovery plan.

An alternative is Resend receiving with signed inbound webhooks. The application already uses Resend for outbound transactional email. Resend offers inbound event delivery and retrieval APIs; a receiving integration still needs an application-owned ticket store and human support view. If the chosen domain already receives other email, preserve its existing mail routing; a receiving subdomain or mailbox forwarding can separate agent ingestion from the domain's ordinary mail service.

Recommendation: a real human-accessible support mailbox first, then an application-owned worker and ticket history for dependable monitoring. Decide the provider before provisioning DNS, accounts, subscriptions or API access.

## Member and club experience

Use one support address for the platform initially. Publish it in both admin portals and the member app after verifying inbound delivery. Outbound invitations, password-reset emails and notifications should use this support address as Reply-To while retaining an appropriately authenticated sending identity.

A support request should capture a ticket number, conversation history, club if verified, issue category, severity, owner and status. Acknowledgements should quote the ticket number and avoid promising a resolution time before service expectations are agreed. The parent or guardian is the primary contact for a dependant's request; do not automatically copy a junior.

The support queue is platform administration. Club administrators may view or receive escalations concerning their own club where appropriate. They must not gain access to another club's messages or private platform incidents. An email claiming a club or guardian relationship is not proof of that relationship.

## Agent workflow

1. Receive the message through the mailbox provider or a verified inbound webhook.
2. Deduplicate using provider event/message IDs and associate replies with the existing ticket using conversation headers and ticket ID.
3. Store the request durably in the new Supabase project before processing. Queue work with retries, bounded backoff and failure tracking.
4. Identify the sender and relevant club using verified system records. Require an authenticated in-app step for sensitive requests rather than treating possession of an email thread as account authority.
5. Categorise the issue: access/invitations, club branding, dependants, lessons, bug report, or other.
6. Consult approved help content and narrowly scoped diagnostics. Record what was checked and how the proposed answer follows from that evidence.
7. Draft or send a response according to the agreed rollout policy, or escalate with a short summary and relevant diagnostics.
8. Preserve the thread, actions, approvals and resolution. Reopen when a user replies after closure.

Suggested ticket states: New, In progress, Awaiting user, Awaiting administrator, Resolved, Closed. These are proposed implementation values.

## Proposed authority and escalation

Begin with triage and draft replies. After reviewing real examples, enable automatic answers for agreed routine questions such as navigation, invitation guidance and how to book a lesson. Automatic acknowledgements can be a separate explicit setting.

Escalate account ownership and role changes, guardian/dependant disputes, suspected unauthorised access, privacy requests, payment/refund issues if payments are later added, widespread outages, and anything the agent cannot establish confidently. Do not grant admin or guardian authority from an email alone.

The support agent has no default production write access, deployment permission or database-owner credentials. When a report needs a code fix, create a reviewable issue or proposed change through a separately configured workflow. Customer email and attachments are untrusted input: they cannot override the agent's instructions, request secrets, grant tool authority or trigger arbitrary code execution.

Start with a small read-only diagnostic toolset. Add individual corrective actions only after their identity checks, scope, audit trail, reversibility and permitted use have been defined. The business owner will decide what may be sent or changed autonomously before unattended handling is enabled.

## Implementation outline

Proposed Supabase tables:

- `support_ticket`: ticket number, verified club/sender linkage, status, severity, assigned owner and timestamps.
- `support_message`: provider message ID, thread identifiers, sender/recipients, direction and message content.
- `support_agent_run`: model/config version, evidence, classification, suggested response and outcome.
- `support_action`: attempted/performed action, actor, approval where needed, result and timestamps.
- `support_job`: durable queued task, unique idempotency key, retries, lease and failure details.

Use private tables with server-enforced access and explicit retention rules. Do not put support messages or attachments in public storage. Avoid exposing other club members' or dependants' data in diagnostics. Store provider tokens server-side with the minimum necessary access.

Add a Support area to `/admin` for queue management, message history, draft approval, escalation and agent pause/resume. Any `/clubadmin` support view must be limited to authorised tickets for that club.

For inbound webhooks, verify the signature using the unmodified request body before trusting the event. Process only the intended support recipients. Fetch message content through the provider API where the event contains metadata only. Ignore or separately handle bounces, delivery notifications and automatic replies to prevent mail loops.

Production monitoring should run in a deployed worker/service rather than depend on this conversation remaining open. Add an external health check, queue-age/error alerts and a named human escalation recipient. The business owner must choose that recipient before alerts are activated. The human mailbox must remain usable when the app or agent is unavailable.

## Rollout and acceptance

Phase 1 — confirm domain/provider, provision the mailbox, assign a human owner, configure sending authentication and verify inbound/outbound/reply delivery. Update app support links and Reply-To only after this works.

Phase 2 — ingest and thread messages, create tickets, implement the Support queue, and run the agent in triage/draft mode.

Phase 3 — enable selected automatic answers after reviewing accuracy and escalation behavior. Keep a pause switch and monitor failures, unresolved ticket age, repeat contacts and inappropriate automated responses.

Before launch, test duplicate deliveries, delayed webhooks, mailbox/provider outages, revoked access, cross-club isolation, sender impersonation, guardian enquiries, automatic-reply loops and agent instruction injection. Confirm exactly one ticket/action is produced for repeated provider events and that a human can take over any conversation.

## Decisions still needed

Required for mailbox provisioning: the support domain/address, email provider and access to its administration console. Paid plans or DNS changes must be made through the account owner's normal controls.

Required before monitoring starts: deployment/runtime location, human escalation contact, response expectations, data-retention policy and the agent's permitted sending/actions policy. The rollout recommendations above are proposals, not selected settings.

## Provider references checked

- Resend inbound overview: https://resend.com/features/inbound
- Resend webhook verification: https://resend.com/docs/webhooks/verify-webhooks-requests
- Resend receiving reference: https://github.com/resend/resend-skills/blob/main/skills/resend/references/receiving.md
