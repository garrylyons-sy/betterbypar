import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/server/auth';
import {notificationAccess} from '@/lib/server/notifications';
import {dbQuery} from '@/lib/server/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
  const user=await currentUser();if(!user)return NextResponse.json({error:'Sign in required.'},{status:401});
  const access=await notificationAccess(user.personId);
  if(!access.eligible||!access.roles.includes('League Chair'))return NextResponse.json({error:'League Chair access required.'},{status:403});
  const fixtureId=new URL(request.url).searchParams.get('fixtureId')??'';
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fixtureId))return NextResponse.json({error:'Choose a valid fixture.'},{status:400});
  const result=await dbQuery(`select f.id,l.name as league,s.name as season,f.fixture_date as "fixtureDate",ht.name as "homeTeamName",at.name as "awayTeamName",m.home_team_score as "homeTeamScore",m.away_team_score as "awayTeamScore",f.status from public.fixture f join public.match m on m.fixture_id=f.id join public.team ht on ht.id=f.home_team_id join public.team at on at.id=f.away_team_id join public.league l on l.id=f.league_id join public.season s on s.id=f.season_id where f.id=$1 and f.status='Completed'`,[fixtureId]);
  if(!result.rows[0])return NextResponse.json({error:'This completed result is no longer available.'},{status:404});
  return NextResponse.json({result:result.rows[0]},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Could not load this result.'},{status:500});}
}
