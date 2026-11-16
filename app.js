'use strict';
const cfg=window.OPPORTUNITY_PORTAL_CONFIG||{};
const $=id=>document.getElementById(id);
const categoryNames={academic:'Academic careers',government:'Government & deputation',international:'International organizations',research:'Funded research',consultancy:'Consultancy projects',awards:'Awards & fellowships'};
const apiBase=(cfg.url||'').replace(/\/$/,'');
let verified=[],pending=[];
function el(tag,value,className){const n=document.createElement(tag);if(value!==undefined)n.textContent=String(value);if(className)n.className=className;return n;}
function dateOf(value){if(!value)return null;const d=new Date(value);return Number.isNaN(d.getTime())?null:d;}
function expired(o){const d=dateOf(o.deadline_at);return !!d&&d.getTime()<Date.now();}
function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}}
for(const [key,name] of Object.entries(categoryNames)){const opt=el('option',name);opt.value=key;$('category').append(opt);}
async function load(){
 let errors=[];
 if(apiBase&&cfg.publishableKey){
  try{
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
   let response;
   try{response=await fetch(apiBase+'/rest/v1/opportunities?select=id,title,category,location,description,eligibility,qualifications,experience_required,pay_details,published_at,deadline_at,official_url,organizations(name)&status=eq.verified&order=published_at.desc.nullslast&limit=1000',{headers:{apikey:cfg.publishableKey},signal:controller.signal});}finally{clearTimeout(timeout);}
   if(!response.ok)throw new Error('Supabase HTTP '+response.status);
   const data=await response.json();verified=Array.isArray(data)?data:[];
  }catch(e){errors.push('Verified listings unavailable: '+e.message);}
 }else errors.push('Supabase is not configured');
 try{
  const response=await fetch('pending-opportunities.json?v='+Date.now(),{cache:'no-store'});
  if(response.ok){const data=await response.json();pending=Array.isArray(data)?data:[];}
  else errors.push('Discovered listings not yet published');
 }catch(e){errors.push('Discovered listings unavailable: '+e.message);}
 $('status').textContent=errors.length?errors.join(' · '):'Listings loaded from official-source collection. Verify every notice before applying.';
 render();
}
function render(){
 const q=$('search').value.trim().toLowerCase(),cat=$('category').value,deadline=$('deadline').value,sort=$('sort').value;
 const byUrl=new Map();
 for(const o of pending)if(o&&o.official_url)byUrl.set(o.official_url,{...o,status:'pending'});
 for(const o of verified)if(o&&o.official_url)byUrl.set(o.official_url,{...o,status:'verified'});
 let rows=[...byUrl.values()].filter(o=>{
  if(cat&&o.category!==cat)return false;
  if(q&&![o.title,o.organizations?.name,o.location,o.description,o.eligibility,o.qualifications,o.experience_required,o.pay_details].join(' ').toLowerCase().includes(q))return false;
  if(deadline==='active'&&expired(o))return false;
  const days=o.deadline_at?Math.ceil((new Date(o.deadline_at).getTime()-Date.now())/86400000):null;
  if(deadline==='soon'&&(days===null||days<0||days>14))return false;
  return true;
 });
 rows.sort((a,b)=>sort==='title'?String(a.title).localeCompare(String(b.title)):sort==='deadline'?(dateOf(a.deadline_at)?.getTime()??Infinity)-(dateOf(b.deadline_at)?.getTime()??Infinity):(dateOf(b.published_at)?.getTime()??0)-(dateOf(a.published_at)?.getTime()??0));
 $('results-summary').textContent=rows.length+' listings · '+verified.length+' verified · '+pending.length+' unverified candidates';
 const root=$('categories');root.replaceChildren();
 if(!rows.length){root.append(el('p','No listings match the current filters, or the discovery snapshot has not been published.','empty'));return;}
 const table=el('table',undefined,'opportunity-table'),head=el('thead'),header=el('tr');
 for(const name of ['#','Institution / position','Category','Location','Published','Last date','Eligibility / experience','Pay','Source status','Official advertisement'])header.append(el('th',name));
 head.append(header);table.append(head);
 const body=el('tbody');
 for(const [index,o] of rows.entries()){
  const tr=el('tr');tr.append(el('td',index+1));
  const title=el('td');title.append(el('strong',o.title||'Untitled advertisement'));
  if(o.organizations?.name)title.append(el('div',o.organizations.name,'table-sub'));
  if(o.description){const details=el('details');details.append(el('summary','Details'),el('p',o.description));title.append(details);}
  tr.append(title,el('td',categoryNames[o.category]||o.category||'Not specified'),el('td',o.location||'Not specified'),el('td',o.published_at||'Not specified'),el('td',o.deadline_at?new Date(o.deadline_at).toLocaleDateString():'Not specified'));
  const eligibility=el('td',o.eligibility||o.qualifications||'See advertisement');
  if(o.experience_required)eligibility.append(el('div','Experience: '+o.experience_required,'table-sub'));
  if(o.eligibility&&o.qualifications)eligibility.append(el('div',o.qualifications,'table-sub'));
  tr.append(eligibility,el('td',o.pay_details||'See advertisement'),el('td',o.status==='verified'?'Verified':'Unverified'));
  const source=el('td'),url=safeUrl(o.official_url);
  if(url){const link=el('a','View notice');link.href=url;link.target='_blank';link.rel='noopener noreferrer';source.append(link);}else source.textContent='Unavailable';
  tr.append(source);body.append(tr);
 }
 table.append(body);root.append(table);
}
for(const id of ['search','category','deadline','sort'])$(id).addEventListener(id==='search'?'input':'change',render);
load().catch(e=>{$('status').textContent='Unable to initialize listings: '+e.message;});
