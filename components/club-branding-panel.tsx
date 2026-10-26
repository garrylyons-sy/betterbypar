'use client';
import {ClubLessonPrivacy} from '@/components/club-lesson-privacy';
import {useClubTheme} from '@/components/club-theme-provider';

import {useCallback,useEffect,useState} from 'react';
import type {ClubBrandingRow} from '@/lib/server/club-branding-store';
import {Button} from '@/components/ui/button';
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card';
import {GolfField,GolfSelect,golfInput,golfRequest} from '@/components/golf-ui';

type Draft={logoPath:string;primaryColor:string;accentColor:string};
const draftFor=(club:ClubBrandingRow):Draft=>({logoPath:club.logo_path??'',primaryColor:club.primary_color??'#10233F',accentColor:club.accent_color??'#1B8A72'});

export function ClubBrandingPanel(){
  const {setClubId:setThemeClubId,refresh:refreshTheme,preview,clearPreview}=useClubTheme();
  const [clubs,setClubs]=useState<ClubBrandingRow[]>([]);
  const [clubId,setClubId]=useState('');
  const [draft,setDraft]=useState<Draft|null>(null);
  const [baseline,setBaseline]=useState<Draft|null>(null);
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[readingLogo,setReadingLogo]=useState(false);
  const [message,setMessage]=useState('');
  const load=useCallback(async()=>{
    const data=await golfRequest<{clubs:ClubBrandingRow[]}>('/api/clubadmin');
    setClubs(data.clubs);
    if(data.clubs[0]){setClubId(data.clubs[0].id);const next=draftFor(data.clubs[0]);setDraft(next);setBaseline(next);}
  },[]);
  useEffect(()=>{load().catch(e=>setMessage(e.message)).finally(()=>setLoading(false));},[load]);
  const club=clubs.find(c=>c.id===clubId);
  const dirty=JSON.stringify(draft)!==JSON.stringify(baseline);
  const validColours=Boolean(draft&&/^#[0-9a-f]{6}$/i.test(draft.primaryColor)&&/^#[0-9a-f]{6}$/i.test(draft.accentColor));
  useEffect(()=>{if(clubId)setThemeClubId(clubId);},[clubId,setThemeClubId]);
  useEffect(()=>{
    if(draft&&baseline&&validColours&&(draft.primaryColor!==baseline.primaryColor||draft.accentColor!==baseline.accentColor))preview(draft.primaryColor,draft.accentColor);
    else clearPreview();
  },[draft?.primaryColor,draft?.accentColor,baseline?.primaryColor,baseline?.accentColor,validColours,preview,clearPreview]);
  useEffect(()=>()=>clearPreview(),[clearPreview]);
  function selectClub(id:string){
    const selected=clubs.find(c=>c.id===id);if(!selected)return;
    clearPreview();const next=draftFor(selected);setClubId(id);setDraft(next);setBaseline(next);setMessage('');
  }
  async function save(){
    if(!draft||!validColours)return;
    setSaving(true);setMessage('');
    try{
      const result=await golfRequest<{club:ClubBrandingRow}>('/api/clubadmin','PATCH',{id:clubId,...draft});
      setClubs(rows=>rows.map(c=>c.id===result.club.id?result.club:c));
      await refreshTheme();
      const next=draftFor(result.club);setDraft(next);setBaseline(next);clearPreview();
      setMessage('Branding saved. Your club colours are applied across the portal.');
    }catch(error){setMessage((error as Error).message);}finally{setSaving(false);}
  }
  function uploadLogo(file:File|undefined){
    if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>1024*1024){setMessage('Choose a PNG, JPEG or WebP image up to 1 MB.');return;}
    setReadingLogo(true);setMessage('');
    const reader=new FileReader();
    reader.onload=()=>{setDraft(d=>d?{...d,logoPath:String(reader.result??'')}:d);setReadingLogo(false);};
    reader.onerror=()=>{setMessage('The logo could not be read.');setReadingLogo(false);};
    reader.readAsDataURL(file);
  }
  return <Card><CardHeader><CardTitle>Club branding</CardTitle></CardHeader><CardContent className="grid gap-5">
    <p className="text-sm text-[#6c5a73]">Your primary and accent colours shape the whole portal, including lessons, navigation, buttons, cards and backgrounds. Readable text colours are derived automatically. Colour changes preview live until you save or discard; uploaded logos appear in the preview below.</p>
    {message&&<p role="status" className="rounded-xl bg-[#f7f5fa] p-3 text-sm font-semibold">{message}</p>}
    {loading?<p>Loading your clubs…</p>:club&&draft?<>
      <GolfSelect label="Club" value={clubId} onChange={selectClub} disabled={saving||readingLogo} options={clubs}/>
      <div className="grid gap-5 xl:grid-cols-2">
        <fieldset disabled={saving||readingLogo} className="grid content-start gap-4">
          <GolfField label="Club logo"><input type="file" accept="image/png,image/jpeg,image/webp" className={golfInput} onChange={e=>{uploadLogo(e.target.files?.[0]);e.target.value="";}}/></GolfField>
          <p className="text-xs text-[#6c5a73]">PNG, JPEG or WebP, up to 1 MB.</p>
          {draft.logoPath&&<Button type="button" variant="secondary" onClick={()=>setDraft({...draft,logoPath:''})}>Remove logo</Button>}
          {(['primaryColor','accentColor'] as const).map(key=><GolfField key={key} label={key==='primaryColor'?'Primary colour':'Accent colour'}><span className="flex items-center gap-3"><input aria-label={`${key==='primaryColor'?'Primary':'Accent'} colour picker`} type="color" value={/^#[0-9a-f]{6}$/i.test(draft[key])?draft[key]:'#10233F'} onChange={e=>setDraft({...draft,[key]:e.target.value.toUpperCase()})}/><input className={golfInput} maxLength={7} value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value.toUpperCase()})}/></span></GolfField>)}
        </fieldset>
        <section aria-label="Branding preview" className="overflow-hidden rounded-2xl border bg-white">
          <div className="p-5" style={{backgroundColor:/^#[0-9a-f]{6}$/i.test(draft.primaryColor)?draft.primaryColor:'#10233F'}}>
            <div className="flex items-center gap-4 rounded-xl bg-white p-4 text-[#10233f]">
              {draft.logoPath?<img src={draft.logoPath} className="h-16 w-16 object-contain" alt={`${club.name} logo preview`}/>:<span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-[#f7f5fa] text-xl font-extrabold">{club.name.slice(0,2).toUpperCase()}</span>}
              <div><p className="text-xs font-bold uppercase text-[#6c5a73]">Your club</p><h2 className="text-xl font-extrabold">{club.name}</h2></div>
            </div>
          </div>
          <div className="grid gap-3 p-5"><p className="font-bold">Branding preview</p><div className="h-2 rounded-full" style={{backgroundColor:/^#[0-9a-f]{6}$/i.test(draft.accentColor)?draft.accentColor:'#1B8A72'}}/><p className="text-sm text-[#6c5a73]">Primary and accent colours create a complete, readable palette across all club screens. Your logo also personalises invitations.</p></div>
        </section>
      </div>
      <div className="flex flex-wrap justify-end gap-3"><Button variant="secondary" disabled={!dirty||saving||readingLogo} onClick={()=>{clearPreview();setDraft(baseline);setMessage('');}}>Discard changes</Button><Button disabled={!dirty||!validColours||saving||readingLogo} onClick={save}>{saving?'Saving…':'Save branding'}</Button></div>
      <ClubLessonPrivacy key={clubId} clubId={clubId} clubScope/>
    </>:<p>No active clubs are available for this account.</p>}
  </CardContent></Card>;
}
