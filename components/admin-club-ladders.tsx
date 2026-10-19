"use client";

import { ChevronDown, Clock3, History, ListOrdered, Plus, Save, Search, ShieldCheck, Shuffle, Swords, Trash2, Trophy, UserMinus, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ladderMatchFormats } from "@/lib/club-ladder.mjs";
import { cn } from "@/lib/utils";

type LadderMatchFormat = "1 Frame" | "Best of 3" | "Best of 5";
type LadderInitialOrder = "Surname" | "Random";
type AdminLadderEntry = {
  id: string;
  personId: string;
  name: string;
  position: number;
  status: "Active" | "Paused";
  handicap: number | null;
};
type LadderSettings = {
  name: string;
  matchFormat: LadderMatchFormat;
  challengeRange: number;
  responseHours: number;
  playWithinDays: number;
  useHandicap: boolean;
  eligibleTeamIds: string[];
  active: boolean;
};
type AdminLadder = LadderSettings & { id: string; entryCount: number; entries: AdminLadderEntry[] };
type LadderDetailKind = "activeChallenges" | "history";
type AdminLadderChallenge = {
  id: string;
  status: string;
  challengerName: string;
  challengedName: string;
  challengerPosition: number;
  challengedPosition: number;
  challengerScore: number | null;
  challengedScore: number | null;
  winnerName: string | null;
  responseDueAt: string | null;
  scheduledAt: string | null;
  playBy: string | null;
  recordedAt: string | null;
};
type AdminLadderClub = {
  clubId: string;
  clubName: string;
  logoPath: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  ladders: AdminLadder[];
  teams: Array<{ id: string; name: string }>;
  members: Array<{ personId: string; name: string; handicap: number | null; teamIds: string[] }>;
};

const defaults: LadderSettings = {
  name: "Club Ladder",
  matchFormat: "Best of 3",
  challengeRange: 3,
  responseHours: 48,
  playWithinDays: 14,
  useHandicap: true,
  eligibleTeamIds: [],
  active: true
};

function testAwarePath(path: string) {
  if (typeof window === "undefined") return path;
  const testUser = new URLSearchParams(window.location.search).get("testUser");
  return testUser ? `${path}${path.includes("?") ? "&" : "?"}testUser=${encodeURIComponent(testUser)}` : path;
}

function eligibleMembersForTeams(club: AdminLadderClub, eligibleTeamIds: string[]) {
  if (!eligibleTeamIds.length) return club.members;
  return club.members.filter((member) => member.teamIds.some((teamId) => eligibleTeamIds.includes(teamId)));
}

export function AdminClubLadders({ onMessage }: { onMessage: (message: string) => void }) {
  const [clubs, setClubs] = useState<AdminLadderClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openClubId, setOpenClubId] = useState<string | null>(null);
  const [editingLadderId, setEditingLadderId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<LadderSettings>(defaults);
  const [initialPersonIds, setInitialPersonIds] = useState<string[]>([]);
  const [initialOrder, setInitialOrder] = useState<LadderInitialOrder>("Surname");
  const [memberSearch, setMemberSearch] = useState("");
  const [addPersonIds, setAddPersonIds] = useState<string[]>([]);
  const [addMemberSearch, setAddMemberSearch] = useState("");
  const [openDetailKeys, setOpenDetailKeys] = useState<Record<string, boolean>>({});
  const [detailCache, setDetailCache] = useState<Record<string, AdminLadderChallenge[]>>({});
  const [loadingDetailKey, setLoadingDetailKey] = useState<string | null>(null);
  const [actionChallengeId, setActionChallengeId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(testAwarePath("/api/admin/ladders"), { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Ladders could not be loaded.");
      setClubs(data.clubs ?? []);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Ladders could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function selectLadder(ladder: AdminLadder) {
    setEditingLadderId(ladder.id);
    setDraft({
      name: ladder.name,
      matchFormat: ladder.matchFormat,
      challengeRange: ladder.challengeRange,
      responseHours: ladder.responseHours,
      playWithinDays: ladder.playWithinDays,
      useHandicap: ladder.useHandicap,
      eligibleTeamIds: ladder.eligibleTeamIds,
      active: ladder.active
    });
    setInitialPersonIds([]);
    setInitialOrder("Surname");
    setMemberSearch("");
    setAddPersonIds([]);
    setAddMemberSearch("");
  }

  function newLadder(club: AdminLadderClub) {
    const shortName = club.clubName.replace(" Golf Club", "");
    setEditingLadderId("new");
    setDraft({ ...defaults, name: club.ladders.length ? `${shortName} Ladder ${club.ladders.length + 1}` : `${shortName} Ladder` });
    setInitialPersonIds([]);
    setInitialOrder("Surname");
    setMemberSearch("");
    setAddPersonIds([]);
    setAddMemberSearch("");
  }

  function openClub(club: AdminLadderClub) {
    if (openClubId === club.clubId) {
      setOpenClubId(null);
      setEditingLadderId(null);
      return;
    }
    setOpenClubId(club.clubId);
    if (club.ladders[0]) selectLadder(club.ladders[0]);
    else newLadder(club);
  }

  function toggleEligibleTeam(club: AdminLadderClub, teamId: string) {
    const eligibleTeamIds = draft.eligibleTeamIds.includes(teamId)
      ? draft.eligibleTeamIds.filter((id) => id !== teamId)
      : [...draft.eligibleTeamIds, teamId];
    setDraft((current) => ({ ...current, eligibleTeamIds }));
    const eligibleMembers = eligibleMembersForTeams(club, eligibleTeamIds);
    if (editingLadderId === "new") {
      setInitialPersonIds(eligibleTeamIds.length
        ? eligibleMembers.map((member) => member.personId)
        : []);
    } else {
      const currentLadder = club.ladders.find((ladder) => ladder.id === editingLadderId);
      const currentEntryPersonIds = new Set(currentLadder?.entries.map((entry) => entry.personId) ?? []);
      setAddPersonIds(eligibleMembers
        .filter((member) => !currentEntryPersonIds.has(member.personId))
        .map((member) => member.personId));
    }
  }

  async function save(clubId: string) {
    setSaving(true);
    try {
      const response = await fetch(testAwarePath("/api/admin/ladders"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clubId,
          ladderId: editingLadderId === "new" ? null : editingLadderId,
          ...draft,
          initialPersonIds: editingLadderId === "new" ? initialPersonIds : [],
          initialOrder: editingLadderId === "new" ? initialOrder : "Surname"
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Ladder settings could not be saved.");
      setEditingLadderId(data.ladder.id);
      onMessage(editingLadderId === "new" ? "Club ladder created." : "Club ladder settings saved.");
      await load();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Ladder settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteLadder(club: AdminLadderClub, ladder: AdminLadder) {
    if (!window.confirm(`Permanently delete ${ladder.name} and all of its entries and challenges?`)) return;
    setSaving(true);
    try {
      const response = await fetch(testAwarePath("/api/admin/ladders"), {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clubId: club.clubId, ladderId: ladder.id })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Club ladder could not be deleted.");
      onMessage("Club ladder deleted.");
      const remaining = club.ladders.filter((item) => item.id !== ladder.id);
      if (remaining[0]) selectLadder(remaining[0]);
      else newLadder({ ...club, ladders: [] });
      await load();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Club ladder could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  async function removePlayer(club: AdminLadderClub, ladder: AdminLadder, entry: AdminLadderEntry) {
    if (!window.confirm(`Remove ${entry.name} from this ladder? Any unfinished challenge involving them will be cancelled.`)) return;
    setSaving(true);
    try {
      const response = await fetch(testAwarePath("/api/admin/ladders"), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clubId: club.clubId, ladderId: ladder.id, entryId: entry.id })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Player could not be removed from the ladder.");
      onMessage(`${entry.name} removed from ${ladder.name}.`);
      await load();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Player could not be removed from the ladder.");
    } finally {
      setSaving(false);
    }
  }

  async function addPlayers(club: AdminLadderClub, ladder: AdminLadder) {
    if (!addPersonIds.length) return;
    setSaving(true);
    try {
      const response = await fetch(testAwarePath("/api/admin/ladders"), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "addPlayers", clubId: club.clubId, ladderId: ladder.id, personIds: addPersonIds })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Players could not be added to the ladder.");
      onMessage(`${data.addedCount} player${data.addedCount === 1 ? "" : "s"} added to ${ladder.name}.`);
      setAddPersonIds([]);
      setAddMemberSearch("");
      await load();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Players could not be added to the ladder.");
    } finally {
      setSaving(false);
    }
  }

  async function loadLadderDetail(ladderId: string, detail: LadderDetailKind) {
    const key = `${ladderId}:${detail}`;
    const opening = !openDetailKeys[key];
    setOpenDetailKeys((current) => ({ ...current, [key]: !current[key] }));
    if (!opening || detailCache[key]) return;
    setLoadingDetailKey(key);
    try {
      const response = await fetch(testAwarePath(`/api/admin/ladders?ladderId=${encodeURIComponent(ladderId)}&detail=${detail}`), { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Ladder challenges could not be loaded.");
      setDetailCache((current) => ({ ...current, [key]: data.challenges ?? [] }));
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Ladder challenges could not be loaded.");
      setOpenDetailKeys((current) => ({ ...current, [key]: false }));
    } finally {
      setLoadingDetailKey(null);
    }
  }

  async function adminChallengeAction(clubId: string, ladderId: string, challengeId: string, action: "acceptChallenge" | "recordResult", scores?: { challengerScore: number; challengedScore: number }) {
    setActionChallengeId(challengeId);
    try {
      const response = await fetch(testAwarePath("/api/admin/ladders"), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clubId, ladderId, challengeId, action, ...scores })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The ladder challenge could not be updated.");
      onMessage(action === "acceptChallenge" ? "Challenge accepted on the player's behalf." : "Ladder result recorded.");

      const detail = "activeChallenges";
      const key = `${ladderId}:${detail}`;
      const detailResponse = await fetch(testAwarePath(`/api/admin/ladders?ladderId=${encodeURIComponent(ladderId)}&detail=${detail}`), { cache: "no-store" });
      const detailData = await detailResponse.json().catch(() => ({}));
      if (detailResponse.ok) setDetailCache((current) => ({ ...current, [key]: detailData.challenges ?? [] }));
      setDetailCache((current) => {
        const next = { ...current };
        delete next[`${ladderId}:history`];
        return next;
      });
      await load();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "The ladder challenge could not be updated.");
    } finally {
      setActionChallengeId(null);
    }
  }

  const activeCount = clubs.reduce((total, club) => total + club.ladders.filter((ladder) => ladder.active).length, 0);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Club Ladders</CardTitle>
          <p className="mt-1 text-sm font-semibold text-[#6c5a73]">Run multiple club-wide or team-restricted ladders, with independent formats and handicap rules.</p>
        </div>
        <Badge variant="cyan">{loading ? "Loading" : `${activeCount} active`}</Badge>
      </CardHeader>
      <CardContent className="grid gap-2">
        {clubs.map((club) => {
          const open = openClubId === club.clubId;
          const color = club.primaryColor || "#10233f";
          const selectedLadder = club.ladders.find((ladder) => ladder.id === editingLadderId) ?? null;
          const eligibleMembers = eligibleMembersForTeams(club, draft.eligibleTeamIds);
          const visibleMembers = eligibleMembers.filter((member) => member.name.toLowerCase().includes(memberSearch.trim().toLowerCase()));
          const addableMembers = selectedLadder
            ? eligibleMembers.filter((member) => !selectedLadder.entries.some((entry) => entry.personId === member.personId))
            : [];
          const eligibilityChanged = Boolean(selectedLadder)
            && (draft.eligibleTeamIds.length !== selectedLadder!.eligibleTeamIds.length
              || draft.eligibleTeamIds.some((teamId) => !selectedLadder!.eligibleTeamIds.includes(teamId)));
          const eligiblePersonIds = new Set(eligibleMembers.map((member) => member.personId));
          const entriesLosingEligibility = selectedLadder?.entries.filter((entry) => !eligiblePersonIds.has(entry.personId)) ?? [];
          const visibleAddableMembers = addableMembers.filter((member) => member.name.toLowerCase().includes(addMemberSearch.trim().toLowerCase()));
          return (
            <section key={club.clubId} className="overflow-hidden rounded-xl border border-[#eeeaf2] bg-white">
              <button type="button" onClick={() => openClub(club)} className="grid w-full grid-cols-[44px_minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-3 text-left" aria-expanded={open}>
                <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-lg bg-[#f7f5fa] ring-1 ring-[#eeeaf2]">
                  {club.logoPath ? <img src={club.logoPath} alt="" className="h-full w-full object-contain p-1.5" /> : <Trophy className="h-5 w-5" style={{ color }} />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-black text-[#10233f]">{club.clubName.replace(" Golf Club", "")}</span>
                  <span className="block truncate text-xs font-semibold text-[#6c5a73]">{club.ladders.length ? `${club.ladders.length} ladder${club.ladders.length === 1 ? "" : "s"} · ${club.ladders.reduce((sum, ladder) => sum + ladder.entryCount, 0)} entries` : "Not configured"}</span>
                </span>
                <Badge variant={club.ladders.some((ladder) => ladder.active) ? "green" : "muted"}>{club.ladders.some((ladder) => ladder.active) ? "Active" : "Off"}</Badge>
                <ChevronDown className={cn("h-5 w-5 transition-transform", open && "rotate-180")} />
              </button>
              {open ? (
                <div className="grid gap-4 border-t border-[#eeeaf2] bg-[#fbfafc] p-3 sm:p-4">
                  <div className="flex flex-wrap gap-2">
                    {club.ladders.map((ladder) => (
                      <button key={ladder.id} type="button" onClick={() => selectLadder(ladder)} className={cn("flex min-h-11 items-center gap-2 rounded-lg px-3 text-left ring-1", editingLadderId === ladder.id ? "bg-[#10233f] text-white ring-[#10233f]" : "bg-white text-[#10233f] ring-[#e3ddea]") }>
                        <Trophy className="h-4 w-4" />
                        <span><span className="block text-sm font-black">{ladder.name}</span><span className={cn("block text-[10px] font-bold", editingLadderId === ladder.id ? "text-white/65" : "text-[#6c5a73]")}>{ladder.entryCount} players · {ladder.useHandicap ? "Handicap" : "Scratch"}</span></span>
                      </button>
                    ))}
                    <Button type="button" size="sm" variant={editingLadderId === "new" ? "default" : "secondary"} onClick={() => newLadder(club)}><Plus className="h-4 w-4" />New ladder</Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[minmax(15rem,1.2fr)_repeat(4,minmax(0,1fr))]">
                    <label className="grid min-w-0 gap-1 sm:col-span-2 lg:col-span-1"><span className="text-[11px] font-black uppercase text-[#6c5a73]">Name</span><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#e3ddea] bg-white px-3 font-bold" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
                    <label className="grid min-w-0 gap-1"><span className="text-[11px] font-black uppercase text-[#6c5a73]">Match format</span><select className="min-h-11 w-full min-w-0 rounded-lg border border-[#e3ddea] bg-white px-3 font-bold" value={draft.matchFormat} onChange={(event) => setDraft((current) => ({ ...current, matchFormat: event.target.value as LadderMatchFormat }))}>{ladderMatchFormats.map((format) => <option key={format}>{format}</option>)}</select></label>
                    <NumberSetting label="Challenge places" value={draft.challengeRange} min={1} max={10} onChange={(challengeRange) => setDraft((current) => ({ ...current, challengeRange }))} />
                    <NumberSetting label="Reply within hours" value={draft.responseHours} min={12} max={168} onChange={(responseHours) => setDraft((current) => ({ ...current, responseHours }))} />
                    <NumberSetting label="Play within days" value={draft.playWithinDays} min={1} max={60} onChange={(playWithinDays) => setDraft((current) => ({ ...current, playWithinDays }))} />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <RuleSummary icon={Swords} text={`Challenge ${draft.challengeRange} places up`} />
                    <RuleSummary icon={Clock3} text={`${draft.responseHours} hours to reply`} />
                    <RuleSummary icon={ShieldCheck} text={`Play within ${draft.playWithinDays} days`} />
                  </div>

                  <div className="grid gap-3 rounded-xl bg-white p-3 ring-1 ring-[#eeeaf2]">
                    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-black text-[#10233f]">Who can join?</p><p className="mt-1 text-xs font-semibold text-[#6c5a73]">Choose teams for a restricted ladder, or leave all teams unselected for All club members.</p></div><Badge variant={draft.eligibleTeamIds.length ? "cyan" : "green"}>{draft.eligibleTeamIds.length ? `${draft.eligibleTeamIds.length} teams` : "All club members"}</Badge></div>
                    <div className="flex flex-wrap gap-2">
                      {club.teams.map((team) => {
                        const selected = draft.eligibleTeamIds.includes(team.id);
                        return <button key={team.id} type="button" onClick={() => toggleEligibleTeam(club, team.id)} className={cn("min-h-10 rounded-lg px-3 text-sm font-black ring-1", selected ? "bg-[#10233f] text-white ring-[#10233f]" : "bg-[#f7f5fa] text-[#10233f] ring-[#e3ddea]")}>{team.name}</button>;
                      })}
                    </div>
                    <label className="inline-flex w-fit min-h-11 items-center gap-3 rounded-lg bg-[#f7f5fa] px-3 font-bold ring-1 ring-[#eeeaf2]"><input type="checkbox" checked={draft.useHandicap} onChange={(event) => setDraft((current) => ({ ...current, useHandicap: event.target.checked }))} />Use club handicaps</label>
                  </div>

                  {editingLadderId === "new" ? (
                    <div className="grid gap-3 rounded-xl bg-white p-3 ring-1 ring-[#eeeaf2]">
                      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><p className="text-sm font-black text-[#10233f]">Add initial players</p><Badge variant="muted">Optional</Badge></div><p className="mt-1 text-xs font-semibold text-[#6c5a73]">Select the starting field and choose how their opening positions are drawn. Others can join later at the bottom.</p></div><Badge variant="cyan">{initialPersonIds.length} selected</Badge></div>
                      <div className="grid gap-2 rounded-lg bg-[#f7f5fa] p-2 ring-1 ring-[#eeeaf2] sm:grid-cols-2" role="group" aria-label="Starting order">
                        <button type="button" aria-pressed={initialOrder === "Surname"} onClick={() => setInitialOrder("Surname")} className={cn("flex min-h-12 items-center gap-3 rounded-lg px-3 text-left ring-1", initialOrder === "Surname" ? "bg-[#10233f] text-white ring-[#10233f]" : "bg-white text-[#10233f] ring-[#e3ddea]")}><ListOrdered className="h-5 w-5 shrink-0" /><span><span className="block text-sm font-black">Surname order</span><span className={cn("block text-[11px] font-semibold", initialOrder === "Surname" ? "text-white/70" : "text-[#6c5a73]")}>Predictable A-Z starting positions</span></span></button>
                        <button type="button" aria-pressed={initialOrder === "Random"} onClick={() => setInitialOrder("Random")} className={cn("flex min-h-12 items-center gap-3 rounded-lg px-3 text-left ring-1", initialOrder === "Random" ? "bg-[#10233f] text-white ring-[#10233f]" : "bg-white text-[#10233f] ring-[#e3ddea]")}><Shuffle className="h-5 w-5 shrink-0" /><span><span className="block text-sm font-black">Random draw</span><span className={cn("block text-[11px] font-semibold", initialOrder === "Random" ? "text-white/70" : "text-[#6c5a73]")}>Shuffle all selected players once</span></span></button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><label className="relative min-w-0"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6c5a73]" /><input className="min-h-10 w-full rounded-lg border border-[#e3ddea] bg-white pl-9 pr-3 text-sm font-bold" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Find a club member" /></label><Button type="button" size="sm" variant="secondary" onClick={() => setInitialPersonIds(eligibleMembers.map((member) => member.personId))}>Select all</Button><Button type="button" size="sm" variant="secondary" onClick={() => setInitialPersonIds([])}>Clear</Button></div>
                      <div className="grid max-h-64 gap-2 overflow-y-auto p-0.5 sm:grid-cols-2 xl:grid-cols-3">
                        {visibleMembers.map((member) => { const selected = initialPersonIds.includes(member.personId); return <label key={member.personId} className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ring-1", selected ? "bg-[#eaf8f4] ring-[#83d8c2]" : "bg-[#f7f5fa] ring-[#eeeaf2]")}><input type="checkbox" checked={selected} onChange={() => setInitialPersonIds((current) => selected ? current.filter((id) => id !== member.personId) : [...current, member.personId])} /><span className="min-w-0 flex-1 truncate text-sm font-extrabold text-[#10233f]">{member.name}</span><span className="shrink-0 rounded-md bg-white px-2 py-1 text-[10px] font-black uppercase text-[#6c5a73] ring-1 ring-[#ded7e5]" title={member.handicap === null ? "No handicap recorded" : `Handicap ${member.handicap}`}>Hcp {member.handicap ?? "-"}</span></label>; })}
                        {!visibleMembers.length ? <p className="text-sm font-semibold text-[#6c5a73]">No eligible club members match this search.</p> : null}
                      </div>
                      {!initialPersonIds.length ? <p className="text-xs font-bold text-[#b42318]">Select at least one player to create this ladder.</p> : null}
                    </div>
                  ) : null}

                  {selectedLadder ? (
                    <div className="grid gap-3 rounded-xl bg-white p-3 ring-1 ring-[#eeeaf2]">
                      {entriesLosingEligibility.length ? (
                        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
                          Saving these team changes will remove {entriesLosingEligibility.length} player{entriesLosingEligibility.length === 1 ? "" : "s"} who {entriesLosingEligibility.length === 1 ? "is" : "are"} no longer eligible. Their completed match history will be kept.
                        </p>
                      ) : null}
                      <div className="grid gap-3 rounded-lg bg-[#f7f5fa] p-3 ring-1 ring-[#eeeaf2]">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div><p className="text-sm font-black text-[#10233f]">Add players and managers</p><p className="mt-1 text-xs font-semibold text-[#6c5a73]">Eligible players and team managers are added at the bottom of the current ladder.</p></div>
                          <Badge variant="cyan">{addPersonIds.length} selected</Badge>
                        </div>
                        {addableMembers.length ? (
                          <>
                            {eligibilityChanged ? <p className="text-xs font-bold text-amber-800">Save team changes before adding players.</p> : null}
                            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                              <label className="relative min-w-0"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6c5a73]" /><input className="min-h-10 w-full rounded-lg border border-[#e3ddea] bg-white pl-9 pr-3 text-sm font-bold" value={addMemberSearch} onChange={(event) => setAddMemberSearch(event.target.value)} placeholder="Find an eligible person" /></label>
                              <Button type="button" size="sm" variant="secondary" onClick={() => setAddPersonIds(addableMembers.map((member) => member.personId))}>Select all</Button>
                              <Button type="button" size="sm" variant="secondary" onClick={() => setAddPersonIds([])}>Clear</Button>
                            </div>
                            <div className="grid max-h-56 gap-2 overflow-y-auto p-0.5 sm:grid-cols-2 xl:grid-cols-3">
                              {visibleAddableMembers.map((member) => { const selected = addPersonIds.includes(member.personId); return <label key={member.personId} className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ring-1", selected ? "bg-[#eaf8f4] ring-[#83d8c2]" : "bg-white ring-[#e3ddea]")}><input type="checkbox" checked={selected} onChange={() => setAddPersonIds((current) => selected ? current.filter((id) => id !== member.personId) : [...current, member.personId])} /><span className="min-w-0 flex-1 truncate text-sm font-extrabold text-[#10233f]">{member.name}</span><span className="shrink-0 rounded-md bg-white px-2 py-1 text-[10px] font-black uppercase text-[#6c5a73] ring-1 ring-[#ded7e5]">Hcp {member.handicap ?? "-"}</span></label>; })}
                              {!visibleAddableMembers.length ? <p className="text-sm font-semibold text-[#6c5a73]">No eligible people match this search.</p> : null}
                            </div>
                            <div className="flex justify-end"><Button type="button" onClick={() => void addPlayers(club, selectedLadder)} disabled={saving || !addPersonIds.length || eligibilityChanged}><UserPlus className="h-4 w-4" />Add selected to ladder</Button></div>
                          </>
                        ) : <p className="text-sm font-semibold text-[#6c5a73]">All eligible players and managers are already in this ladder.</p>}
                      </div>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-[#10233f]">Current players</p>
                          <p className="mt-1 text-xs font-semibold text-[#6c5a73]">Remove a player while keeping their completed ladder history. Any unfinished challenge is cancelled.</p>
                        </div>
                        <Badge variant="cyan">{selectedLadder.entries.length} players</Badge>
                      </div>
                      {selectedLadder.entries.length ? (
                        <div className="grid max-h-72 gap-2 overflow-y-auto p-0.5 sm:grid-cols-2 xl:grid-cols-3">
                          {selectedLadder.entries.map((entry) => (
                            <div key={entry.id} className="grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg bg-[#f7f5fa] px-3 py-2 ring-1 ring-[#eeeaf2]">
                              <span className="grid h-8 min-w-8 place-items-center rounded-md bg-[#10233f] px-2 text-xs font-black text-white">#{entry.position}</span>
                              <span className="min-w-0 truncate text-sm font-extrabold text-[#10233f]">{entry.name}</span>
                              <span className="shrink-0 rounded-md bg-white px-2 py-1 text-[10px] font-black uppercase text-[#6c5a73] ring-1 ring-[#ded7e5]">Hcp {entry.handicap ?? "-"}</span>
                              <Button type="button" size="icon" variant="secondary" className="h-9 w-9 text-[#b42318]" onClick={() => void removePlayer(club, selectedLadder, entry)} disabled={saving} aria-label={`Remove ${entry.name} from this ladder`} title={`Remove ${entry.name}`}><UserMinus className="h-4 w-4" /></Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-lg bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">No players are currently in this ladder.</p>
                      )}
                      <div className="grid gap-2 sm:grid-cols-2">
                        <LadderDetailAccordion
                          title="Active challenges"
                          icon={Swords}
                          detailKey={`${selectedLadder.id}:activeChallenges`}
                          open={Boolean(openDetailKeys[`${selectedLadder.id}:activeChallenges`])}
                          loadingDetailKey={loadingDetailKey}
                          challenges={detailCache[`${selectedLadder.id}:activeChallenges`]}
                          onToggle={() => void loadLadderDetail(selectedLadder.id, "activeChallenges")}
                          actionChallengeId={actionChallengeId}
                          onAction={(challengeId, action, scores) => void adminChallengeAction(club.clubId, selectedLadder.id, challengeId, action, scores)}
                        />
                        <LadderDetailAccordion
                          title="Match history"
                          icon={History}
                          detailKey={`${selectedLadder.id}:history`}
                          open={Boolean(openDetailKeys[`${selectedLadder.id}:history`])}
                          loadingDetailKey={loadingDetailKey}
                          challenges={detailCache[`${selectedLadder.id}:history`]}
                          onToggle={() => void loadLadderDetail(selectedLadder.id, "history")}
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex min-h-11 items-center gap-3 rounded-lg bg-white px-3 font-bold ring-1 ring-[#eeeaf2]"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} />Available in My Club</label>
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedLadder ? <Button variant="secondary" onClick={() => void deleteLadder(club, selectedLadder)} disabled={saving} className="text-[#b42318]"><Trash2 className="h-4 w-4" />Delete ladder</Button> : null}
                      <Button onClick={() => void save(club.clubId)} disabled={saving || (editingLadderId === "new" && !initialPersonIds.length)}><Save className="h-4 w-4" />{saving ? "Saving..." : editingLadderId === "new" ? "Create ladder" : "Save settings"}</Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}
        {!loading && !clubs.length ? <p className="rounded-xl bg-[#f7f5fa] p-4 text-sm font-bold text-[#6c5a73]">No clubs are available.</p> : null}
      </CardContent>
    </Card>
  );
}

function NumberSetting({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="grid min-w-0 gap-1"><span className="text-[11px] font-black uppercase text-[#6c5a73]">{label}</span><input type="number" min={min} max={max} className="min-h-11 w-full min-w-0 rounded-lg border border-[#e3ddea] bg-white px-3 font-bold" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function RuleSummary({ icon: Icon, text }: { icon: typeof Users; text: string }) {
  return <div className="flex min-h-12 items-center gap-2 rounded-lg bg-white px-3 ring-1 ring-[#eeeaf2]"><Icon className="h-4 w-4 shrink-0 text-[#1b8a72]" /><span className="text-xs font-extrabold text-[#10233f]">{text}</span></div>;
}

function LadderDetailAccordion({ title, icon: Icon, detailKey, open, loadingDetailKey, challenges, onToggle, actionChallengeId, onAction }: {
  title: string;
  icon: typeof Swords;
  detailKey: string;
  open: boolean;
  loadingDetailKey: string | null;
  challenges: AdminLadderChallenge[] | undefined;
  onToggle: () => void;
  actionChallengeId?: string | null;
  onAction?: (challengeId: string, action: "acceptChallenge" | "recordResult", scores?: { challengerScore: number; challengedScore: number }) => void;
}) {
  const loading = loadingDetailKey === detailKey;
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, { challenger: number; challenged: number }>>({});
  return (
    <div className="overflow-hidden rounded-lg bg-[#f7f5fa] ring-1 ring-[#eeeaf2]">
      <button type="button" className="flex min-h-12 w-full items-center gap-2 px-3 text-left" onClick={onToggle} aria-expanded={open}>
        <Icon className="h-4 w-4 text-[#1b8a72]" />
        <span className="flex-1 text-sm font-black text-[#10233f]">{title}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="grid gap-2 border-t border-[#e3ddea] p-3">
          {loading ? <p className="text-xs font-bold text-[#6c5a73]">Loading...</p> : null}
          {!loading && challenges?.map((challenge) => (
            <div key={challenge.id} className="rounded-lg bg-white p-3 ring-1 ring-[#eeeaf2]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black text-[#10233f]">#{challenge.challengerPosition} {challenge.challengerName} v #{challenge.challengedPosition} {challenge.challengedName}</p>
                <Badge variant={challenge.status === "Completed" || challenge.status === "Walkover" ? "green" : "cyan"}>{challenge.status}</Badge>
              </div>
              {challenge.challengerScore !== null && challenge.challengedScore !== null ? <p className="mt-1 text-sm font-black text-[#10233f]">{challenge.challengerScore}-{challenge.challengedScore}{challenge.winnerName ? ` · ${challenge.winnerName} won` : ""}</p> : null}
              <p className="mt-1 text-[11px] font-bold text-[#6c5a73]">
                {challenge.recordedAt ? `Recorded ${formatAdminDate(challenge.recordedAt)}` : challenge.scheduledAt ? `Scheduled ${formatAdminDate(challenge.scheduledAt)}` : challenge.playBy ? `Play by ${formatAdminDate(challenge.playBy)}` : challenge.responseDueAt ? `Reply by ${formatAdminDate(challenge.responseDueAt)}` : ""}
              </p>
              {onAction && challenge.status === "Pending" ? (
                <div className="mt-3 flex justify-end">
                  <Button type="button" size="sm" onClick={() => onAction(challenge.id, "acceptChallenge")} disabled={actionChallengeId === challenge.id}><ShieldCheck className="h-4 w-4" />Accept challenge</Button>
                </div>
              ) : null}
              {onAction && ["Accepted", "Scheduled", "Result Pending", "Disputed"].includes(challenge.status) ? (() => {
                const scores = scoreDrafts[challenge.id] ?? { challenger: challenge.challengerScore ?? 0, challenged: challenge.challengedScore ?? 0 };
                return (
                  <div className="mt-3 grid gap-2 border-t border-[#eeeaf2] pt-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] sm:items-end">
                    <label className="grid gap-1"><span className="truncate text-[10px] font-black uppercase text-[#6c5a73]">{challenge.challengerName}</span><input type="number" min={0} max={3} value={scores.challenger} onChange={(event) => setScoreDrafts((current) => ({ ...current, [challenge.id]: { ...scores, challenger: Number(event.target.value) } }))} className="min-h-10 w-full rounded-lg border border-[#e3ddea] bg-white px-3 text-center font-black" /></label>
                    <span className="hidden pb-2 text-sm font-black text-[#6c5a73] sm:block">-</span>
                    <label className="grid gap-1"><span className="truncate text-[10px] font-black uppercase text-[#6c5a73]">{challenge.challengedName}</span><input type="number" min={0} max={3} value={scores.challenged} onChange={(event) => setScoreDrafts((current) => ({ ...current, [challenge.id]: { ...scores, challenged: Number(event.target.value) } }))} className="min-h-10 w-full rounded-lg border border-[#e3ddea] bg-white px-3 text-center font-black" /></label>
                    <Button type="button" size="sm" onClick={() => onAction(challenge.id, "recordResult", { challengerScore: scores.challenger, challengedScore: scores.challenged })} disabled={actionChallengeId === challenge.id}><Trophy className="h-4 w-4" />Record result</Button>
                  </div>
                );
              })() : null}
            </div>
          ))}
          {!loading && challenges && !challenges.length ? <p className="text-xs font-bold text-[#6c5a73]">Nothing to show yet.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function formatAdminDate(value: string) {
  return new Date(value).toLocaleString("en-IE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
