import type { PoolClient } from "pg";

type DrawRound = {
  id: string;
  round_number: number;
};

type DrawEntry = {
  id: string;
};

export function shuffleDrawEntries<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function nextPowerOfTwo(value: number) {
  return 2 ** Math.ceil(Math.log2(value));
}

async function advanceWinnerToNextRound(
  client: PoolClient,
  rounds: DrawRound[],
  fromRoundNumber: number,
  fromMatchNumber: number,
  winnerEntryId: string
) {
  const nextRound = rounds.find((round) => round.round_number === fromRoundNumber + 1);
  if (!nextRound) return;

  const nextMatchNumber = Math.ceil(fromMatchNumber / 2);
  const winnerColumn = fromMatchNumber % 2 === 1 ? "player_1_entry_id" : "player_2_entry_id";
  await client.query(
    `insert into public.competition_match (competition_round_id, match_number, ${winnerColumn}, status)
     values ($1, $2, $3, 'Scheduled')
     on conflict (competition_round_id, match_number) do update
     set ${winnerColumn} = excluded.${winnerColumn},
         status = case
           when public.competition_match.player_1_entry_id is not null
            and public.competition_match.player_2_entry_id is not null
           then 'Scheduled'
           else public.competition_match.status
         end`,
    [nextRound.id, nextMatchNumber, winnerEntryId]
  );
}

export async function createCompetitionDraw(client: PoolClient, rounds: DrawRound[], entries: DrawEntry[]) {
  const firstRound = rounds[0];
  if (!firstRound) throw new Error("Add at least one round before running a draw.");
  if (entries.length < 2) throw new Error("At least two entrants are needed to run a draw.");

  const bracketCapacity = 2 ** rounds.length;
  if (entries.length > bracketCapacity) {
    throw new Error(`${entries.length} entrants need more than ${rounds.length} rounds. Add an earlier round before running the draw.`);
  }

  const drawn = shuffleDrawEntries(entries);
  const bracketSize = Math.min(bracketCapacity, nextPowerOfTwo(entries.length));
  const byeCount = bracketSize - drawn.length;
  const firstRoundMatchCount = bracketSize / 2;
  let entryIndex = 0;

  for (let matchNumber = 1; matchNumber <= firstRoundMatchCount; matchNumber += 1) {
    const player1 = drawn[entryIndex];
    entryIndex += 1;
    const hasBye = matchNumber <= byeCount;
    const player2 = hasBye ? null : drawn[entryIndex] ?? null;
    if (!hasBye) entryIndex += 1;

    await client.query(
      `insert into public.competition_match (
         competition_round_id,
         match_number,
         player_1_entry_id,
         player_2_entry_id,
         winner_entry_id,
         status
       )
       values ($1, $2, $3, $4, $5, $6)`,
      [firstRound.id, matchNumber, player1.id, player2?.id ?? null, player2 ? null : player1.id, player2 ? "Scheduled" : "Bye"]
    );

    if (!player2) {
      await advanceWinnerToNextRound(client, rounds, firstRound.round_number, matchNumber, player1.id);
    }
  }
}
