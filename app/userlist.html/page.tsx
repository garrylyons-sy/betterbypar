import { dbQuery } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TestUserRow = {
  email: string;
  name: string;
  club_name: string | null;
  team_name: string | null;
};

async function loadTestUsers() {
  const { rows } = await dbQuery<TestUserRow>(
    `select distinct on (lower(p.email))
       p.email,
       trim(p.first_name || ' ' || p.last_name) as name,
       c.name as club_name,
       ptr.team_name
     from public.user_account ua
     join public.person p on p.id = ua.person_id
     left join public.person_team_role ptr
       on ptr.person_id = p.id
      and ptr.active = true
      and ptr.role = 'Player'
     left join public.league l on l.id = ptr.league_id
     left join public.club c on c.id = ptr.club_id
     where ua.active = true
       and p.active = true
       and lower(p.email) like '%@notrealmail.com'
       and (l.name = 'A League' or l.name is null)
     order by lower(p.email), c.name nulls last, ptr.team_name nulls last`
  );

  return rows.sort((a, b) => {
    const clubCompare = (a.club_name ?? "").localeCompare(b.club_name ?? "");
    if (clubCompare !== 0) return clubCompare;
    const teamCompare = (a.team_name ?? "").localeCompare(b.team_name ?? "");
    if (teamCompare !== 0) return teamCompare;
    return a.name.localeCompare(b.name);
  });
}

export default async function UserListPage() {
  const users = await loadTestUsers();

  return (
    <main className="min-h-screen bg-[#f6f4f8] px-4 py-6 text-[#071426]">
      <section className="mx-auto grid w-full max-w-xl gap-5 rounded-[18px] border border-[#e3dfea] bg-white p-5 shadow-card">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#1b8a72]">Test access</p>
          <h1 className="mt-1 text-3xl font-extrabold leading-tight">Select a user</h1>
          <p className="mt-2 text-sm font-semibold text-[#6c5a73]">
            Pick one of the fake A League player accounts and open the app as that person.
          </p>
        </div>

        <form action="/home.html" method="get" className="grid gap-3">
          <label className="grid gap-2 text-sm font-bold text-[#10233f]">
            User
            <select
              name="user"
              className="min-h-12 w-full rounded-xl border border-[#d9d2e0] bg-[#f7f5fa] px-3 text-base font-bold text-[#071426] outline-none focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#7bc7d6]"
              defaultValue=""
              required
            >
              <option value="" disabled>
                Choose a player
              </option>
              {users.map((user) => (
                <option key={user.email} value={user.email}>
                  {user.name} - {user.team_name ?? "No team"} - {user.email}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="min-h-12 rounded-xl bg-[#10233f] px-4 text-base font-extrabold text-white transition hover:bg-[#17365f] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#7bc7d6]"
          >
            Open as selected user
          </button>
        </form>

        <div className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-bold text-[#6c5a73]">
          {users.length} fake player accounts available.
        </div>
      </section>
    </main>
  );
}
