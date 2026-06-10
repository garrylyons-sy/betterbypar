"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Home,
  LogOut,
  Mail,
  MessageCircle,
  PlusCircle,
  ShieldCheck,
  Trophy,
  UserCircle,
  Users,
  XCircle,
  Zap
} from "lucide-react";
import { clubTeamStructure, managementModules, playerGameResults as demoPlayerGameResults, recentResults, standings, teamContexts, upcomingFixture } from "@/lib/demo-data";
import type { PlayerGameResult, Standing, TeamContext } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Home", icon: Home },
  { label: "Fixtures", icon: CalendarDays },
  { label: "Table", icon: Trophy },
  { label: "Bookings", icon: CalendarPlus },
  { label: "Messages", icon: Mail }
] as const;

type AppPage = typeof navItems[number]["label"] | "Results" | "Players" | "Stats";

const quickTabs: AppPage[] = ["Fixtures", "Results", "Table", "Bookings", "Players", "Stats"];

export function AppShell({
  contexts = teamContexts,
  standingsData = standings,
  playerGameResults = demoPlayerGameResults,
  userLabel,
  onSignOut,
  onPageVisit
}: {
  contexts?: TeamContext[];
  standingsData?: Standing[];
  playerGameResults?: PlayerGameResult[];
  userLabel?: string;
  onSignOut?: () => void;
  onPageVisit?: (pageLabel: string, activeTeam: TeamContext) => void;
}) {
  const [selectedId, setSelectedId] = useState(contexts[0]?.id ?? teamContexts[0].id);
  const [activePage, setActivePage] = useState<AppPage>("Home");
  useEffect(() => {
    if (!contexts.some((team) => team.id === selectedId)) {
      setSelectedId(contexts[0]?.id ?? teamContexts[0].id);
    }
  }, [contexts, selectedId]);

  const activeTeam = useMemo(
    () => contexts.find((team) => team.id === selectedId) ?? contexts[0] ?? teamContexts[0],
    [contexts, selectedId]
  );
  const activeStandings = useMemo(() => {
    const filtered = standingsData.filter((row) => row.league === activeTeam.league && row.season === activeTeam.season);
    return filtered.length ? filtered : standings;
  }, [activeTeam.league, activeTeam.season, standingsData]);

  useEffect(() => {
    onPageVisit?.(activePage, activeTeam);
  }, [activePage, activeTeam, onPageVisit]);

  return (
    <main className="min-h-screen app-bg pb-24 text-[#10233f]">
      <Header activeTeam={activeTeam} contexts={contexts} onTeamChange={setSelectedId} userLabel={userLabel} />
      <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 pb-8 pt-4 sm:px-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)_380px] lg:items-start lg:gap-6 lg:px-8 xl:grid-cols-[230px_minmax(0,1fr)_400px] xl:px-10">
        <DesktopRail activeTeam={activeTeam} activePage={activePage} onNavigate={setActivePage} />
        <div className="grid gap-4">
          <MatchdayHero activeTeam={activeTeam} />
          <QuickTabs activePage={activePage} onNavigate={setActivePage} />
          <PageContent activePage={activePage} activeTeam={activeTeam} standingsData={activeStandings} playerGameResults={playerGameResults} onSignOut={onSignOut} userLabel={userLabel} />
        </div>
        <aside className="grid gap-4 lg:content-start">
          <LeagueTable activeTeam={activeTeam} standingsData={activeStandings} />
          <ClubTeamStructureCard />
          <MembershipManagement />
        </aside>
      </section>
      <BottomNav activePage={activePage} onNavigate={setActivePage} />
    </main>
  );
}

function PageContent({
  activePage,
  activeTeam,
  standingsData,
  playerGameResults,
  onSignOut,
  userLabel
}: {
  activePage: AppPage;
  activeTeam: TeamContext;
  standingsData: Standing[];
  playerGameResults: PlayerGameResult[];
  onSignOut?: () => void;
  userLabel?: string;
}) {
  if (activePage === "Bookings") return <TableBookings activeTeam={activeTeam} />;
  if (activePage === "Fixtures") return <FixturesPage />;
  if (activePage === "Results") return <ResultsPage playerGameResults={playerGameResults} />;
  if (activePage === "Table") return <LeagueTable activeTeam={activeTeam} standingsData={standingsData} />;
  if (activePage === "Players") return <PlayersPage playerGameResults={playerGameResults} />;
  if (activePage === "Stats") return <StatsPage activeTeam={activeTeam} playerGameResults={playerGameResults} />;
  if (activePage === "Messages") return <MessagesPage activeTeam={activeTeam} onSignOut={onSignOut} userLabel={userLabel} />;
  if (activeTeam.role === "Manager") return <ManagerHome activeTeam={activeTeam} />;
  if (activeTeam.role === "Club Member") return <ClubMemberHome activeTeam={activeTeam} />;
  return <PlayerHome activeTeam={activeTeam} playerGameResults={playerGameResults} />;
}

function Header({
  activeTeam,
  contexts,
  userLabel,
  onTeamChange
}: {
  activeTeam: TeamContext;
  contexts: TeamContext[];
  userLabel?: string;
  onTeamChange: (id: string) => void;
}) {
  return (
    <header className="sticky top-0 z-30 bg-[#10233f] px-4 py-3 text-white shadow-elevated sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-base font-black text-[#10233f]">
            IS
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-extrabold uppercase tracking-wide text-white/75">
              Interclub Snooker
            </p>
            <h1 className="truncate text-lg font-black leading-tight">{activeTeam.season}</h1>
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <ContextSwitcher activeTeam={activeTeam} contexts={contexts} onTeamChange={onTeamChange} />
          <button
            className="hidden h-11 w-11 place-items-center rounded-full bg-white/10 text-white sm:grid"
            aria-label={userLabel ? `Signed in as ${userLabel}` : "Open profile"}
          >
            <UserCircle className="h-6 w-6" />
          </button>
        </div>
      </div>
    </header>
  );
}

function ContextSwitcher({
  activeTeam,
  contexts,
  onTeamChange
}: {
  activeTeam: TeamContext;
  contexts: TeamContext[];
  onTeamChange: (id: string) => void;
}) {
  return (
    <label className="relative block w-full sm:w-auto">
      <span className="sr-only">Switch team context</span>
      <select
        value={activeTeam.id}
        onChange={(event) => onTeamChange(event.target.value)}
        className="h-11 w-full appearance-none rounded-full border border-white/15 bg-white px-4 pr-9 text-sm font-extrabold text-[#25002b] shadow-card outline-none sm:min-w-[220px]"
      >
        {contexts.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name} - {team.role}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-3 h-5 w-5 text-[#10233f]" />
    </label>
  );
}

function DesktopRail({ activeTeam, activePage, onNavigate }: { activeTeam: TeamContext; activePage: AppPage; onNavigate: (page: AppPage) => void }) {
  return (
    <aside className="hidden self-start rounded-[18px] bg-[#10233f] p-4 text-white shadow-card lg:sticky lg:top-24 lg:block">
      <p className="text-xs font-extrabold uppercase text-white/60">Competition</p>
      <h2 className="mt-1 text-2xl font-black">{activeTeam.league}</h2>
      <div className="mt-5 space-y-1.5">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => onNavigate(item.label)}
              className={cn(
                "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-extrabold text-white/80 transition-colors hover:bg-white/10",
                activePage === item.label && "bg-white text-[#10233f]"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function MatchdayHero({ activeTeam }: { activeTeam: TeamContext }) {
  const manager = activeTeam.role === "Manager";
  const clubMember = activeTeam.role === "Club Member";
  const hasLeagueTable = (activeTeam.leagueMatchesPlayed ?? 0) > 0;
  const played = activeTeam.leagueMatchesPlayed ?? 0;
  const won = activeTeam.matchesWon ?? 0;
  const points = activeTeam.leaguePoints ?? activeTeam.pointsFor ?? 0;
  const panelStyle = {
    background:
      `radial-gradient(circle at 16% 20%, ${activeTeam.primaryColor}55, transparent 11rem), ` +
      "linear-gradient(135deg, #071426 0%, #10233f 62%, #071b24 100%)"
  };

  return (
    <section className="overflow-hidden rounded-[18px] text-white shadow-card">
      <div className="relative p-4 sm:p-5 xl:p-6" style={panelStyle}>
        <div className="table-line-pattern absolute inset-0 opacity-20" />
        <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] xl:items-end">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white p-2 shadow-card ring-1 ring-white/40 sm:h-20 sm:w-20">
              <img src={activeTeam.logoPath} alt={`${activeTeam.club} logo`} className="max-h-full max-w-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="cyan">{activeTeam.role}</Badge>
                <Badge variant="muted">{activeTeam.league}</Badge>
                <Badge variant={hasLeagueTable && activeTeam.leaguePosition === 1 ? "gold" : hasLeagueTable ? "green" : "muted"}>
                  {hasLeagueTable ? `Position ${activeTeam.leaguePosition}` : "Table pending"}
                </Badge>
              </div>
              <p className="mt-5 text-xs font-extrabold uppercase tracking-wide text-white/70">
                {clubMember ? "Club member home" : manager ? "Manager home" : "Player home"}
              </p>
              <h2 className="mt-1 text-4xl font-black leading-none sm:text-5xl xl:text-6xl">{activeTeam.name}</h2>
              <p className="mt-2 text-sm font-semibold text-white/80">{activeTeam.club}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <HeroMetric label="Played" value={hasLeagueTable ? String(played) : "-"} />
            <HeroMetric label="Won" value={hasLeagueTable ? String(won) : "-"} />
            <HeroMetric label="Pts" value={hasLeagueTable ? String(points) : "-"} />
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-2 xl:max-w-[620px]">
          <Button className="w-full">
            <PlusCircle className="h-4 w-4" />
            {clubMember ? "Book table" : manager ? "Enter result" : "View stats"}
          </Button>
          <Button variant="secondary" className="w-full">
            <MessageCircle className="h-4 w-4" />
            Message
          </Button>
        </div>
      </div>
    </section>
  );
}

function QuickTabs({ activePage, onNavigate }: { activePage: AppPage; onNavigate: (page: AppPage) => void }) {
  return (
    <div className="w-full max-w-full">
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
        {quickTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => onNavigate(tab)}
            className={cn(
              "min-h-11 rounded-full px-3 text-sm font-extrabold",
              activePage === tab
                ? "bg-[#10233f] text-white shadow-card"
                : "bg-[#eeeaf2] text-[#25002b]"
            )}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}

type BookingSlot = {
  id: string;
  tableId: string;
  personId: string;
  bookedBy: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  canCancel: boolean;
  createdAt: string;
};

type BookingTable = {
  tableId: string;
  tableName: string;
  tableDescription: string;
};

type BookingPayload = {
  clubName: string;
  bookingDate: string;
  slotHours: number[];
  tables: BookingTable[];
  bookings: BookingSlot[];
};

function isoDateFromOffset(date: string, offsetDays: number) {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + offsetDays);
  return localIsoDate(next);
}

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatBookingDate(date: string) {
  return new Intl.DateTimeFormat("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(new Date(`${date}T12:00:00`));
}

function TableBookings({ activeTeam }: { activeTeam: TeamContext }) {
  const [bookingDate, setBookingDate] = useState(localIsoDate());
  const [payload, setPayload] = useState<BookingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busySlot, setBusySlot] = useState("");
  const currentLocalDate = localIsoDate();

  const loadBookings = async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/table-bookings?date=${bookingDate}`, { credentials: "same-origin" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Bookings unavailable.");
      setPayload(data);
    } catch (error) {
      setPayload(null);
      setMessage(error instanceof Error ? error.message : "Bookings unavailable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBookings();
  }, [bookingDate]);

  const bookingBySlot = useMemo(() => {
    const map = new Map<string, BookingSlot>();
    payload?.bookings.forEach((booking) => {
      map.set(`${booking.tableId}-${booking.startTime}`, booking);
    });
    return map;
  }, [payload]);

  const bookSlot = async (tableId: string, startHour: number) => {
    const key = `${tableId}-${startHour}`;
    setBusySlot(key);
    setMessage("");
    try {
      const response = await fetch("/api/table-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ tableId, bookingDate, startHour })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Booking failed.");
      await loadBookings();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Booking failed.");
    } finally {
      setBusySlot("");
    }
  };

  const cancelBooking = async (booking: BookingSlot) => {
    setBusySlot(booking.id);
    setMessage("");
    try {
      const response = await fetch(`/api/table-bookings/${booking.id}`, {
        method: "DELETE",
        credentials: "same-origin"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Cancellation failed.");
      await loadBookings();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cancellation failed.");
    } finally {
      setBusySlot("");
    }
  };

  return (
    <section className="grid gap-4">
      <Card className="overflow-hidden">
        <CardContent className="pt-4">
          <div className="rounded-[18px] bg-[#10233f] p-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase text-white/65">Table bookings</p>
                <h2 className="mt-1 text-3xl font-black leading-none">{activeTeam.club}</h2>
                <p className="mt-2 text-sm font-semibold text-white/75">Book hourly slots from 11:00 to 23:00.</p>
              </div>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <CalendarPlus className="h-6 w-6" />
              </span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button variant="secondary" size="icon" className="h-14 w-14 shrink-0" onClick={() => setBookingDate(isoDateFromOffset(bookingDate, -1))} aria-label="Previous day">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <label className="relative block min-w-0 flex-1">
                <span className="sr-only">Booking date</span>
                <span className="grid min-h-14 place-items-center rounded-full bg-white px-4 text-center text-base font-black text-[#25002b]">
                  {new Intl.DateTimeFormat("en-IE", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${bookingDate}T12:00:00`))}
                </span>
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(event) => setBookingDate(event.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
              <Button variant="secondary" size="icon" className="h-14 w-14 shrink-0" onClick={() => setBookingDate(isoDateFromOffset(bookingDate, 1))} aria-label="Next day">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            {bookingDate !== currentLocalDate ? (
              <Button variant="secondary" className="mt-3 w-full" onClick={() => setBookingDate(currentLocalDate)}>
                Today
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {message ? (
        <div className="rounded-[18px] bg-white p-4 text-sm font-extrabold text-[#1b8a72] shadow-card">
          {message}
        </div>
      ) : null}

      {loading ? (
        <BookingsSkeleton />
      ) : payload ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {payload.tables.map((table) => (
            <Card key={table.tableId} className="overflow-hidden">
              <CardHeader>
                <div>
                  <CardTitle>{table.tableName}</CardTitle>
                  <p className="mt-1 text-xs font-bold uppercase text-[#6c5a73]">{table.tableDescription}</p>
                </div>
                <Badge variant="cyan">{formatBookingDate(payload.bookingDate)}</Badge>
              </CardHeader>
              <CardContent className="grid gap-2">
                {payload.slotHours.map((hour) => {
                  const startTime = `${String(hour).padStart(2, "0")}:00`;
                  const booking = bookingBySlot.get(`${table.tableId}-${startTime}`);
                  const busy = busySlot === `${table.tableId}-${hour}` || busySlot === booking?.id;

                  return (
                    <div
                      key={`${table.tableId}-${hour}`}
                      className={cn(
                        "grid min-h-[72px] grid-cols-[72px_1fr] items-center gap-3 rounded-xl p-3 ring-1",
                        booking ? "bg-[#f7f5fa] ring-[#eeeaf2]" : "bg-white ring-[#eeeaf2]"
                      )}
                    >
                      <div className="text-center">
                        <p className="text-xl font-black leading-none">{startTime}</p>
                        <p className="mt-1 text-[11px] font-extrabold uppercase text-[#6c5a73]">{String(hour + 1).padStart(2, "0")}:00</p>
                      </div>
                      {booking ? (
                        <div className="flex min-w-0 items-center justify-between gap-2">
                          <div className="min-w-0">
                            <Badge variant={booking.canCancel ? "green" : "muted"}>{booking.canCancel ? "Your booking" : "Booked"}</Badge>
                            <p className="mt-1 truncate text-sm font-black">{booking.bookedBy}</p>
                          </div>
                          {booking.canCancel ? (
                            <Button variant="ghost" size="icon" onClick={() => cancelBooking(booking)} disabled={busy} aria-label={`Cancel ${table.tableName} at ${startTime}`}>
                              <XCircle className="h-5 w-5 text-[#1b8a72]" />
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <Button variant="dark" className="justify-self-end" onClick={() => bookSlot(table.tableId, hour)} disabled={busy}>
                          <Clock3 className="h-4 w-4" />
                          Book
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm font-semibold text-[#6c5a73]">Castle table bookings will appear here for signed-in Castle members.</p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function BookingsSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {[1, 2].map((table) => (
        <Card key={table}>
          <CardHeader>
            <div className="h-6 w-28 animate-pulse rounded-full bg-[#eeeaf2]" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-[#eeeaf2]" />
          </CardHeader>
          <CardContent className="grid gap-2">
            {[1, 2, 3, 4].map((slot) => (
              <div key={slot} className="h-[72px] animate-pulse rounded-xl bg-[#f7f5fa]" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PlayerHome({ activeTeam, playerGameResults }: { activeTeam: TeamContext; playerGameResults: PlayerGameResult[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:gap-5">
      <PlayerStatCard activeTeam={activeTeam} playerGameResults={playerGameResults} />
      <SeasonCompleteCard activeTeam={activeTeam} action="View results" />
      <RecentResults />
      <PlayerGameResultsCard results={playerGameResults} />
      <TeamPositionStrip activeTeam={activeTeam} />
    </section>
  );
}

function ClubMemberHome({ activeTeam }: { activeTeam: TeamContext }) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Club Access</CardTitle>
          <Badge variant="cyan">Member</Badge>
        </CardHeader>
        <CardContent className="grid gap-2">
          <MiniStat label="Club" value={activeTeam.club.replace(" Golf Club", "")} />
          <MiniStat label="Access" value="Tables" />
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
            Club members can receive club messages and book tables at their club.
          </p>
        </CardContent>
      </Card>
      <MessagesPage activeTeam={activeTeam} compact />
    </section>
  );
}

function FixturesPage() {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <SeasonCompleteCard action="View match" />
      <RecentResults />
    </section>
  );
}

function ResultsPage({ playerGameResults }: { playerGameResults: PlayerGameResult[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <ScoreCard />
      <RecentResults />
      <PlayerGameResultsCard results={playerGameResults} />
    </section>
  );
}

function PlayersPage({ playerGameResults }: { playerGameResults: PlayerGameResult[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <PlayerGameResultsCard results={playerGameResults} />
      <Card>
        <CardHeader>
          <CardTitle>Players</CardTitle>
          <Badge variant="muted">Team</Badge>
        </CardHeader>
        <CardContent className="grid gap-2">
          {["Garry Lyons", "Eric Goodwin", "Mark Byrne", "Karl Ward"].map((name) => (
            <div key={name} className="rounded-xl bg-[#f7f5fa] p-3 font-black">{name}</div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

function StatsPage({ activeTeam, playerGameResults }: { activeTeam: TeamContext; playerGameResults: PlayerGameResult[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <PlayerStatCard activeTeam={activeTeam} playerGameResults={playerGameResults} />
      <TeamPositionStrip activeTeam={activeTeam} />
      <PlayerGameResultsCard results={playerGameResults} />
    </section>
  );
}

function MessagesPage({ activeTeam, compact = false, onSignOut, userLabel }: { activeTeam: TeamContext; compact?: boolean; onSignOut?: () => void; userLabel?: string }) {
  return (
    <Card className={compact ? "" : "md:max-w-xl"}>
      <CardHeader>
        <CardTitle>Messages</CardTitle>
        <Badge variant="muted">{activeTeam.club}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="rounded-xl bg-[#f7f5fa] p-3">
          <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Club notice</p>
          <p className="mt-1 font-black">Table booking messages will appear here.</p>
        </div>
        <div className="rounded-xl bg-[#f7f5fa] p-3">
          <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Team notice</p>
          <p className="mt-1 font-black">Manager and club messages are coming next.</p>
        </div>
        {onSignOut ? (
          <div className="rounded-xl bg-[#f7f5fa] p-3">
            <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Account</p>
            <p className="mt-1 truncate text-sm font-bold text-[#6c5a73]">{userLabel ?? "Signed in"}</p>
            <Button variant="dark" className="mt-3 w-full" onClick={onSignOut}>
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ManagerHome({ activeTeam }: { activeTeam: TeamContext }) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <ManagerActionCard />
      <SeasonCompleteCard activeTeam={activeTeam} action="Review season" />
      <ScoreCard />
      <ManagerSeasonSnapshot activeTeam={activeTeam} />
    </section>
  );
}

function PlayerStatCard({ activeTeam = teamContexts[0], playerGameResults = demoPlayerGameResults }: { activeTeam?: TeamContext; playerGameResults?: PlayerGameResult[] }) {
  const wins = playerGameResults.filter((result) => result.result === "Won").length;
  const losses = playerGameResults.filter((result) => result.result === "Lost").length;
  const played = playerGameResults.length || activeTeam.leagueMatchesPlayed || 0;
  const winRate = playerGameResults.length ? Math.round((wins / playerGameResults.length) * 100) : activeTeam.leagueMatchesPlayed ? Math.round(((activeTeam.matchesWon ?? 0) / activeTeam.leagueMatchesPlayed) * 100) : 0;
  const pointsFor = activeTeam.pointsFor ?? activeTeam.leaguePoints ?? 0;
  const pointsAgainst = activeTeam.pointsAgainst ?? 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>{activeTeam.name} Season</CardTitle>
        <Badge variant="green">W W W L L</Badge>
      </CardHeader>
      <CardContent>
        <div className="rounded-[18px] bg-[#10233f] p-4 text-white">
          <p className="text-xs font-extrabold uppercase text-white/65">Points won</p>
          <p className="mt-1 text-6xl font-black leading-none">{pointsFor || "-"}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat label="Win rate" value={played ? `${winRate}%` : "-"} dark />
            <MiniStat label="Played" value={String(played || "-")} dark />
            <MiniStat label="Against" value={String(pointsAgainst || "-")} dark />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SeasonCompleteCard({ activeTeam = teamContexts[0], action }: { activeTeam?: TeamContext; action: string }) {
  const hasLeagueTable = (activeTeam.leagueMatchesPlayed ?? 0) > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Season Complete</CardTitle>
        <Badge variant={hasLeagueTable && activeTeam.leaguePosition <= 4 ? "green" : "muted"}>{hasLeagueTable && activeTeam.leaguePosition <= 4 ? "Qualified" : "Final table"}</Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-[18px] bg-[#f7f5fa] p-4">
          <div>
            <p className="text-xs font-extrabold uppercase text-[#6c5a73]">{activeTeam.club.replace(" Golf Club", "")}</p>
            <p className="mt-1 text-lg font-black">{activeTeam.name.replace(activeTeam.club.replace(" Golf Club", ""), "").trim() || activeTeam.name}</p>
          </div>
          <span className="rounded-full bg-[#10233f] px-3 py-1 text-xs font-black text-white">{hasLeagueTable ? `${activeTeam.leaguePosition}th` : "-"}</span>
          <div className="text-right">
            <p className="text-xs font-extrabold uppercase text-[#6c5a73]">{activeTeam.league}</p>
            <p className="mt-1 text-lg font-black leading-tight">{activeTeam.leaguePoints ?? activeTeam.pointsFor ?? "-"} pts</p>
          </div>
        </div>
        <p className="mt-3 text-sm font-semibold text-[#6c5a73]">{upcomingFixture.date}</p>
        <p className="text-sm font-semibold text-[#6c5a73]">{upcomingFixture.venue}</p>
        <Button className="mt-4 w-full">{action}</Button>
      </CardContent>
    </Card>
  );
}

function RecentResults() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Form</CardTitle>
        <Badge variant="cyan">Last 3</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {recentResults.map((fixture) => (
          <div key={fixture.id} className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-3 rounded-xl bg-[#f7f5fa] p-3">
            <div>
              <p className="font-black">{fixture.opponent}</p>
              <p className="text-xs font-semibold text-[#6c5a73]">{fixture.date} - {fixture.homeAway}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black">{fixture.score}</p>
              <Badge variant={fixture.result === "Won" ? "green" : "red"}>{fixture.result}</Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PlayerGameResultsCard({ results }: { results: PlayerGameResult[] }) {
  const [showAll, setShowAll] = useState(false);
  const wins = results.filter((result) => result.result === "Won").length;
  const losses = results.filter((result) => result.result === "Lost").length;
  const winRate = results.length ? Math.round((wins / results.length) * 100) : 0;
  const visibleResults = showAll ? results : results.slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Individual Games</CardTitle>
        <Badge variant="cyan">{results.length ? `${winRate}% win rate` : "No games yet"}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {visibleResults.map((game) => (
          <div key={game.gameId} className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-3 rounded-xl bg-[#f7f5fa] p-3">
            <div className="min-w-0">
              <p className="truncate font-black">v {game.opponentName}</p>
              <p className="truncate text-xs font-semibold text-[#6c5a73]">
                {game.sourceWeek} - Game {game.gameNumber} - {game.homeTeamName} {game.matchScore} {game.awayTeamName}
              </p>
            </div>
            <Badge variant={game.result === "Won" ? "green" : "red"}>{game.result}</Badge>
          </div>
        ))}
        {results.length === 0 ? (
          <p className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold text-[#6c5a73]">
            Imported player game results will appear here once this account is linked to player history.
          </p>
        ) : null}
        {results.length ? (
          <div className="grid grid-cols-3 gap-2 pt-1">
            <MiniStat label="Played" value={String(results.length)} />
            <MiniStat label="Won" value={String(wins)} />
            <MiniStat label="Lost" value={String(losses)} />
          </div>
        ) : null}
        {results.length > 6 ? (
          <Button variant="secondary" className="w-full" onClick={() => setShowAll((current) => !current)}>
            {showAll ? "Show fewer games" : `Show all ${results.length} games`}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TeamPositionStrip({ activeTeam }: { activeTeam: TeamContext }) {
  const hasLeagueTable = (activeTeam.leagueMatchesPlayed ?? 0) > 0;

  return (
    <Card className="md:self-start">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between rounded-[18px] bg-[var(--gradient-success)] p-4 text-[#25002b]">
          <div>
            <p className="text-xs font-extrabold uppercase">{hasLeagueTable ? "Team position" : "Table pending"}</p>
            <p className="text-lg font-black">{activeTeam.name}</p>
          </div>
          <div className="text-right">
            <p className="text-5xl font-black leading-none">{hasLeagueTable ? activeTeam.leaguePosition : "-"}</p>
            <p className="text-xs font-extrabold uppercase">{hasLeagueTable ? "Place" : "No matches yet"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ManagerActionCard() {
  return (
    <Card className="border-[#1b8a72]/20">
      <CardHeader>
        <CardTitle>Actions</CardTitle>
        <Badge variant="red">
          <Zap className="mr-1 h-3 w-3" />
          Live
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-2">
        <Button className="w-full">
          <ClipboardCheck className="h-4 w-4" />
          Review results
        </Button>
        <Button variant="dark" className="w-full">
          <Mail className="h-4 w-4" />
          Message squad
        </Button>
      </CardContent>
    </Card>
  );
}

function ScoreCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Final Score</CardTitle>
        <Badge variant="muted">Completed</Badge>
      </CardHeader>
      <CardContent>
        <div className="rounded-[18px] bg-[#10233f] p-4 text-white">
          <ScoreRow team="Castle A" score="4" winner />
          <ScoreRow team="Elm Park A" score="3" />
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreRow({ team, score, winner = false }: { team: string; score: string; winner?: boolean }) {
  return (
    <div className="flex min-h-12 items-center justify-between border-b border-white/10 last:border-0">
      <span className={cn("text-sm font-extrabold", winner ? "text-white" : "text-white/70")}>{team}</span>
      <span className={cn("text-4xl font-black", winner ? "text-[#00ff85]" : "text-white")}>{score}</span>
    </div>
  );
}

function ManagerSeasonSnapshot({ activeTeam = teamContexts[0] }: { activeTeam?: TeamContext }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Manager Snapshot</CardTitle>
        <Badge variant="muted">Regular season</Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="Won" value={String(activeTeam.matchesWon ?? "-")} />
          <MiniStat label="Lost" value={String(activeTeam.matchesLost ?? "-")} />
          <MiniStat label="Points for" value={String(activeTeam.pointsFor ?? "-")} />
          <MiniStat label="Points against" value={String(activeTeam.pointsAgainst ?? "-")} />
        </div>
        <div className="mt-3 rounded-xl bg-[#f7f5fa] p-3">
          <p className="text-xs font-extrabold uppercase text-[#6c5a73]">Playoff line</p>
          <p className="mt-1 font-black">{activeTeam.name} finished {activeTeam.leaguePosition || "-"}, inside the {activeTeam.league} semi-final places.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function LeagueTable({ activeTeam, standingsData = standings }: { activeTeam: TeamContext; standingsData?: Standing[] }) {
  const tableRows = standingsData.length ? standingsData : standings;

  return (
    <Card>
      <CardHeader>
        <CardTitle>League Table</CardTitle>
        <div className="flex gap-2">
          <Badge variant="gold">Final</Badge>
          <Badge variant="green">Semi</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="-mx-2 overflow-x-auto px-2">
          <table className="w-full min-w-[420px] border-separate border-spacing-0 text-left text-sm lg:min-w-0 lg:text-[13px] xl:text-sm">
            <thead className="sticky top-0 z-10 bg-white text-xs uppercase text-[#6c5a73]">
              <tr>
                <th className="py-2 pr-2">Pos</th>
                <th className="px-2">Team</th>
                <th className="px-2 text-right">P</th>
                <th className="hidden px-2 text-right sm:table-cell">W</th>
                <th className="hidden px-2 text-right sm:table-cell">L</th>
                <th className="px-2 text-right">Diff</th>
                <th className="px-2 text-right">Pts</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => {
                const active = row.team === activeTeam.name;
                const diff = row.pointsFor - row.pointsAgainst;

                return (
                  <tr
                    key={row.team}
                    tabIndex={0}
                    className={cn(
                      "border-t outline-none",
                      active && "bg-[#eeeaf2]"
                    )}
                  >
                    <td className="border-t border-[#eeeaf2] py-3 pr-2">
                      <span
                        className={cn(
                          "inline-grid h-8 w-8 place-items-center rounded-full text-xs font-black",
                          row.position === 1
                            ? "bg-[#ffb000] text-[#25002b]"
                            : row.position <= 4
                              ? "bg-[#00ff85] text-[#25002b]"
                              : "bg-[#eeeaf2] text-[#25002b]"
                        )}
                      >
                        {row.position}
                      </span>
                    </td>
                    <td className="whitespace-nowrap border-t border-[#eeeaf2] px-2 font-black">{row.team}</td>
                    <td className="border-t border-[#eeeaf2] px-2 text-right font-bold">{row.played}</td>
                    <td className="hidden border-t border-[#eeeaf2] px-2 text-right font-bold sm:table-cell">{row.won}</td>
                    <td className="hidden border-t border-[#eeeaf2] px-2 text-right font-bold sm:table-cell">{row.lost}</td>
                    <td className="border-t border-[#eeeaf2] px-2 text-right font-bold">{diff > 0 ? `+${diff}` : diff}</td>
                    <td className="border-t border-[#eeeaf2] px-2 text-right text-base font-black">{row.leaguePoints}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function MembershipManagement() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Membership</CardTitle>
        <Badge variant="muted">
          <ShieldCheck className="mr-1 h-3 w-3" />
          Supabase
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {managementModules.map((module) => (
          <div key={module.label} className="rounded-xl bg-[#f7f5fa] p-3">
            <p className="text-xs font-extrabold uppercase text-[#6c5a73]">{module.label}</p>
            <p className="mt-1 text-xl font-black">{module.value}</p>
            <p className="text-xs font-semibold text-[#6c5a73]">{module.detail}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ClubTeamStructureCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Club Teams</CardTitle>
        <Badge variant="cyan">2026/27</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {clubTeamStructure.map((club) => (
          <div key={club.club} className="rounded-xl bg-[#f7f5fa] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white p-1.5 ring-1 ring-[#eeeaf2]">
                  <img src={club.logoPath} alt={`${club.club} logo`} className="max-h-full max-w-full object-contain" />
                </span>
                <p className="font-black leading-tight">{club.club}</p>
              </div>
              <Badge variant="muted">{club.teams.length}</Badge>
            </div>
            <div className="mt-2 h-1.5 rounded-full" style={{ backgroundColor: club.primaryColor }} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {club.teams.map((team) => (
                <span key={team} className="rounded-full bg-white px-2 py-1 text-xs font-extrabold text-[#10233f] ring-1 ring-[#eeeaf2]">
                  {team}
                </span>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/20 backdrop-blur">
      <p className="text-xs font-extrabold uppercase text-white/65">{label}</p>
      <p className="mt-1 text-3xl font-black leading-none text-white">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, dark = false }: { label: string; value: string; dark?: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-xl p-3", dark ? "bg-white/10" : "bg-[#f7f5fa]")}>
      <p className={cn("text-xs font-extrabold uppercase", dark ? "text-white/60" : "text-[#6c5a73]")}>{label}</p>
      <p className={cn("mt-1 truncate text-xl font-black", dark ? "text-white" : "text-[#10233f]")}>{value}</p>
    </div>
  );
}

function BottomNav({ activePage, onNavigate }: { activePage: AppPage; onNavigate: (page: AppPage) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#eeeaf2] bg-white px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-elevated lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => onNavigate(item.label)}
              aria-current={activePage === item.label ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-extrabold text-[#6c5a73]",
                activePage === item.label && "bg-[#10233f] text-white shadow-card"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
