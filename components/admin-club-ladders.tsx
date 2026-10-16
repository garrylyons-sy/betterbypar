"use client";

import { ChevronDown, Clock3, Save, Search, ShieldCheck, Swords, Trash2, Trophy, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ladderMatchFormats } from "@/lib/club-ladder.mjs";
import { cn } from "@/lib/utils";

type LadderMatchFormat = "1 Frame" | "Best of 3" | "Best of 5";
type LadderSettings = { name: string; matchFormat: LadderMatchFormat; challengeRange: number; responseHours: number; playWithinDays: number; active: boolean };
type AdminLadderClub = {
  clubId: string;
  clubName: string;
  logoPath: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  ladder: (LadderSettings & { id: string; entryCount: number }) | null;
  members: Array<{ personId: string; name: string; handicap: number | null }>;
};

const defaults: LadderSettings = {
  name: "Club Ladder",
  matchFormat: "Best of 3",
  challengeRange: 3,
  responseHours: 48,
  playWithinDays: 14,
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
  const [draft, setDraft] = useState<LadderSettings>(defaults);
  const [initialPersonIds, setInitialPersonIds] = useState<string[]>([]);
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

  function openClub(club: AdminLadderClub) {
    if (openClubId === club.clubId) {
      setOpenClubId(null);
      return;
    }
    setOpenClubId(club.clubId);
    setInitialPersonIds([]);
    setMemberSearch("");
    setDraft(club.ladder ? {
      name: club.ladder.name,
      matchFormat: club.ladder.matchFormat,
      challengeRange: club.ladder.challengeRange,
      responseHours: club.ladder.responseHours,
      playWithinDays: club.ladder.playWithinDays,
      active: club.ladder.active
    } : { ...defaults, name: `${club.clubName.replace(" Golf Club", "")} Ladder` });
  }

  async function save(clubId: string) {
    setSaving(true);
    try {
      const response = await fetch(testAwarePath("/api/admin/ladders"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clubId, ...draft, initialPersonIds: clubId === openClubId ? initialPersonIds : [] })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Ladder settings could not be saved.");
      onMessage("Club ladder settings saved.");
      await load();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Ladder settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteLadder(club: AdminLadderClub) {
    if (!club.ladder || !window.confirm(`Permanently delete ${club.ladder.name} and all of its entries and challenges?`)) return;
    setSaving(true);
    try {
      const response = await fetch(testAwarePath("/api/admin/ladders"), {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clubId: club.clubId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Club ladder could not be deleted.");
      onMessage("Club ladder deleted.");
      setOpenClubId(null);
      await load();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Club ladder could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Club Ladders</CardTitle>
          <p className="mt-1 text-sm font-semibold text-[#6c5a73]">Configure one independent challenge ladder for each club.</p>
        </div>
        <Badge variant="cyan">{loading ? "Loading" : `${clubs.filter((club) => club.ladder?.active).length} active`}</Badge>
      </CardHeader>
      <CardContent className="grid gap-2">
        {clubs.map((club) => {
          const open = openClubId === club.clubId;
          const color = club.primaryColor || "#10233f";
          const visibleMembers = club.members.filter((member) => member.name.toLowerCase().includes(memberSearch.trim().toLowerCase()));
          return (
            <section key={club.clubId} className="overflow-hidden rounded-xl border border-[#eeeaf2] bg-white">
              <button
                type="button"
                onClick={() => openClub(club)}
                className="grid w-full grid-cols-[44px_minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-3 text-left"
                aria-expanded={open}
              >
                <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-lg bg-[#f7f5fa] ring-1 ring-[#eeeaf2]">
                  {club.logoPath ? <img src={club.logoPath} alt="" className="h-full w-full object-contain p-1.5" /> : <Trophy className="h-5 w-5" style={{ color }} />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-black text-[#10233f]">{club.clubName.replace(" Golf Club", "")}</span>
                  <span className="block truncate text-xs font-semibold text-[#6c5a73]">
                    {club.ladder ? `${club.ladder.matchFormat} · ${club.ladder.entryCount} players` : "Not configured"}
                  </span>
                </span>
                <Badge variant={club.ladder?.active ? "green" : "muted"}>{club.ladder?.active ? "Active" : "Off"}</Badge>
                <ChevronDown className={cn("h-5 w-5 transition-transform", open && "rotate-180")} />
              </button>
              {open ? (
                <div className="grid gap-4 border-t border-[#eeeaf2] bg-[#fbfafc] p-3 sm:p-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[minmax(15rem,1.2fr)_repeat(4,minmax(0,1fr))]">
                    <label className="grid min-w-0 gap-1 sm:col-span-2 lg:col-span-1">
                      <span className="text-[11px] font-black uppercase text-[#6c5a73]">Name</span>
                      <input className="min-h-11 w-full min-w-0 rounded-lg border border-[#e3ddea] bg-white px-3 font-bold" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                    </label>
                    <label className="grid min-w-0 gap-1">
                      <span className="text-[11px] font-black uppercase text-[#6c5a73]">Match format</span>
                      <select className="min-h-11 w-full min-w-0 rounded-lg border border-[#e3ddea] bg-white px-3 font-bold" value={draft.matchFormat} onChange={(event) => setDraft((current) => ({ ...current, matchFormat: event.target.value as LadderMatchFormat }))}>
                        {ladderMatchFormats.map((format) => <option key={format}>{format}</option>)}
                      </select>
                    </label>
                    <NumberSetting label="Challenge places" value={draft.challengeRange} min={1} max={10} onChange={(challengeRange) => setDraft((current) => ({ ...current, challengeRange }))} />
                    <NumberSetting label="Reply within hours" value={draft.responseHours} min={12} max={168} onChange={(responseHours) => setDraft((current) => ({ ...current, responseHours }))} />
                    <NumberSetting label="Play within days" value={draft.playWithinDays} min={1} max={60} onChange={(playWithinDays) => setDraft((current) => ({ ...current, playWithinDays }))} />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <RuleSummary icon={Swords} text={`Challenge ${draft.challengeRange} places up`} />
                    <RuleSummary icon={Clock3} text={`${draft.responseHours} hours to reply`} />
                    <RuleSummary icon={ShieldCheck} text={`Play within ${draft.playWithinDays} days`} />
                  </div>
                  {!club.ladder ? (
                    <div className="grid gap-3 rounded-xl bg-white p-3 ring-1 ring-[#eeeaf2]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-black text-[#10233f]">Add initial players</p>
                            <Badge variant="muted">Optional</Badge>
                          </div>
                          <p className="mt-1 text-xs font-semibold text-[#6c5a73]">Selected members start on the ladder in surname order. Others can join later.</p>
                        </div>
                        <Badge variant="cyan">{initialPersonIds.length} selected</Badge>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                        <label className="relative min-w-0">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6c5a73]" />
                          <input
                            className="min-h-10 w-full rounded-lg border border-[#e3ddea] bg-white pl-9 pr-3 text-sm font-bold"
                            value={memberSearch}
                            onChange={(event) => setMemberSearch(event.target.value)}
                            placeholder="Find a club member"
                          />
                        </label>
                        <Button type="button" size="sm" variant="secondary" onClick={() => setInitialPersonIds(club.members.map((member) => member.personId))}>Select all</Button>
                        <Button type="button" size="sm" variant="secondary" onClick={() => setInitialPersonIds([])}>Clear</Button>
                      </div>
                      <div className="grid max-h-64 gap-2 overflow-y-auto p-0.5 sm:grid-cols-2 xl:grid-cols-3">
                        {visibleMembers.map((member) => {
                          const selected = initialPersonIds.includes(member.personId);
                          return (
                            <label key={member.personId} className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ring-1", selected ? "bg-[#eaf8f4] ring-[#83d8c2]" : "bg-[#f7f5fa] ring-[#eeeaf2]")}>
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => setInitialPersonIds((current) => selected ? current.filter((id) => id !== member.personId) : [...current, member.personId])}
                              />
                              <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-[#10233f]">{member.name}</span>
                              <span
                                className="shrink-0 rounded-md bg-white px-2 py-1 text-[10px] font-black uppercase text-[#6c5a73] ring-1 ring-[#ded7e5]"
                                title={member.handicap === null ? "No handicap recorded" : `Handicap ${member.handicap}`}
                              >
                                Hcp {member.handicap ?? "-"}
                              </span>
                            </label>
                          );
                        })}
                        {!visibleMembers.length ? <p className="text-sm font-semibold text-[#6c5a73]">No matching club members.</p> : null}
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex min-h-11 items-center gap-3 rounded-lg bg-white px-3 font-bold ring-1 ring-[#eeeaf2]">
                      <input type="checkbox" checked={draft.active} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} />
                      Available in My Club
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {club.ladder ? (
                        <Button variant="secondary" onClick={() => void deleteLadder(club)} disabled={saving} className="text-[#b42318]">
                          <Trash2 className="h-4 w-4" />Delete ladder
                        </Button>
                      ) : null}
                      <Button onClick={() => void save(club.clubId)} disabled={saving}>
                        <Save className="h-4 w-4" />
                        {saving ? "Saving..." : club.ladder ? "Save settings" : "Create ladder"}
                      </Button>
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
  return (
    <label className="grid min-w-0 gap-1">
      <span className="text-[11px] font-black uppercase text-[#6c5a73]">{label}</span>
      <input type="number" min={min} max={max} className="min-h-11 w-full min-w-0 rounded-lg border border-[#e3ddea] bg-white px-3 font-bold" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function RuleSummary({ icon: Icon, text }: { icon: typeof Users; text: string }) {
  return (
    <div className="flex min-h-12 items-center gap-2 rounded-lg bg-white px-3 ring-1 ring-[#eeeaf2]">
      <Icon className="h-4 w-4 shrink-0 text-[#1b8a72]" />
      <span className="text-xs font-extrabold text-[#10233f]">{text}</span>
    </div>
  );
}
