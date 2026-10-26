# Rounds and coaching

Open **My Golf → Rounds & coaching**, or `/my-golf`. Home has shortcuts to record a round and open the journal. Lessons and existing professional drills remain under **Lessons & drills**. Home shows a **Your players** panel only for active linked dependants in the current club, with profile photo, Handicap Index and latest available round. Each card opens the correct player and club in My Golf. Dependant contact/profile management stays in More and the account menu; it is not promoted on Home.

## Recording

Choose 9 or 18 holes, course, date and tees. Enter hole strokes and optional par, putts, penalties and commentary. Shot tracking can record full shots, putts and individual penalty strokes, club, outcome and notes. **Use shot count as score** is explicit, so an incomplete shot list never silently overwrites a score. Record each penalty stroke separately. You can save a draft, reopen it, or finish a partially played round. Unplayed and picked-up holes remain distinct; a pickup never becomes a zero score. The card is a private journal and does not submit an official handicap score.

Stableford rounds currently retain a gross stroke card; net/Stableford calculations are not invented without the required rating/stroke-index data. Imports preserve an official Stableford total when provided. Unknown statistics remain blank. Completed rounds remain editable, and editing invalidates their prior coaching response. Conflicting browser edits require an explicit **Discard & reload** rather than overwriting another saved version. History loads in pages of 50, with access to earlier rounds.

## Importing

**Import from Golf Ireland** lists the selected player's three recent rounds supplied by the existing handicap-summary adapter. Importing the same score twice reopens the saved copy and preserves annotations. The live adapter reads `GET /api/ie/v1/scores/{scoreUID}` only after that score appears in the mapped player's recent record; the returned member UUID and score UUID must match. No write is sent to Golf Ireland. Imported course/date/format/handicap/hole scoring fields are read-only, while round/hole commentary and optional putt, penalty and shot observations are editable.

The API's detailed score arrays are card positions. When an actual physical-hole mapping or par is unavailable, the UI says **Card hole** and leaves par unknown. Detailed card length takes precedence over holes attempted, so an 18-hole card with two unplayed holes stays an 18-hole card. Aggregate-only data does not create fictional per-hole scores. Demo imports are separate `demo_golf_ireland` records, clearly labelled as samples, with illustrative hole details. Live imports require the club credentials/member mappings in [Golf Ireland setup](../golf-ireland-integration.md).

## Coaching

The approach is adapted from [betterbypar-original](https://github.com/garrylyons-sy/betterbypar-original), reference commit `233d54e18b6565915041ab1235f9055712834274`: `server.js` round review/assessment prompts and `schema.sql` rounds/hole scores/shots. It retains factual hole stories, psychology/course-management feedback, no swing-mechanics diagnosis, actual-versus-net score language, and three distinct next-round playing thoughts. The original app's match play, GPS and persistent coaching memory are separate capabilities and are not imported by this journal change.

Local demo always uses a **rules-based coaching preview**, not a live model. External AI keys are cleared by the demo launcher. Other environments default to off; enable explicitly with server-only settings:

```dotenv
ROUND_AI_MODE=live
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
```

This follows the original repository's configurable model default. The OpenAI Responses adapter uses strict JSON structured output, `store:false`, no tools, a fixed HTTPS endpoint and a timeout. Customer action explicitly requests sharing the saved card, commentary, optional shot observations and up to three earlier rounds for the same player/club. Structured profile fields omit names, Golf Ireland numbers, email and account IDs; text entered by the customer can of course contain personal details. Data is transmitted only on **Get AI feedback**, never on save/import. AI output is rendered as text, not HTML. Provider failures keep the round and notes intact and do not switch to fake AI.

Feedback is revision-bound, cached for an unchanged card, and requests are limited to one per round per minute. Revisions and permissions are rechecked before persisting a response. Every read/write is limited to a registered player or current guardian with active membership in the same club; operator status and coaching roles do not grant access to another player's journal. The table has RLS and no browser-role access; app-owned server sessions enforce access.

## Database setup

Apply `supabase/golf_rounds.sql` after the golf-player migration. Local demo startup applies it automatically. No source-repository users, keys, live rounds or sessions are imported. `scripts/verify-round-journal.mjs` applies the migration locally and checks draft/finish/feedback/import/annotations with disposable fixtures.

Official references: [Golf Ireland ISV API](https://isvapi.clubhouse.golfireland.ie/), [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
