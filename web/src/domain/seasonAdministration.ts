export interface SeasonSetupRecord {
  seasonId:string;name:string;status:string;startsAt:string|null;endsAt:string|null;
}
export interface SeasonAdministrationData {
  schemaVersion:'AOF_SEASON_ADMINISTRATION_1';activeSeasonId:string|null;seasons:SeasonSetupRecord[];
}
export interface SeasonCreationInput {requestId:string;name:string;startsAt:string;endsAt:string;}

/** UI validation supplements, and never replaces, the existing server guards. */
export function seasonCreation(name:string,startsAt:string,endsAt:string,requestId:string):SeasonCreationInput {
  const title=name.trim(),start=new Date(startsAt),end=new Date(endsAt);
  if(!title||title.length>100)throw Error('Season name must contain 1–100 characters.');
  if(!startsAt||!endsAt||!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime()))
    throw Error('Choose a valid Season opening and closing date/time.');
  if(start>=end)throw Error('Season end must be after its start.');
  return {requestId,name:title,startsAt:start.toISOString(),endsAt:end.toISOString()};
}
