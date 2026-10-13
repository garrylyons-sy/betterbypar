import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const migrationUrl = new URL("../supabase/last_man_standing.sql", import.meta.url);
const schemaUrl = new URL("../supabase/schema.sql", import.meta.url);

test("Last Man Standing has an additive migration", () => {
  assert.equal(existsSync(migrationUrl), true);
});

for (const [label, url] of [["migration", migrationUrl], ["canonical schema", schemaUrl]]) {
  test(`${label} defines the Last Man Standing competition model`, () => {
    const sql = readFileSync(url, "utf8");

    for (const table of [
      "last_man_standing_competition",
      "last_man_standing_round",
      "last_man_standing_round_schedule",
      "last_man_standing_entry",
      "last_man_standing_pick",
      "last_man_standing_team_order_snapshot",
      "last_man_standing_event"
    ]) {
      assert.match(sql, new RegExp(`create table(?: if not exists)? public\\.${table}`, "i"), `missing ${table}`);
      assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"), `${table} must deny direct Data API access`);
    }

    assert.match(sql, /audience text not null default 'League Chair'.*'League Chair'.*'Team'.*'Everyone'/is);
    assert.match(sql, /audience_team_id uuid references public\.team\(id\) on delete restrict/i);
    assert.match(sql, /processing_time time not null default '19:30'/i);
    assert.match(sql, /status text not null default 'Draft'.*'No Winner'.*'Archived'/is);
    assert.match(sql, /tier text not null check \(tier in \('A', 'B', 'C'\)\)/i);
    assert.match(sql, /slot_number integer not null check \(slot_number in \(1, 2\)\)/i);
    assert.match(sql, /unique \(competition_id, person_id\)/i);
    assert.match(sql, /unique \(entry_id, round_id, slot_number\)/i);
  });

  test(`${label} preserves fixture, game, player, and lineup evidence`, () => {
    const sql = readFileSync(url, "utf8");

    assert.match(sql, /fixture_week_id uuid not null references public\.fixture_week\(id\) on delete restrict/i);
    assert.match(sql, /selected_player_id uuid references public\.person\(id\) on delete restrict/i);
    assert.match(sql, /effective_player_id uuid references public\.person\(id\) on delete restrict/i);
    assert.match(sql, /source_fixture_id uuid references public\.fixture\(id\) on delete restrict/i);
    assert.match(sql, /source_game_id uuid references public\.game\(id\) on delete restrict/i);
    assert.match(sql, /source_lineup_slot_id uuid references public\.fixture_lineup_slot\(id\) on delete restrict/i);
    assert.match(sql, /table_order_snapshot jsonb not null default '\[\]'::jsonb/i);
  });

  test(`${label} indexes active work and makes audit events immutable`, () => {
    const sql = readFileSync(url, "utf8");

    assert.match(sql, /create index(?: if not exists)? last_man_standing_competition_status_idx/i);
    assert.match(sql, /create index(?: if not exists)? last_man_standing_round_status_idx/i);
    assert.match(sql, /create index(?: if not exists)? last_man_standing_entry_active_idx/i);
    assert.match(sql, /create index(?: if not exists)? last_man_standing_pick_effective_player_idx/i);
    assert.match(sql, /payload jsonb not null default '\{\}'::jsonb/i);
    assert.match(sql, /create trigger last_man_standing_event_immutable/i);
    assert.match(sql, /raise exception 'Last Man Standing events are immutable'/i);
  });
}

test("Last Man Standing automation has an additive migration", () => {
  const migration = new URL("../supabase/last_man_standing_automation.sql", import.meta.url);
  assert.equal(existsSync(migration), true);
  const sql = readFileSync(migration, "utf8");
  assert.match(sql, /add column if not exists processing_time time not null default '19:30'/i);
});

test("Last Man Standing audience controls have an additive migration", () => {
  const migration = new URL("../supabase/last_man_standing_audience.sql", import.meta.url);
  assert.equal(existsSync(migration), true);
  const sql = readFileSync(migration, "utf8");
  assert.match(sql, /add column if not exists audience_team_id uuid/i);
  assert.match(sql, /audience in \('League Chair', 'Team', 'Everyone'\)/i);
});
