export type ClubAdminMode = "platform" | "club";

export type ClubSettings = {
  name: string;
  venue: string | null;
  address: string | null;
  logoPath: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  allowUnlimitedLowerTeamPlayers: boolean;
  active: boolean;
};

const platformWritableFields = ["name", "venue", "address", "logoPath", "primaryColor", "accentColor", "allowUnlimitedLowerTeamPlayers", "active"] as const;
const clubWritableFields = ["venue", "address", "logoPath", "primaryColor", "accentColor", "allowUnlimitedLowerTeamPlayers"] as const;
const maxLogoBytes = 1024 * 1024;

function optionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function color(value: unknown) {
  const text = optionalText(value);
  if (!text) return null;
  if (!/^#[0-9A-Fa-f]{6}$/.test(text)) {
    throw new Error("Club colours must use a six-digit hexadecimal value such as #10233F.");
  }
  return text.toUpperCase();
}

function logo(value: unknown) {
  const text = optionalText(value);
  if (!text || !text.startsWith("data:")) return text;

  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(text);
  if (!match) throw new Error("Club logos must be PNG, JPEG or WebP images.");
  if (Buffer.from(match[2], "base64").byteLength > maxLogoBytes) {
    throw new Error("Club logos must be 1 MB or smaller.");
  }
  return text;
}

export function clubMutationPolicy(mode: ClubAdminMode) {
  return mode === "platform"
    ? { canCreate: true, writableFields: [...platformWritableFields] }
    : { canCreate: false, writableFields: [...clubWritableFields] };
}

export function normalizeClubInput(input: Record<string, unknown>, mode: "create" | ClubAdminMode): ClubSettings {
  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("Club name is required.");

  return {
    name,
    venue: optionalText(input.venue),
    address: optionalText(input.address),
    logoPath: logo(input.logoPath ?? input.logo_path),
    primaryColor: color(input.primaryColor ?? input.primary_color),
    accentColor: color(input.accentColor ?? input.accent_color),
    allowUnlimitedLowerTeamPlayers: Boolean(input.allowUnlimitedLowerTeamPlayers ?? input.allow_unlimited_lower_team_players),
    active: input.active === undefined ? true : Boolean(input.active)
  };
}

export function changedClubFields(current: ClubSettings, next: ClubSettings) {
  return platformWritableFields.filter((field) => current[field] !== next[field]);
}

export function clubAuditLabel(action: "create" | "update", changedFields: string[], active: boolean) {
  if (action === "create") return "Club created";
  if (!changedFields.length) return null;
  if (changedFields.includes("active")) return active ? "Club reactivated" : "Club deactivated";
  return "Club updated";
}
