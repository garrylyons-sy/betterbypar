export type AdminClubRecord = {
  id: string;
  name: string;
  venue: string | null;
  address: string | null;
  logoPath: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  allowUnlimitedLowerTeamPlayers: boolean;
  active: boolean;
  updatedAt?: string;
};

export type AdminClubFormDraft = {
  id?: string;
  name: string;
  venue: string;
  address: string;
  logoPath: string;
  primaryColor: string;
  accentColor: string;
  allowUnlimitedLowerTeamPlayers: boolean;
  active: boolean;
};

export function clubDraftFromRecord(club: AdminClubRecord): AdminClubFormDraft {
  return {
    id: club.id,
    name: club.name,
    venue: club.venue ?? "",
    address: club.address ?? "",
    logoPath: club.logoPath ?? "",
    primaryColor: club.primaryColor ?? "",
    accentColor: club.accentColor ?? "",
    allowUnlimitedLowerTeamPlayers: club.allowUnlimitedLowerTeamPlayers,
    active: club.active
  };
}
