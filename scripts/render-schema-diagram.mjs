// Deterministic documentation renderer: original overview + editable notification ERD.
// npm's existing Next.js Sharp dependency renders the new SVG document to PNG.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const nextRequire=createRequire(import.meta.resolve('next/package.json'));
const sharp=nextRequire('sharp');
const overview=fs.readFileSync(path.join(root,'docs/schema-assets/database-overview.png')).toString('base64');
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const tables=[
 {name:'notification_config',x:28,y:1190,w:370,rows:[['PK','singleton','boolean'],['','config','jsonb'],['FK','updated_by','uuid · nullable'],['','updated_at','timestamptz'],['','created_at','timestamptz']],note:'One global row: CHECK (singleton = true)'},
 {name:'notification_preference',x:28,y:1425,w:370,rows:[['PK / FK','person_id','uuid'],['','preferences','jsonb'],['','updated_at','timestamptz']],note:'At most one preference row per person'},
 {name:'notification_announcement',x:28,y:1590,w:400,rows:[['PK','id','uuid · request ID'],['FK','sender_person_id','uuid · nullable'],['','title','text · max 120'],['','body','text · max 2000'],['','audience','jsonb'],['','summary','jsonb'],['','created_at','timestamptz']],note:'Idempotency: client request ID is the PK'},
 {name:'app_notification',x:540,y:1210,w:420,rows:[['PK','id','uuid'],['FK','person_id','uuid'],['','type','text'],['','title','text'],['','body','text'],['','href','text'],['','event_key','text'],['','created_at','timestamptz'],['','read_at','timestamptz · nullable'],['','expires_at','timestamptz · nullable'],['','inbox_visible','boolean']],note:'UQ (person_id, event_key)'},
 {name:'notification_push_subscription',x:1150,y:1190,w:490,rows:[['PK','id','uuid'],['FK','person_id','uuid'],['UQ','endpoint','text'],['','p256dh','text'],['','auth','text'],['','active','boolean'],['','created_at','timestamptz'],['','updated_at','timestamptz']],note:'Device endpoint is unique'},
 {name:'notification_push_delivery',x:1120,y:1590,w:520,rows:[['PK','id','uuid'],['FK','notification_id','uuid'],['FK','subscription_id','uuid'],['','status','text'],['','attempts','integer'],['','available_at','timestamptz'],['','locked_at','timestamptz · nullable'],['','sent_at','timestamptz · nullable'],['','last_error','text · nullable']],note:'UQ (notification_id, subscription_id)'}
];
// Confirm every displayed field and FK against the checked-in migrations.
const sql=fs.readFileSync(path.join(root,'supabase/notifications.sql'),'utf8')+'\n'+fs.readFileSync(path.join(root,'supabase/notification_announcements.sql'),'utf8');
function declarations(block){
 const entries=[];let depth=0,quoted=false,start=0;
 for(let i=0;i<block.length;i++){
  const c=block[i];
  if(c==="'"){
   if(quoted&&block[i+1]==="'"){i++;continue;}
   quoted=!quoted;
  }
  if(!quoted){if(c==='(')depth++;if(c===')')depth--;if(c===','&&depth===0){entries.push(block.slice(start,i).trim());start=i+1;}}
 }
 entries.push(block.slice(start).trim());
 return entries.filter(value=>!/^unique\s*\(/i.test(value));
}
const sourceColumns=new Map();
for(const table of tables){
 const match=sql.match(new RegExp('create table if not exists public\\.'+table.name+' \\(([\\s\\S]*?)\\n\\);','i'));
 if(!match)throw new Error('Missing migration table: '+table.name);
 const rows=declarations(match[1]);
 const names=rows.map(row=>row.match(/^(\w+)/)?.[1]);
 if(JSON.stringify(names)!==JSON.stringify(table.rows.map(row=>row[1])))throw new Error('Diagram columns differ from migration: '+table.name);
 for(const row of rows)sourceColumns.set(table.name+'.'+row.match(/^(\w+)/)[1],row);
}

const header=40,rowHeight=25;
const height=table=>header+18+table.rows.length*rowHeight+38;
const text=(x,y,value,size=15,extra='')=>`<text x="${x}" y="${y}" font-size="${size}" ${extra}>${escape(value)}</text>`;
function card(table){
 const {x,y,w}=table;
 return `<g id="${table.name}"><rect x="${x}" y="${y}" width="${w}" height="${height(table)}" rx="8" fill="white" stroke="#24798c" stroke-width="1.5"/><path d="M${x+8} ${y}H${x+w-8}Q${x+w} ${y} ${x+w} ${y+8}V${y+header}H${x}V${y+8}Q${x} ${y} ${x+8} ${y}" fill="#086b7e"/>${text(x+12,y+26,table.name,17,'fill="white" font-weight="700"')}${table.rows.map(([key,name,type],index)=>{
 const line=y+header+23+index*rowHeight;
 return `${index%2===0?`<rect x="${x+1}" y="${line-18}" width="${w-2}" height="25" fill="#f2fafc"/>`:''}${text(x+10,line,key,12,'fill="#0070b5" font-weight="700"')}${text(x+77,line,name,15)}${text(x+w-12,line,type,13,'fill="#476078" text-anchor="end"')}`;
 }).join('')}<line x1="${x}" x2="${x+w}" y1="${y+height(table)-33}" y2="${y+height(table)-33}" stroke="#b9dce3"/>${text(x+10,y+height(table)-12,table.note,12,'fill="#476078"')}</g>`;
}
const edges=[
 {id:'config-updater',from:'notification_config.updated_by',to:'person.id',d:'M398 1303 H444 V1070 H700',label:[449,1061,'updated_by · SET NULL']},
 {id:'person-preference',from:'notification_preference.person_id',to:'person.id',d:'M398 1488 H467 V1096 H700',label:[472,1087,'person_id · CASCADE']},
 {id:'announcement-sender',from:'notification_announcement.sender_person_id',to:'person.id',d:'M428 1678 H490 V1122 H700',label:[495,1113,'sender_person_id · SET NULL']},
 {id:'inbox-recipient',from:'app_notification.person_id',to:'person.id',d:'M750 1210 V1154 H820 V1136',label:[664,1184,'person_id · CASCADE']},
 {id:'subscription-owner',from:'notification_push_subscription.person_id',to:'person.id',d:'M1150 1278 H1050 V1096 H980',label:[1059,1155,'person_id']},
 {id:'delivery-item',from:'notification_push_delivery.notification_id',to:'app_notification.id',d:'M1120 1678 H1010 V1273 H960',label:[974,1548,'notification_id'],rotate:true},
 {id:'delivery-device',from:'notification_push_delivery.subscription_id',to:'notification_push_subscription.id',d:'M1640 1703 H1657 V1253 H1640',label:[1635,1554,'subscription_id'],rotate:true}
];
for(const entry of edges){
 const reference=sourceColumns.get(entry.from)?.match(/references public\.(\w+)\((\w+)\)/i);
 if(!reference||`${reference[1]}.${reference[2]}`!==entry.to)throw new Error('Diagram FK differs from migration: '+entry.id);
}
const edge=entry=>`<g id="${entry.id}" data-foreign-key="${entry.from}" data-references="${entry.to}"><path d="${entry.d}" fill="none" stroke="#234b70" stroke-width="2" marker-end="url(#fk-arrow)"/>${entry.rotate?`<text x="${entry.label[0]}" y="${entry.label[1]}" font-size="13" fill="#234b70" transform="rotate(-90 ${entry.label[0]} ${entry.label[1]})">${escape(entry.label[2])}</text>`:text(...entry.label,13,'fill="#234b70"')}</g>`;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1672" height="2100" viewBox="0 0 1672 2100" role="img" aria-labelledby="title desc">
<title id="title">Interclub Snooker database architecture with Notifications and Inbox</title><desc id="desc">Existing overview followed by six notification tables. Solid arrows point from child foreign keys to parent primary keys. The announcement event-key association is dashed and is not a database constraint.</desc>
<defs><marker id="fk-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9Z" fill="#234b70"/></marker><marker id="logical-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9Z" fill="#8b5aa7"/></marker></defs>
<rect width="1672" height="2100" fill="white"/>
<image x="0" y="0" width="1672" height="941" href="data:image/png;base64,${overview}"/>
<g font-family="Arial, Helvetica, sans-serif" fill="#102a43">
<rect x="10" y="960" width="1652" height="1127" rx="10" fill="#eefafd" stroke="#1a93a3" stroke-width="2"/>
${text(30,1005,'NOTIFICATIONS & INBOX',32,'font-weight="700"')}${text(1640,1003,'Updated 20 October 2026',17,'fill="#45657a" text-anchor="end"')}
${text(30,1034,'Solid arrows: child FK → parent PK. The person anchor below refers to the existing Identity & Access table.',16,'fill="#45657a"')}
<g id="person-reference"><rect x="700" y="1052" width="280" height="84" rx="8" fill="#102a43"/>${text(718,1080,'person (existing table)',19,'fill="white" font-weight="700"')}${text(718,1107,'PK  id  uuid',16,'fill="white"')}${text(718,1126,'Reference to Identity & Access above',12,'fill="#c7e9f0"')}</g>
${edges.map(edge).join('')}
${tables.map(card).join('')}
<g id="announcement-event-key-association" data-association="application-only"><path d="M428 1795 H510 V1555 H540" fill="none" stroke="#8b5aa7" stroke-width="2" stroke-dasharray="7 5" marker-end="url(#logical-arrow)"/>${text(442,1817,'event_key',12,'fill="#8b5aa7"')}</g>
<rect x="540" y="1648" width="420" height="355" rx="8" fill="white" stroke="#b5dce4"/>
${text(558,1678,'RELATIONSHIPS & RULES',18,'font-weight="700"')}
${[
'One person: 0–1 preference row; many inbox items',
'and device subscriptions.',
'One inbox item can have many delivery rows;',
'each delivery references one item and one device.',
'Only one delivery is allowed per item/device pair.',
'Config and announcement authors may be NULL.',
'',
'Dashed association (not a foreign key):',
'app_notification.event_key = announcement:&lt;id&gt;',
'',
'All six tables have RLS enabled. Client database',
'roles have no grants; server APIs control access.',
'Existing conversation/message tables are separate.'
].map((line,index)=>text(558,1706+index*23,line.replace('&lt;','<').replace('&gt;','>'),13,'fill="#45657a"')).join('')}
${text(30,2044,'Notification types: fixture_change · match_reminder · lineup_reminder · ladder_challenge · announcement',15)}
${text(30,2070,'Delivery status: Pending · Sending · Sent · Failed · Skipped     |     PK primary key · FK foreign key · UQ unique constraint',14,'fill="#45657a"')}
</g></svg>`;
const svgPath=path.join(root,'IC Snooker Database Schema.svg');
fs.writeFileSync(svgPath,svg);
await sharp(Buffer.from(svg)).png().toFile(path.join(root,'IC Snooker Database Schema.png'));
if(tables.length!==6||edges.length!==7)throw new Error('Schema diagram is incomplete.');
console.log('Rendered six notification tables and seven foreign-key relationships as editable SVG and PNG.');
