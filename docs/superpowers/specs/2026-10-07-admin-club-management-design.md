# Admin Club Management Design

## Goal

Add a database-backed Clubs section to the admin tool where platform administrators can create and manage clubs and club administrators can maintain their own club's presentation and location settings.

## Scope

This release manages club records only. It does not create or edit teams, leagues, fixtures, memberships, contacts, tables, or competitions.

## Permissions

- Platform administrators can view all clubs, create clubs, edit every field, and activate or deactivate clubs.
- Club administrators can view only clubs for which they have active club-admin access.
- Club administrators can edit venue, address, logo, primary colour, and accent colour.
- Club administrators cannot create clubs, rename clubs, or change active status.
- Every API operation must enforce these rules independently of the client interface.

## Data Model

`public.club` remains the single source of truth. The section uses its existing fields:

- `name`: required, unique official name.
- `venue`: optional venue name.
- `address`: optional postal address.
- `logo_path`: an existing path/URL or an uploaded image encoded as a database-backed data URL.
- `primary_color` and `accent_color`: optional six-digit hexadecimal colours.
- `active`: reversible soft-deactivation flag.

Add `updated_at timestamptz not null default now()` so edits are traceable. Deactivation never deletes related historical records.

Uploaded logos accept PNG, JPEG, or WebP, with a maximum encoded source size of 1 MB. Existing path-based logos continue to work.

## API

Create `/api/admin/clubs`:

- `GET` returns all clubs, including inactive clubs, for platform administrators. It returns only active authorised clubs for club administrators.
- `POST` creates a club and is platform-admin only.
- `PATCH` updates an existing club. It filters writable fields according to the caller's access and rejects attempts outside that scope.

Names are trimmed, required, and unique case-insensitively. Colours are normalised to uppercase `#RRGGBB`. Empty optional text values are stored as `null`. Unsupported or oversized logo data is rejected.

Create, edit, deactivate, and reactivate actions write explicit activity-log entries identifying the club and changed fields.

## Admin Interface

Add **Clubs** to the admin navigation for platform and club administrators.

The panel shows a compact table with logo, official name, venue, and status. Platform administrators can filter Active, Inactive, or All. Selecting a row opens the editor; editors are closed by default.

Platform administrators also receive **Create club**. Club administrators see the official name and status as read-only. Logo upload shows an immediate preview. Colour controls combine a native swatch with a hex input. Save is disabled until a value changes or while a request is in progress.

On success, the local club list updates immediately. Validation or server errors are displayed in the panel without clearing the form.

## Compatibility

The current club branding consumers continue reading `logo_path`, `primary_color`, and `accent_color`, so Contacts, My Club, invitations, and role/team context require no data migration. Existing static logo paths remain valid alongside uploaded data URLs.

## Verification

Tests cover permission-scoped listing, platform creation, unique-name handling, club-admin field restrictions, soft activation changes, logo and colour validation, dirty-form Save state, and clear audit-log activity labels. Type checking and the production build must also pass.
