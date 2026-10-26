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
  administratorIds?: string[];
  professionalIds?: string[];
  assistantProfessionalIds?: string[];
};

export type AdminClubFormDraft = {
  id?: string;
  administratorIds?: string[];
  professionalIds?: string[];
  assistantProfessionalIds?: string[];
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
    ...(club.administratorIds ? {administratorIds: club.administratorIds, professionalIds: club.professionalIds ?? [], assistantProfessionalIds: club.assistantProfessionalIds ?? []} : {}),
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
