'use strict';
const cfg=window.OPPORTUNITY_PORTAL_CONFIG||{};
const $=id=>document.getElementById(id);
const categoryNames={academic:'Academic careers',government:'Government & deputation',international:'International organizations',research:'Funded research',consultancy:'Consultancy projects',awards:'Awards & fellowships'};
const apiBase=(cfg.url||'').replace(/\/$/,'');
const publicHeaders={apikey:cfg.publishableKey||''};
const STORAGE_KEY='oip_local_applications_v1';
let opportunities=[],applications=new Map(),selectedId=null,viewMode='table';
try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))applications=new Map(Object.entries(saved));}catch{applications=new Map();}
function persistLocal(){localStorage.setItem(STORAGE_KEY,JSON.stringify(Object.fromEntries(applications)));}
for(const [key,name] of Object.entries(categoryNames)){const opt=document.createElement('option');opt.value=key;opt.textContent=name;$('category').append(opt);}
function el(tag,value,className){const n=document.createElement(tag);if(value!==undefined)n.textContent=String(value);if(className)n.className=className;return n;}
function status(message){$('status').textContent=message;}
function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}}
function dateOf(value){if(!value)return null;const d=new Date(value);return Number.isNaN(d.getTime())?null:d;}
function isExpired(o){const d=dateOf(o.deadline_at);return !!d&&d.getTime()<Date.now();}
function daysLeft(o){const d=dateOf(o.deadline_at);return d===null?null:Math.ceil((d.getTime()-Date.now())/86400000);}
function decisionOf(o){const a=applications.get(o.id);return a?.decision||(isExpired(o)?'missed':'none');}
async function request(path,options={}){
 const headers={...publicHeaders,...(options.headers||{})};
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 let r;
 try{r=await fetch(apiBase+path,{...options,headers,signal:controller.signal});}
 finally{clearTimeout(timeout);}
 if(!r.ok){let detail='';try{const e=await r.json();detail=e.message||e.msg||'';}catch{}throw new Error('HTTP '+r.status+(detail?' · '+detail:''));}
 if(r.status===204)return null;
 const body=await r.text();return body?JSON.parse(body):null;
}
async function loadOpportunities(){
 if(!apiBase||!cfg.publishableKey){status('Supabase connection has not been configured.');return;}
 try{
  opportunities=await request('/rest/v1/opportunities?select=id,title,category,location,description,eligibility,qualifications,experience_required,pay_details,published_at,deadline_at,official_url,organizations(name)&status=eq.verified&order=published_at.desc.nullslast&limit=1000');
  status('Connected to Supabase. Only officially verified records are shown. Last refreshed: '+new Date().toLocaleString()+'.');
 }catch(e){status('Unable to retrieve verified opportunities: '+e.message);opportunities=[];}
 render();
}
function render(){
 const q=$('search').value.trim().toLocaleLowerCase(),cat=$('category').value,deadline=$('deadline').value,decision=$('decision-filter').value;
 const active=opportunities.filter(o=>!isExpired(o));
 $('total-count').textContent=opportunities.length;
 $('open-count').textContent=active.length;
 $('closing-count').textContent=opportunities.filter(o=>{const n=daysLeft(o);return n!==null&&n>=0&&n<=14;}).length;
 $('saved-count').textContent=applications.size;
 let rows=opportunities.filter(o=>{
  if(cat&&o.category!==cat)return false;
  if(q&&![o.title,o.description,o.location,o.eligibility,o.qualifications,o.organizations?.name].join(' ').toLocaleLowerCase().includes(q))return false;
  const n=daysLeft(o);
  if(deadline==='active'&&isExpired(o))return false;
  if(deadline==='expired'&&!isExpired(o))return false;
  if(deadline==='soon'&&(n===null||n<0||n>14))return false;
  if(decision&&decisionOf(o)!==decision)return false;
  return true;
 });
 const sort=$('sort').value;
 rows.sort((a,b)=>sort==='title'?a.title.localeCompare(b.title):sort==='deadline'?(dateOf(a.deadline_at)?.getTime()??Infinity)-(dateOf(b.deadline_at)?.getTime()??Infinity):(dateOf(b.published_at)?.getTime()??0)-(dateOf(a.published_at)?.getTime()??0));
 $('results-summary').textContent=rows.length+' result'+(rows.length===1?'':'s')+' · Decisions are saved only on this device';
 const root=$('categories');root.replaceChildren();
 root.className=viewMode==='table'?'table-container':'grid';
 $('table-view').setAttribute('aria-pressed',String(viewMode==='table'));
 $('card-view').setAttribute('aria-pressed',String(viewMode==='cards'));
 if(!rows.length){root.append(el('div',opportunities.length?'No opportunities match the current filters.':'No verified opportunities have been published yet. The collectors are active, but unverified records are intentionally hidden.','empty'));return;}
 if(viewMode==='table'){
  const table=el('table',undefined,'opportunity-table'),head=el('thead'),header=el('tr');
  for(const name of ['#','Institution / opportunity','Category','Location','Published','Deadline','Eligibility / qualifications','Pay','My decision','Official source'])header.append(el('th',name));
  head.append(header);table.append(head);
  const body=el('tbody');
  for(const [index,o] of rows.entries()){
   const tr=el('tr');
   tr.append(el('td',index+1));
   const name=el('td');name.append(el('strong',o.organizations?.name||o.title));
   if(o.organizations?.name)name.append(el('div',o.title,'table-sub'));
   if(o.description){const details=el('details');const summary=el('summary','Details');details.append(summary,el('p',o.description));if(o.experience_required)details.append(el('p','Experience: '+o.experience_required));name.append(details);}
   tr.append(name,el('td',categoryNames[o.category]||o.category),el('td',o.location||'Not specified'),el('td',o.published_at||'Not specified'),el('td',o.deadline_at?new Date(o.deadline_at).toLocaleDateString():'Not specified'));
   const qual=el('td',o.eligibility||o.qualifications||'See official notice');if(o.eligibility&&o.qualifications)qual.append(el('div',o.qualifications,'table-sub'));tr.append(qual,el('td',o.pay_details||'See official notice'));
   const decision=el('td'),button=el('button',decisionOf(o)==='none'?'Track':decisionOf(o));button.type='button';button.addEventListener('click',()=>openDecision(o));decision.append(button);tr.append(decision);
   const source=el('td'),url=safeUrl(o.official_url);
   if(url){const a=el('a','Open notice');a.href=url;a.target='_blank';a.rel='noopener noreferrer';source.append(a);}else source.textContent='Unavailable';
   tr.append(source);body.append(tr);
  }
  table.append(body);root.append(table);return;
 }
 for(const o of rows){
  const card=el('article',undefined,'card');
  card.append(el('span',categoryNames[o.category]||o.category,'tag'),el('h2',o.title),el('p',[o.organizations?.name,o.location].filter(Boolean).join(' · ')));
  if(o.description)card.append(el('p',o.description.length>360?o.description.slice(0,357)+'…':o.description));
  if(o.eligibility)card.append(el('p','Eligibility: '+o.eligibility.slice(0,260)));
  if(o.qualifications)card.append(el('p','Qualifications: '+o.qualifications.slice(0,260)));
  if(o.experience_required)card.append(el('p','Experience: '+o.experience_required.slice(0,200)));
  if(o.pay_details)card.append(el('p','Pay: '+o.pay_details.slice(0,200)));
  const n=daysLeft(o),deadlineText=n===null?'Deadline not specified':n<0?'Deadline passed':n===0?'Closes today':'Closes in '+n+' day'+(n===1?'':'s');
  card.append(el('p','Published: '+(o.published_at||'Not specified')+' · '+deadlineText,'meta'));
  const actions=el('div',undefined,'actions'),url=safeUrl(o.official_url);
  if(url){const link=el('a','Official advertisement');link.href=url;link.target='_blank';link.rel='noopener noreferrer';actions.append(link);}
  const button=el('button','Track: '+decisionOf(o));button.type='button';button.addEventListener('click',()=>openDecision(o));actions.append(button);card.append(actions);root.append(card);
 }
}
function openDecision(o){
 selectedId=o.id;$('decision-title').textContent=o.title;
 const a=applications.get(o.id);
 $('decision').value=a?.decision||'';$('reference').value=a?.reference_number||'';$('notes').value=a?.notes||'';$('decision-message').textContent='';
 $('decision-dialog').showModal();
}
$('decision-form').addEventListener('submit',e=>{
 e.preventDefault();
 if(!selectedId)return;
 try{
  const decision=$('decision').value;
  if(!decision)applications.delete(selectedId);
  else applications.set(selectedId,{
   decision,
   reference_number:$('reference').value.trim()||null,
   notes:$('notes').value.trim()||null,
   application_date:decision==='applied'?new Date().toISOString().slice(0,10):null
  });
  persistLocal();
  $('decision-dialog').close();
  render();
 }catch(err){$('decision-message').textContent='Could not save locally: '+err.message;}
});
$('cancel-decision').addEventListener('click',()=>$('decision-dialog').close());
for(const mode of ['table','card'])$(mode+'-view').addEventListener('click',()=>{viewMode=mode==='table'?'table':'cards';render();});
for(const id of ['search','category','deadline','decision-filter','sort'])$(id).addEventListener(id==='search'?'input':'change',render);
loadOpportunities().catch(e=>{status('Portal initialization failed: '+e.message);});
