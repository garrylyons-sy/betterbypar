import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../supabase/league_chair_live_scoring.sql", import.meta.url), "utf8");
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

for (const [label, sql] of [["migration", migration], ["canonical schema", schema]]) {
  test(`${label} supports meaningful match activity logs`, () => {
    assert.match(sql, /'Match Action'/, "the activity enum should accept live-scoring audit entries");
  });

  test(`${label} defines the live frame snapshot`, () => {
    assert.match(sql, /create table(?: if not exists)? public\.live_frame_session/i);
    assert.match(sql, /game_id uuid not null references public\.game\(id\) on delete cascade/i);
    assert.match(sql, /fixture_id uuid not null references public\.fixture\(id\) on delete cascade/i);
    assert.match(sql, /status text not null default 'Live'.*Live.*Paused.*Completed.*Abandoned/is);
    assert.match(sql, /state jsonb not null/i);
    assert.match(sql, /version integer not null default 1 check \(version > 0\)/i);
    assert.match(sql, /scorer_person_id uuid references public\.person\(id\) on delete set null/i);
    assert.match(sql, /lease_expires_at timestamptz/i);
  });

  test(`${label} defines ordered immutable live frame events`, () => {
    assert.match(sql, /create table(?: if not exists)? public\.live_frame_event/i);
    assert.match(sql, /session_id uuid not null references public\.live_frame_session\(id\) on delete cascade/i);
    assert.match(sql, /sequence_number integer not null check \(sequence_number > 0\)/i);
    assert.match(sql, /event_type text not null check[\s\S]*'Start'[\s\S]*'Abandon'/i);
    assert.match(sql, /state_before jsonb/i);
    assert.match(sql, /state_after jsonb not null/i);
    assert.match(sql, /unique \(session_id, sequence_number\)/i);
    assert.match(sql, /create trigger live_frame_event_immutable/i);
  });

  test(`${label} enforces one active session and future realtime compatibility`, () => {
    assert.match(sql, /create unique index(?: if not exists)? live_frame_session_one_active_game_idx[\s\S]*where status in \('Live', 'Paused'\)/i);
    assert.match(sql, /alter table public\.live_frame_session replica identity full/i);
    assert.match(sql, /alter table public\.live_frame_event replica identity full/i);
  });
}
