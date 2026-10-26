'use client';
import {useEffect,useState} from 'react';
import {ArrowUpRight,Flag} from 'lucide-react';
import {ProfileAvatar} from '@/components/profile-avatar';
import type {GolfSummary} from '@/lib/golf-summary';
type Player={id:string;club_id:string;club_name:string;player_id:string;first_name:string;last_name:string;profile_image:string|null};
type Card={player:Player;summary:GolfSummary|null};
export function DependantHomePanel({clubName}:{clubName:string}){
 const [resource,setResource]=useState<{clubName:string;cards:Card[]}|null>(null);
 useEffect(()=>{
  const controller=new AbortController();let active=true;
  void (async()=>{
   const response=await fetch('/api/dependants',{cache:'no-store',signal:controller.signal});
   if(!response.ok)throw new Error('Players unavailable');
   const data=await response.json();const players:Player[]=data.dependants.filter((p:Player)=>p.club_name===clubName);
   // Show linked players immediately; a missing handicap never hides their card.
   if(active)setResource({clubName,cards:players.map(player=>({player,summary:null}))});
   await Promise.allSettled(players.map(async player=>{
    const params=new URLSearchParams({club:clubName,playerId:player.player_id});
    const response=await fetch(`/api/golf-summary?${params}`,{cache:'no-store',signal:controller.signal});
    if(!response.ok)return;
    const data=await response.json();if(!data.summary||data.selectedPlayerId!==player.player_id)return;
    if(active)setResource(current=>current?.clubName===clubName?{clubName,cards:current.cards.map(card=>card.player.id===player.id?{player,summary:data.summary}:card)}:current);
   }));
  })().catch(()=>{/* Management remains accessible in More if the summary cannot load. */});
  return()=>{active=false;controller.abort();};
 },[clubName]);
 const cards=resource?.clubName===clubName?resource.cards:[];
 if(!cards.length)return null;
 return <section className="golf-family-panel" aria-label="Your players"><div className="golf-family-heading"><h2>Your players</h2><span>{cards.length} linked {cards.length===1?'player':'players'}</span></div><div className="golf-family-grid">{cards.map(({player,summary})=>{
  const name=`${player.first_name} ${player.last_name}`,latest=summary?.recentRounds[0];
  const params=new URLSearchParams({clubId:player.club_id,playerId:player.player_id});
  return <a key={player.id} href={`/my-golf?${params}`} className="golf-family-card" aria-label={`View ${name}'s golf`}>
   <div className="golf-family-player"><span className="golf-family-avatar"><ProfileAvatar src={player.profile_image} name={name} className="h-12 w-12"/></span><span><strong>{name}</strong><span className="golf-family-club">{player.club_name}</span></span><ArrowUpRight aria-hidden="true" className="ml-auto h-5 w-5 shrink-0"/></div>
   <div className="golf-family-stats"><div><span>Handicap Index</span><strong>{summary?.handicapDisplay||'—'}</strong>{summary?.handicapStatus&&summary.handicapStatus!=='active'&&<small>{summary.handicapStatus}</small>}</div><div><span>Last round</span><strong>{latest?.grossScore??'—'}<Flag aria-hidden="true" className="ml-2 inline h-3.5 w-3.5"/></strong><small>{latest?new Date(latest.date).toLocaleDateString('en-IE',{day:'numeric',month:'short',timeZone:'Europe/Dublin'}):'No round data yet'}</small></div></div>
   <div className="golf-family-footer"><span>{summary?.mode==='demo'?'Sample golf data':summary?.mode==='live'?'Golf Ireland':'Golf summary unavailable'}</span><strong>Rounds & coaching →</strong></div>
  </a>;
 })}</div></section>;
}
