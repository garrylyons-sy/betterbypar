import Link from 'next/link';
import {notFound} from 'next/navigation';
import {localDemoEnabled} from '@/lib/local-demo.mjs';
import {SplashScreen} from '@/components/splash-screen';
export const dynamic='force-dynamic';
export const metadata={title:'Brand studio — Better By Par'};
export default function BrandPreview(){
 if(!localDemoEnabled())notFound();
 return <main className="min-h-screen bg-[#f5f2e8] px-5 py-10 text-[#153f35] sm:px-10"><div className="mx-auto max-w-6xl">
  <div className="flex flex-wrap items-center justify-between gap-4"><Link href="/demo" className="text-sm underline underline-offset-4">← Back to local demo</Link><p className="text-[10px] font-bold uppercase tracking-[.26em]">Identity collection · 01</p></div>
  <header className="my-12 max-w-2xl"><p className="text-xs uppercase tracking-[.24em] text-[#826342]">Made for the club experience</p><h1 className="mt-4 font-serif text-5xl font-normal tracking-tight sm:text-6xl">One platform.<br /><span className="italic">A distinctive identity.</span></h1><p className="mt-5 max-w-lg leading-7 text-[#59675e]">A family of precision-drawn marks, with a different identity for players, administrators and maintenance.</p></header>
  <div className="grid gap-5 sm:grid-cols-3">{[
    ['platform','The platform','A flag on the green. A place to belong.'],
    ['admin','Administration','A shield for the people behind your club.'],
    ['maintenance','Maintenance','Care and attention, behind the scenes.']
  ].map(([key,title,copy])=><section key={key} className="rounded-3xl border border-[#153f35]/10 bg-[#fcfaf5] p-7"><img src={`/brand/${key}.svg`} width="104" height="104" alt={`${title} icon`} className="mb-8 rounded-3xl shadow-lg"/><h2 className="text-xl font-semibold">{title}</h2><p className="mt-3 min-h-12 text-sm leading-6 text-[#59675e]">{copy}</p><div className="mt-7 flex items-center gap-4 border-t border-[#153f35]/10 pt-5"><img src={`/brand/${key}.svg`} width="16" height="16" alt="16 pixel preview"/><img src={`/brand/${key}.svg`} width="32" height="32" alt="32 pixel preview"/><a href={`/brand/${key}-favicon.ico`} download className="ml-auto text-xs underline underline-offset-4">favicon.ico ↓</a></div></section>)}</div>
  <section className="my-12 grid items-center gap-8 lg:grid-cols-[.7fr_1.3fr]"><div><p className="text-xs uppercase tracking-[.24em] text-[#826342]">The opening moment</p><h2 className="mt-4 font-serif text-4xl font-normal">A little anticipation.<br /><span className="italic">A lot of possibility.</span></h2><p className="mt-5 leading-7 text-[#59675e]">Course-inspired contours, warm gold and a quiet loading animation. Designed to feel at home on your phone.</p><Link href="/maintenance" className="mt-6 inline-block text-sm underline underline-offset-4">Preview the maintenance screen →</Link></div><SplashScreen preview/></section>
  <footer className="border-t border-[#153f35]/15 py-6 text-xs text-[#59675e]">Editable SVG · Browser ICO · Apple touch icons · Android / PWA icons</footer>
 </div></main>;
}
