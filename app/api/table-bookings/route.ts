import { NextRequest, NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { dbQuery, withTransaction } from "@/lib/server/db";

export const runtime = "nodejs";

const castleClubName = "Castle Golf Club";
const minStartHour = 11;
const maxStartHour = 22;
const bookingTimeZone = "Europe/Dublin";

type CastleAccessRow = {
  club_id: string;
};

type ClubTableRow = {
  table_id: string;
  table_name: string;
  table_description: string | null;
};

type BookingRow = {
  id: string;
  table_id: string;
  person_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  created_at: string;
  first_name: string;
  last_name: string;
};

async function castleClubForPerson(personId: string) {
  const { rows } = await dbQuery<CastleAccessRow>(
    `select club_id
     from (
       select c.id as club_id
       from public.person_team_role ptr
       join public.club_membership cm on cm.id = ptr.club_membership_id and cm.active = true
       join public.club c on c.id = cm.club_id and c.active = true
       where cm.person_id = $1
         and ptr.active = true
         and c.name = $2
       union
       select c.id as club_id
       from public.team_membership tm
       join public.team t on t.id = tm.team_id and t.active = true
       join public.club c on c.id = t.club_id and c.active = true
       where tm.person_id = $1
         and tm.active = true
         and c.name = $2
       union
       select c.id as club_id
       from public.club_membership cm
       join public.club c on c.id = cm.club_id and c.active = true
       where cm.person_id = $1
         and cm.active = true
         and c.name = $2
     ) access
     limit 1`,
    [personId, castleClubName]
  );
  return rows[0]?.club_id ?? null;
}

function validDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return value;
}

function validStartHour(value: unknown) {
  const hour = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(hour) || hour < minStartHour || hour > maxStartHour) return null;
  return hour;
}

function dublinClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-IE", {
    timeZone: bookingTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minutes: Number(value("hour")) * 60 + Number(value("minute"))
  };
}

function isPastBookingDate(bookingDate: string, now = new Date()) {
  return bookingDate < dublinClock(now).date;
}

function isPastBookingSlot(bookingDate: string, startHour: number, now = new Date()) {
  const clock = dublinClock(now);
  if (bookingDate < clock.date) return true;
  if (bookingDate > clock.date) return false;
  return startHour * 60 <= clock.minutes;
}

function availableSlotHours(bookingDate: string, now = new Date()) {
  const hours = Array.from({ length: maxStartHour - minStartHour + 1 }, (_, index) => minStartHour + index);
  return hours.filter((hour) => !isPastBookingSlot(bookingDate, hour, now));
}

function timeForHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function serializeBooking(row: BookingRow, currentPersonId: string) {
  return {
    id: row.id,
    tableId: row.table_id,
    personId: row.person_id,
    bookedBy: `${row.first_name} ${row.last_name}`.trim(),
    bookingDate: row.booking_date,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    canCancel: row.person_id === currentPersonId,
    createdAt: row.created_at
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const bookingDate = validDate(request.nextUrl.searchParams.get("date"));
    if (!bookingDate) return NextResponse.json({ error: "A valid booking date is required." }, { status: 400 });
    if (isPastBookingDate(bookingDate)) {
      return NextResponse.json({ error: "Bookings are only available from today onwards." }, { status: 400 });
    }

    const clubId = await castleClubForPerson(user.personId);
    if (!clubId) return NextResponse.json({ error: "Table bookings are currently available to Castle members only." }, { status: 403 });

    const [tablesResult, bookingsResult] = await Promise.all([
      dbQuery<ClubTableRow>(
        `select table_id, table_name, table_description
         from public.club_table
         where club_id = $1
           and active = true
         order by table_name`,
        [clubId]
      ),
      dbQuery<BookingRow>(
        `select
           tb.id,
           tb.table_id,
           tb.person_id,
           tb.booking_date::text,
           tb.start_time::text,
           tb.end_time::text,
           tb.created_at::text,
           p.first_name,
           p.last_name
         from public.table_booking tb
         join public.person p on p.id = tb.person_id
         where tb.club_id = $1
           and tb.booking_date = $2::date
           and tb.cancelled_at is null
         order by tb.start_time, tb.table_id`,
        [clubId, bookingDate]
      )
    ]);

    return NextResponse.json({
      clubId,
      clubName: castleClubName,
      bookingDate,
      slotHours: availableSlotHours(bookingDate),
      tables: tablesResult.rows.map((row) => ({
        tableId: row.table_id,
        tableName: row.table_name,
        tableDescription: row.table_description ?? ""
      })),
      bookings: bookingsResult.rows.map((row) => serializeBooking(row, user.personId))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bookings unavailable." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const body = await request.json().catch(() => null) as { tableId?: string; bookingDate?: string; startHour?: unknown } | null;
    const tableId = body?.tableId?.trim();
    const bookingDate = validDate(body?.bookingDate ?? null);
    const startHour = validStartHour(body?.startHour);

    if (!tableId || !bookingDate || startHour === null) {
      return NextResponse.json({ error: "Choose a table, date and hour between 11:00 and 22:00." }, { status: 400 });
    }
    if (isPastBookingSlot(bookingDate, startHour)) {
      return NextResponse.json({ error: "That booking time has already passed." }, { status: 400 });
    }

    const clubId = await castleClubForPerson(user.personId);
    if (!clubId) return NextResponse.json({ error: "Table bookings are currently available to Castle members only." }, { status: 403 });

    const startTime = timeForHour(startHour);
    const endTime = timeForHour(startHour + 1);

    const booking = await withTransaction(async (client) => {
      const tableResult = await client.query(
        `select table_id
         from public.club_table
         where table_id = $1
           and club_id = $2
           and active = true
         limit 1`,
        [tableId, clubId]
      );

      if (tableResult.rowCount === 0) {
        throw new Error("That table is not available for Castle bookings.");
      }

      const insertResult = await client.query<BookingRow>(
        `insert into public.table_booking (club_id, table_id, person_id, booking_date, start_time, end_time)
         values ($1, $2, $3, $4::date, $5::time, $6::time)
         returning
           id,
           table_id,
           person_id,
           booking_date::text,
           start_time::text,
           end_time::text,
           created_at::text,
           (select first_name from public.person where id = $3) as first_name,
           (select last_name from public.person where id = $3) as last_name`,
        [clubId, tableId, user.personId, bookingDate, startTime, endTime]
      );

      return insertResult.rows[0];
    });

    return NextResponse.json({ booking: serializeBooking(booking, user.personId) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Booking failed.";
    const status = message.includes("duplicate key") || message.includes("table_booking_active_slot_idx") ? 409 : 500;
    return NextResponse.json(
      { error: status === 409 ? "That table is already booked for this time." : message },
      { status }
    );
  }
}
