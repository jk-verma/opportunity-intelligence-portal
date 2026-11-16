'use strict';
const cfg=window.OPPORTUNITY_PORTAL_CONFIG||{};
const $=id=>document.getElementById(id);
const categoryNames={academic:'Academic careers',government:'Government & deputation',international:'International organizations',research:'Funded research',consultancy:'Consultancy projects',awards:'Awards & fellowships'};
const apiBase=(cfg.url||'').replace(/\/$/,'');
const publicHeaders={apikey:cfg.publishableKey||''};
let opportunities=[],applications=new Map(),accessToken=sessionStorage.getItem('oip_access_token')||'',user=null,selectedId=null;
for(const [key,name] of Object.entries(categoryNames)){const opt=document.createElement('option');opt.value=key;opt.textContent=name;$('category').append(opt);}
function el(tag,value,className){const n=document.createElement(tag);if(value!==undefined)n.textContent=String(value);if(className)n.className=className;return n;}
function status(message){$('status').textContent=message;}
function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}}
function dateOf(value){if(!value)return null;const d=new Date(value);return Number.isNaN(d.getTime())?null:d;}
function isExpired(o){const d=dateOf(o.deadline_at);return !!d&&d.getTime()<Date.now();}
function daysLeft(o){const d=dateOf(o.deadline_at);return d===null?null:Math.ceil((d.getTime()-Date.now())/86400000);}
function decisionOf(o){const a=applications.get(o.id);return a?.decision||(isExpired(o)?'missed':'none');}
async function request(path,options={}){
 const headers={...publicHeaders,...(accessToken?{Authorization:'Bearer '+accessToken}:{}),...(options.headers||{})};
 const r=await fetch(apiBase+path,{...options,headers});
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
async function loadApplications(){
 applications.clear();
 if(!user){render();return;}
 try{
  const rows=await request('/rest/v1/user_applications?select=opportunity_id,decision,reference_number,notes,application_date&user_id=eq.'+encodeURIComponent(user.id)+'&limit=2000');
  for(const a of rows)applications.set(a.opportunity_id,a);
 }catch(e){status('Verified opportunities loaded; private application tracking unavailable: '+e.message);}
 render();
}
function render(){
 const q=$('search').value.trim().toLocaleLowerCase(),cat=$('category').value,deadline=$('deadline').value,decision=$('decision-filter').value;
 const active=opportunities.filter(o=>!isExpired(o));
 $('total-count').textContent=opportunities.length;
 $('open-count').textContent=active.length;
 $('closing-count').textContent=opportunities.filter(o=>{const n=daysLeft(o);return n!==null&&n>=0&&n<=14;}).length;
 $('saved-count').textContent=user?applications.size:'—';
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
 $('results-summary').textContent=rows.length+' result'+(rows.length===1?'':'s')+' · '+(user?'Your decisions are private':'Sign in to save decisions across devices');
 const root=$('categories');root.replaceChildren();
 if(!rows.length){root.append(el('div',opportunities.length?'No opportunities match the current filters.':'No verified opportunities have been published yet. The collectors are active, but unverified records are intentionally hidden.','empty'));return;}
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
  const button=el('button',user?'Track: '+decisionOf(o):'Sign in to track');button.type='button';button.addEventListener('click',()=>user?openDecision(o):$('auth-dialog').showModal());actions.append(button);card.append(actions);root.append(card);
 }
}
function updateAccount(){
 $('account-status').textContent=user?'Signed in: '+(user.email||'account'):'Browsing publicly';
 $('sign-in').hidden=!!user;$('sign-out').hidden=!user;
}
function sessionFromUrl(){
 const hash=new URLSearchParams(location.hash.slice(1));
 const token=hash.get('access_token');
 if(token){accessToken=token;sessionStorage.setItem('oip_access_token',token);history.replaceState(null,'',location.pathname+location.search);return true;}
 return false;
}
async function refreshSession(){
 if(!accessToken){user=null;updateAccount();await loadApplications();return;}
 try{user=await request('/auth/v1/user');}
 catch{accessToken='';sessionStorage.removeItem('oip_access_token');user=null;status('Your sign-in session expired. Sign in again to access saved decisions.');}
 updateAccount();await loadApplications();
}
function openDecision(o){
 selectedId=o.id;$('decision-title').textContent=o.title;
 const a=applications.get(o.id);
 $('decision').value=a?.decision||'';$('reference').value=a?.reference_number||'';$('notes').value=a?.notes||'';$('decision-message').textContent='';
 $('decision-dialog').showModal();
}
$('decision-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!user||!selectedId)return;
 const button=$('decision-form').querySelector('button[type=submit]');button.disabled=true;
 try{
  const decision=$('decision').value;
  if(!decision){
   await request('/rest/v1/user_applications?user_id=eq.'+encodeURIComponent(user.id)+'&opportunity_id=eq.'+encodeURIComponent(selectedId),{method:'DELETE'});
   applications.delete(selectedId);
  }else{
   const payload={user_id:user.id,opportunity_id:selectedId,decision,reference_number:$('reference').value.trim()||null,notes:$('notes').value.trim()||null,application_date:decision==='applied'?new Date().toISOString().slice(0,10):null};
   await request('/rest/v1/user_applications?on_conflict=user_id,opportunity_id',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(payload)});
   applications.set(selectedId,payload);
  }
  $('decision-dialog').close();render();
 }catch(err){$('decision-message').textContent='Could not save: '+err.message;}
 finally{button.disabled=false;}
});
$('auth-form').addEventListener('submit',async e=>{
 e.preventDefault();const button=$('auth-form').querySelector('button[type=submit]');button.disabled=true;
 try{
  const redirect=location.origin+location.pathname;
  const r=await fetch(apiBase+'/auth/v1/otp?redirect_to='+encodeURIComponent(redirect),{method:'POST',headers:{...publicHeaders,'Content-Type':'application/json'},body:JSON.stringify({email:$('email').value.trim(),create_user:true})});
  if(!r.ok)throw new Error('HTTP '+r.status);
  $('auth-message').textContent='Check your inbox for the sign-in link. Return to this page after opening it.';
 }catch(err){$('auth-message').textContent='Unable to send sign-in link: '+err.message;}
 finally{button.disabled=false;}
});
$('sign-in').addEventListener('click',()=>$('auth-dialog').showModal());
$('sign-out').addEventListener('click',()=>{accessToken='';sessionStorage.removeItem('oip_access_token');user=null;updateAccount();loadApplications();});
$('cancel-auth').addEventListener('click',()=>$('auth-dialog').close());
$('cancel-decision').addEventListener('click',()=>$('decision-dialog').close());
for(const id of ['search','category','deadline','decision-filter','sort'])$(id).addEventListener(id==='search'?'input':'change',render);
(async()=>{sessionFromUrl();await loadOpportunities();await refreshSession();})();
