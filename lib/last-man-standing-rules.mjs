const tierOrder = { A: 0, B: 1, C: 2 };

function tierForLeague(leagueName) {
  if (leagueName === "A League") return "A";
  if (leagueName === "B League") return "B";
  if (leagueName === "C League") return "C";
  return null;
}

export function resolveEntryTierOptions(roles) {
  const active = roles.filter((role) => role.active !== false && tierForLeague(role.leagueName));
  const playerRoles = active.filter((role) => role.role === "Player");
  const sourceRoles = playerRoles.length ? playerRoles : active.filter((role) => role.role === "Manager");
  const seen = new Set();
  const options = sourceRoles
    .map((role) => ({
      tier: tierForLeague(role.leagueName),
      sourceRole: role.role,
      teamId: role.teamId,
      teamName: role.teamName
    }))
    .filter((option) => {
      const key = `${option.tier}:${option.teamId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => (
      tierOrder[left.tier] - tierOrder[right.tier]
      || String(left.teamName).localeCompare(String(right.teamName))
    ));

  return { options, defaultOption: options[0] ?? null };
}

function zonedDateTime(dateText, timeText, timeZone) {
  const [year, month, day] = dateText.split("-").map(Number);
  const [hour, minute] = timeText.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const formatter = new Intl.DateTimeFormat("en-IE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  let instant = new Date(target);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
    const represented = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    instant = new Date(instant.getTime() - (represented - target));
  }
  return instant;
}

export function deadlineForEntry({ ownFixtureDate, defaultMatchDate, deadlineTime = "12:00" }) {
  const matchDate = ownFixtureDate || defaultMatchDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(matchDate ?? ""))) {
    throw new Error("A valid match date is required to calculate the pick deadline.");
  }
  if (!/^\d{2}:\d{2}$/.test(deadlineTime)) {
    throw new Error("A valid deadline time is required.");
  }
  return zonedDateTime(matchDate, deadlineTime, "Europe/Dublin");
}

export function canEditPicks(input) {
  const deadline = deadlineForEntry(input);
  const allowed = new Date(input.now).getTime() < deadline.getTime();
  return allowed
    ? {
        allowed: true,
        code: null,
        message: "Selections can be changed until 12:00 on the match day.",
        deadline: deadline.toISOString()
      }
    : {
        allowed: false,
        code: "PICKS_LOCKED",
        message: "Selections closed at 12:00 on the match day.",
        deadline: deadline.toISOString()
      };
}

export function validateManualPicks({ playerIds, candidates, consumedPlayerIds, tier }) {
  if (!Array.isArray(playerIds) || playerIds.length !== 2 || playerIds.some((id) => !id)) {
    return { valid: false, code: "TWO_PICKS_REQUIRED", message: "Choose two players." };
  }
  if (playerIds[0] === playerIds[1]) {
    return { valid: false, code: "DUPLICATE_PICK", message: "Choose two different players." };
  }

  const consumed = new Set(consumedPlayerIds);
  if (playerIds.some((id) => consumed.has(id))) {
    return { valid: false, code: "PLAYER_ALREADY_USED", message: "A player cannot be chosen twice in the same competition cycle." };
  }

  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const eligible = playerIds.every((id) => {
    const candidate = candidateById.get(id);
    return candidate
      && candidate.active !== false
      && candidate.registered === true
      && candidate.typedGuest !== true
      && candidate.tier === tier;
  });
  if (!eligible) {
    return { valid: false, code: "PLAYER_INELIGIBLE", message: "That player is not eligible for this competition tier." };
  }

  return { valid: true, code: null, message: "" };
}

function orderedTeams(sourceTeamId, teamOrder) {
  const sorted = [...teamOrder].sort((left, right) => left.position - right.position);
  const sourceIndex = sorted.findIndex((team) => team.teamId === sourceTeamId);
  if (sourceIndex < 0) return sorted;
  return [...sorted.slice(sourceIndex), ...sorted.slice(0, sourceIndex)];
}

export function orderedFallbackCandidates({
  sourceTeamId,
  tier,
  teamOrder,
  fixtures,
  lineupPlayers,
  consumedPlayerIds,
  excludedPlayerIds
}) {
  const unavailable = new Set([...consumedPlayerIds, ...excludedPlayerIds]);
  const activeFixtureByTeam = new Map();
  for (const fixture of fixtures) {
    if (fixture.status === "Cancelled" || fixture.status === "Postponed" || fixture.rescheduledOutsideRound) continue;
    activeFixtureByTeam.set(fixture.homeTeamId, fixture);
    activeFixtureByTeam.set(fixture.awayTeamId, fixture);
  }

  const candidates = [];
  for (const team of orderedTeams(sourceTeamId, teamOrder)) {
    const fixture = activeFixtureByTeam.get(team.teamId);
    if (!fixture) continue;

    const orderedLineup = lineupPlayers
      .filter((player) => player.teamId === team.teamId && player.fixtureId === fixture.id)
      .sort((left, right) => left.slotNumber - right.slotNumber || left.playerOrder - right.playerOrder);

    for (const player of orderedLineup) {
      if (
        unavailable.has(player.playerId)
        || player.active === false
        || player.registered !== true
        || player.typedGuest === true
        || player.tier !== tier
      ) {
        continue;
      }
      unavailable.add(player.playerId);
      candidates.push({
        playerId: player.playerId,
        sourceTeamId: team.teamId,
        sourceFixtureId: fixture.id,
        sourceLineupSlotId: player.lineupSlotId,
        automaticReason: "Automatic replacement from published lineup"
      });
    }
  }
  return candidates;
}

export function outcomeForPickedPlayer({ playerId, game }) {
  if (!game?.winnerTeamId) return "Pending";
  if (game.homePlayerIds.includes(playerId)) {
    return game.winnerTeamId === game.homeTeamId ? "Won" : "Lost";
  }
  if (game.awayPlayerIds.includes(playerId)) {
    return game.winnerTeamId === game.awayTeamId ? "Won" : "Lost";
  }
  return "Pending";
}
