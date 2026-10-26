export const professionalRoles = ['Golf Professional', 'Assistant Professional'] as const;
export const clubRoles = ['Club Member', 'Club Admin', 'League Chair', ...professionalRoles] as const;
export type Appointments = { administratorIds: string[]; professionalIds: string[]; assistantProfessionalIds: string[] };
export function normalizeAppointments(input: Record<string, unknown>): Appointments {
  function ids(key: string) {
    const value = input[key] ?? [];
    if (!Array.isArray(value) || value.some(id => typeof id !== 'string' || !id.trim())) throw new Error('Select valid people for club appointments.');
    return [...new Set(value.map(id => String(id).trim()))];
  }
  const administratorIds = ids('administratorIds');
  const professionalIds = ids('professionalIds');
  const assistantProfessionalIds = ids('assistantProfessionalIds');
  if (!administratorIds.length) throw new Error('Appoint at least one club administrator.');
  if (!professionalIds.length) throw new Error('Appoint at least one Golf Professional.');
  if (professionalIds.some(id => assistantProfessionalIds.includes(id))) throw new Error('A person cannot be both a Golf Professional and Assistant Professional at the same club.');
  return {administratorIds, professionalIds, assistantProfessionalIds};
}
export function canManageLessons(platform: boolean, adminClubIds: string[], assignments: {clubId: string; role: string; active: boolean}[], clubId: string) {
  return platform || adminClubIds.includes(clubId) || assignments.some(a => a.clubId === clubId && a.active && professionalRoles.some(role => role === a.role));
}
export function canActForPlayer(actorId: string, playerId: string, clubId: string, relationships: {guardianId: string; playerId: string; clubId: string; active: boolean}[]) {
  return actorId === playerId || relationships.some(r => r.guardianId === actorId && r.playerId === playerId && r.clubId === clubId && r.active);
}
export function normalizeLessonSlot(input: Record<string, unknown>) {
  const clubId = String(input.clubId ?? '').trim();
  const professionalId = String(input.professionalId ?? '').trim();
  const title = String(input.title ?? '').trim();
  if (!clubId || !professionalId || !title || title.length > 120) throw new Error('Club, professional and lesson title (up to 120 characters) are required.');
  const starts = String(input.startsAt ?? '');
  const ends = String(input.endsAt ?? '');
  if (![starts, ends].every(s => /T.*(Z|[+-]\d{2}:\d{2})$/i.test(s))) throw new Error('Lesson times require an explicit timezone.');
  const start = Date.parse(starts), end = Date.parse(ends);
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error('Enter valid lesson times.');
  if (end <= start) throw new Error('Lesson end must be after the start.');
  if (end - start > 4 * 60 * 60 * 1000) throw new Error('Lessons may last up to four hours.');
  if (start <= Date.now()) throw new Error('Choose a future lesson time.');
  return {clubId, professionalId, title, startsAt:new Date(start).toISOString(), endsAt:new Date(end).toISOString()};
}
export function hasActivePlayers(activePersonIds:string[],actorId:string,playerId:string) {
 const ids=new Set(activePersonIds);return ids.has(actorId)&&ids.has(playerId);
}
