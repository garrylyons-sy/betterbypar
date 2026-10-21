import { cupDrawPresentation } from "@/lib/cup-draw-presentation.mjs";
import type { CupDrawAttempt } from "@/components/cup-draw-review";
const escapeHtml=(value:unknown)=>String(value??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function printCupDrawRecord(name:string,attempt:CupDrawAttempt,history:CupDrawAttempt[]) {
  const popup=window.open("","_blank");
  if(!popup)return false;
  popup.opener=null;
  const view=cupDrawPresentation(attempt.snapshot);
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(name)} — Draw record</title><style>body{font:16px system-ui;max-width:850px;margin:36px auto;padding:0 20px}li{margin:10px 0}small{color:#555}@media print{button{display:none}}</style></head><body><h1>${escapeHtml(name)}</h1><h2>Draw attempt ${attempt.attempt_number} — ${escapeHtml(attempt.status)}</h2><p>Drawn: ${escapeHtml(attempt.created_at)} by ${escapeHtml(attempt.created_by_name)}</p><p>Witness: ${escapeHtml(attempt.witness_name||"Not recorded")}<br>Confirmed: ${escapeHtml(attempt.confirmed_at)} by ${escapeHtml(attempt.confirmed_by_name)}</p>${view.rounds.map(round=>`<h3>${escapeHtml(round.name)} — ${escapeHtml(round.date)}</h3><ol>${round.ties.map(t=>`<li>${escapeHtml(t.home)}${t.homeBye?' (bye)':''} v ${escapeHtml(t.away)}${t.awayBye?' (bye)':''}</li>`).join('')}</ol>`).join('')}<h3>Entrants</h3><p>${attempt.snapshot.entries.map(e=>escapeHtml(e.team_name)).join(' · ')}</p><h3>Round dates</h3><p>${attempt.snapshot.rounds.map(r=>`${escapeHtml(r.name)}: ${escapeHtml(r.fixture_date)}`).join('<br>')}</p><h3>Attempt history</h3>${history.map(a=>`<p>Attempt ${a.attempt_number}: ${escapeHtml(a.status)} · ${escapeHtml(a.created_at)}${a.redraw_reason?`<br>Redraw reason: ${escapeHtml(a.redraw_reason)} (${escapeHtml(a.superseded_by_name)})`:''}</p>`).join('')}<small>Witness name is recorded by the organiser. Times are UTC. Later rounds follow the bracket in match order.</small><p><button onclick="window.print()">Print / save PDF</button></p></body></html>`);
  popup.document.close();return true;
}
