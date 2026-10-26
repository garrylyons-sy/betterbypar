# Golf Ireland summary

The Home page shows the registered player's Handicap Index, Low Handicap Index,
movement since the last recorded round, recent index history and three recent
rounds. Guardians can select active dependants linked in the selected club.
Professionals and assistants are excluded from player summaries.

## Demo and live modes

`GOLF_IRELAND_DATA_MODE` accepts `demo`, `live` or `off`. Development defaults to
`demo`; production defaults to `off`. The local demo always forces `demo` and
clears inherited live credentials. Sample scores are deterministic, visibly
labelled, and never written to player or scoring records. Live failures return
an unavailable message and never fall back to sample scores.

Golf Ireland documents its club ISV API at
[the official Swagger site](https://isvapi.clubhouse.golfireland.ie/) and its
[authentication guide](https://isvapi.clubhouse.golfireland.ie/v1documentation).
Real operation still requires approved access and verification with issued
credentials. No real account has been connected or tested.

Set these **server-only** environment values for approved live access:

```dotenv
GOLF_IRELAND_DATA_MODE=live
GOLF_IRELAND_CLUB_CREDENTIALS={"LOCAL_CLUB_UUID":{"username":"ISSUED_USERNAME","secretKey":"ISSUED_SECRET"}}
GOLF_IRELAND_MEMBER_UIDS={"LOCAL_CLUB_UUID":{"GOLF_IRELAND_NUMBER":"API_MEMBER_UUID"}}
```

Each club has its own credentials. A player's Golf Ireland number
(`centralMemberCode`) differs from the API's member UUID; configure the explicit
mapping after verifying the correct person. Do not prefix these settings with
`NEXT_PUBLIC_`, commit credentials or enter them in browser code.

The adapter signs the documented HS256 client JWT, exchanges it at
`POST /api/ie/v1/account/token`, then reads
`GET /api/ie/v1/club/members/{memberUID}/handicap/scores`. It sends no membership
or scoring mutations. Calls use the fixed official HTTPS host, reject redirects
and have a timeout. Access tokens are cached only in server memory until expiry.

`GET /api/golf-summary?club=CLUB_NAME&playerId=LOCAL_PERSON_UUID` checks current
club membership and player/guardian permissions before calling the provider.
Responses are not cached. Even platform admins cannot use this endpoint to
browse unrelated players.

## Display semantics

- Live Handicap Index uses Golf Ireland's `displayIndex` verbatim, including
  status formatting. Missing values remain unavailable.
- History uses each returned round's pre-round index plus the current index;
  it is not an official daily recalculation history.
- “Data as of” is retrieval time, not an official handicap recalculation date.
- The club shown is the selected club context, not a verified home club.
- The score-record response supplies gross scores and score differentials.
  Stableford points are shown only in demo fixtures; the live adapter does not
  invent them. Counting status comes from `counterScoreUIDs`.

Useful next additions include course handicap after selecting a rated tee,
progress towards a target index, and a combined next-lesson/practice-drills
card using existing platform lesson data. Course handicap needs the appropriate
course and tee ratings; detailed putting/fairway statistics need their own data
source rather than assumptions about this API.
