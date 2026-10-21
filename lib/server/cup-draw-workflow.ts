import { notifyCupDrawConfirmed } from "@/lib/server/cup-draw-notifications";
import { validateCupDrawAudience } from "@/lib/cup-draw-notification-policy.mjs";
import { cupDrawRevealOrder } from "@/lib/cup-draw-presentation.mjs";
import { randomInt } from "node:crypto";
import type { PoolClient } from "pg";
import { buildCupBracket } from "@/lib/server/cup-draw.mjs";
import { publishCupBracket } from "@/lib/server/cup-competitions";

type DrawInput = { action: string; attemptId?: string; reason?: string; witnessName?: string; revealedCount?: number; notificationAudience?: unknown };
type Snapshot = { entries: {team_id:string;team_name:string}[]; rounds: {round_number:number;name:string;fixture_date:string}[]; bracket: ReturnType<typeof buildCupBracket>; revealOrder?: number[] };
type Attempt = {id:string;attempt_number:number;status:string;revealed_count:number;snapshot:Snapshot};

export async function changeCupDraw(client: PoolClient, competitionId: string, actorPersonId: string, input: DrawInput) {
  if (!["draw", "redraw", "reveal", "confirm"].includes(input.action)) throw new Error("Choose a valid draw action.");
  const competition = (await client.query<{status:string;round_count:number}>(
    `select status, round_count from public.cup_competition where id = $1 for update`, [competitionId]
  )).rows[0];
  if (!competition) throw new Error("Cup competition not found.");
  if (competition.status !== "Draft") throw new Error("This draw is already confirmed and published.");
  const latest = (await client.query<Attempt>(`select * from public.cup_draw_attempt where competition_id = $1 order by attempt_number desc limit 1 for update`, [competitionId])).rows[0];
  if (input.action === "draw" && latest) throw new Error("A provisional draw already exists. Review it or choose Redraw.");
  if (input.action !== "draw" && (!latest || latest.id !== input.attemptId || latest.status !== "Provisional")) throw new Error("The latest draw has changed. Refresh before continuing.");

  if (input.action === "draw" || input.action === "redraw") {
    const reason = String(input.reason ?? "").trim();
    if (input.action === "redraw" && (!reason || reason.length > 500)) throw new Error("Enter a redraw reason (up to 500 characters).");
    const entries = (await client.query<Snapshot['entries'][number]>(`select ce.team_id, t.name as team_name from public.cup_competition_entry ce join public.team t on t.id = ce.team_id where ce.competition_id = $1 order by ce.team_id`, [competitionId])).rows;
    const rounds = (await client.query<Snapshot['rounds'][number]>(`select round_number, name, fixture_date::text from public.cup_competition_round where competition_id = $1 order by round_number`, [competitionId])).rows;
    if (rounds.length !== competition.round_count) throw new Error("Cup round dates are incomplete.");
    const bracket = buildCupBracket({teamIds:entries.map(e=>e.team_id),roundCount:competition.round_count,random:()=>randomInt(0x100000000)/0x100000000});
    if (latest) await client.query(`update public.cup_draw_attempt set status = 'Superseded', redraw_reason = $2, superseded_by = $3, superseded_at = now() where id = $1`, [latest.id,reason,actorPersonId]);
    return (await client.query<Attempt>(`insert into public.cup_draw_attempt (competition_id, attempt_number, snapshot, created_by) values ($1, $2, $3::jsonb, $4) returning *`, [competitionId,(latest?.attempt_number??0)+1,JSON.stringify({entries,rounds,bracket,revealOrder:cupDrawRevealOrder(bracket)}),actorPersonId])).rows[0];
  }
  const attempt = latest!;
  const count = cupDrawRevealOrder(attempt.snapshot.bracket).length;
  if (input.action === "reveal") {
    // An absolute expected count makes retries/double taps idempotent.
    const next = input.revealedCount ?? attempt.revealed_count+1;
    if (!Number.isInteger(next) || next < 0 || next > attempt.revealed_count+1 || next > count) throw new Error("Reveal the next match in order.");
    await client.query(`update public.cup_draw_attempt set revealed_count = $2 where id = $1`, [attempt.id,Math.max(attempt.revealed_count,next)]);
    return;
  }
  const witnessName = String(input.witnessName??"").trim();
  if (!witnessName || witnessName.length > 120) throw new Error("Enter the witness name (up to 120 characters).");
  if (attempt.revealed_count < count) throw new Error("Reveal all matches before confirming the draw.");
  const audience = validateCupDrawAudience(input.notificationAudience);
  await publishCupBracket(client,competitionId,actorPersonId,attempt.snapshot.bracket);
  await client.query(`update public.cup_draw_attempt set status = 'Confirmed', witness_name = $2, confirmed_by = $3, confirmed_at = now(), notification_audience = $4::text[] where id = $1`, [attempt.id,witnessName,actorPersonId,audience]);
  const notificationSummary = await notifyCupDrawConfirmed(client,competitionId,attempt.id);
  await client.query(`update public.cup_draw_attempt set notification_summary = $2::jsonb where id=$1`, [attempt.id,JSON.stringify(notificationSummary)]);
  return {notificationSummary};
}
