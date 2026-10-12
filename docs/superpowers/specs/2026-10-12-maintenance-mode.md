# Maintenance Mode Specification

## Goal

Provide a global maintenance switch that platform administrators can control without risking a lockout.

## Behaviour

- Platform administrators can turn maintenance mode on or off from the admin dashboard.
- When enabled, normal application pages show a dedicated Down for maintenance experience.
- Existing normal-user sessions and new normal-user sign-ins are blocked from the application.
- `/admin` remains reachable during maintenance.
- During maintenance, the admin sign-in path admits platform administrators only; club administrators and other users remain blocked.
- The maintenance page includes a discreet Administrator access link and a maintenance-themed version of the existing mascot.
- The setting is stored in PostgreSQL and defaults to off.

