import {notFound} from 'next/navigation';
import {localDemoEnabled} from '@/lib/local-demo.mjs';
import {LocalDemoEntry} from '@/components/local-demo-entry';
export const dynamic='force-dynamic';
export default function DemoPage(){
 if(!localDemoEnabled())notFound();
 return <main className="mx-auto max-w-5xl px-5 py-10"><LocalDemoEntry/></main>;
}
