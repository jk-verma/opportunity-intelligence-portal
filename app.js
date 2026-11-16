'use strict';
const categories=[
 ['academic','Academic Careers'],['government','Government & Deputation'],
 ['international','International Careers'],['research','Sponsored Research'],
 ['consultancy','Consultancy Projects'],['awards','Awards & Fellowships']
];
const search=document.querySelector('#search');
const category=document.querySelector('#category');
const root=document.querySelector('#categories');
const notice=document.querySelector('.notice');
for(const [id,name] of categories){const o=document.createElement('option');o.value=id;o.textContent=name;category.append(o);}
let opportunities=[];
const config=window.OPPORTUNITY_PORTAL_CONFIG||{};
function textEl(tag,content){const el=document.createElement(tag);el.textContent=content||'';return el;}
function render(){
 root.replaceChildren();
 const q=search.value.trim().toLocaleLowerCase();
 const shown=opportunities.filter(o=>(!category.value||o.category===category.value)&&[o.title,o.description,o.location,o.organizations?.name].join(' ').toLocaleLowerCase().includes(q));
 for(const o of shown){
  const card=document.createElement('article');card.className='card';
  card.append(textEl('h2',o.title),textEl('p',[o.organizations?.name,o.location].filter(Boolean).join(' · ')));
  if(o.description)card.append(textEl('p',o.description));
  const meta=textEl('p',`Category: ${categories.find(c=>c[0]===o.category)?.[1]||o.category} | Published: ${o.published_at||'Not specified'} | Deadline: ${o.deadline_at?new Date(o.deadline_at).toLocaleDateString():'Not specified'}`);
  card.append(meta);
  const link=textEl('a','Official advertisement');link.href=o.official_url;link.target='_blank';link.rel='noopener noreferrer';card.append(link);
  root.append(card);
 }
 if(!shown.length)root.append(textEl('p',opportunities.length?'No opportunities match the filters.':'No verified opportunities available yet.'));
}
async function load(){
 if(!config.url||!config.publishableKey||config.publishableKey==='REPLACE_WITH_PUBLISHABLE_KEY'){
  notice.textContent='Database connection is awaiting the Supabase publishable key. No opportunity data has been loaded.';
  render();return;
 }
 const url=config.url.replace(/\/$/,'')+'/rest/v1/opportunities?select=id,title,category,location,description,published_at,deadline_at,official_url,organizations(name)&status=eq.verified&order=published_at.desc.nullslast&limit=200';
 try{
  const response=await fetch(url,{headers:{apikey:config.publishableKey}});
  if(!response.ok)throw new Error('HTTP '+response.status);
  opportunities=await response.json();
  notice.textContent=`Connected to Supabase. Showing ${opportunities.length} verified opportunities (maximum 200).`;
 }catch(e){notice.textContent='Could not load verified opportunities from Supabase ('+e.message+'). Check the publishable key and RLS permissions.';}
 render();
}
search.addEventListener('input',render);category.addEventListener('change',render);load();
