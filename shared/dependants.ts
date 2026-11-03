/** Authorised dependant records returned by /api/dependants. */
export type Dependant={id:string;club_id:string;club_name:string;player_id:string;relationship:string;first_name:string;last_name:string;phone:string|null;profile_image?:string|null;golf_ireland_number?:string|null};
export type DependantsResponse={dependants:Dependant[]};
