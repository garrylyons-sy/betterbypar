"use client";

import { ChevronDown, Clock3, ListOrdered, Plus, Save, Search, ShieldCheck, Shuffle, Swords, Trash2, Trophy, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ladderMatchFormats } from "@/lib/club-ladder.mjs";
import { cn } from "@/lib/utils";

type LadderMatchFormat = "1 Frame" | "Best of 3" | "Best of 5";
type LadderInitialOrder = "Surname" | "Random";
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
type AdminLadder = LadderSettings & { id: string; entryCount: number };
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
  }

  function newLadder(club: AdminLadderClub) {
    const shortName = club.clubName.replace(" Golf Club", "");
    setEditingLadderId("new");
    setDraft({ ...defaults, name: club.ladders.length ? `${shortName} Ladder ${club.ladders.length + 1}` : `${shortName} Ladder` });
    setInitialPersonIds([]);
    setInitialOrder("Surname");
    setMemberSearch("");
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
          const eligibleMembers = club.members.filter((member) => !draft.eligibleTeamIds.length || member.teamIds.some((teamId) => draft.eligibleTeamIds.includes(teamId)));
          const visibleMembers = eligibleMembers.filter((member) => member.name.toLowerCase().includes(memberSearch.trim().toLowerCase()));
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
                        return <button key={team.id} type="button" onClick={() => { setDraft((current) => ({ ...current, eligibleTeamIds: selected ? current.eligibleTeamIds.filter((id) => id !== team.id) : [...current.eligibleTeamIds, team.id] })); setInitialPersonIds([]); }} className={cn("min-h-10 rounded-lg px-3 text-sm font-black ring-1", selected ? "bg-[#10233f] text-white ring-[#10233f]" : "bg-[#f7f5fa] text-[#10233f] ring-[#e3ddea]")}>{team.name}</button>;
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
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex min-h-11 items-center gap-3 rounded-lg bg-white px-3 font-bold ring-1 ring-[#eeeaf2]"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} />Available in My Club</label>
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedLadder ? <Button variant="secondary" onClick={() => void deleteLadder(club, selectedLadder)} disabled={saving} className="text-[#b42318]"><Trash2 className="h-4 w-4" />Delete ladder</Button> : null}
                      <Button onClick={() => void save(club.clubId)} disabled={saving}><Save className="h-4 w-4" />{saving ? "Saving..." : editingLadderId === "new" ? "Create ladder" : "Save settings"}</Button>
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
