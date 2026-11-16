'use strict';
const sectors=[
 {id:'academic',name:'Academic Careers',description:'IIMs, IIFT, FMS, IITs, NITs, central universities and foreign university campuses.',url:'https://www.education.gov.in/'},
 {id:'government',name:'Government & Deputation',description:'CAG / IA&AD, UPSC, ministries, statutory bodies and lateral-entry opportunities.',url:'https://upsc.gov.in/'},
 {id:'international',name:'International Careers',description:'United Nations, World Bank, ADB, IMF, WTO and other international organizations.',url:'https://careers.un.org/'},
 {id:'research',name:'Sponsored Research',description:'Public, private and international funded research calls and collaborations.',url:'https://dst.gov.in/'},
 {id:'consultancy',name:'Consultancy Projects',description:'Government, multilateral, institutional and private consultancy calls and tenders.',url:'https://eprocure.gov.in/eprocure/app'},
 {id:'awards',name:'Awards & Fellowships',description:'Research, teaching, innovation, academic awards and fellowships.',url:'https://awards.gov.in/'}
];
const search=document.querySelector('#search'),category=document.querySelector('#category'),root=document.querySelector('#categories');
for(const sector of sectors){const option=document.createElement('option');option.value=sector.id;option.textContent=sector.name;category.append(option);}
function render(){root.replaceChildren();const q=search.value.toLocaleLowerCase().trim();const shown=sectors.filter(s=>(!category.value||s.id===category.value)&&[s.name,s.description].join(' ').toLocaleLowerCase().includes(q));for(const s of shown){const article=document.createElement('article');article.className='card';const title=document.createElement('h2');title.textContent=s.name;const desc=document.createElement('p');desc.textContent=s.description;const link=document.createElement('a');link.href=s.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Visit example official source';article.append(title,desc,link);root.append(article);}if(!shown.length){const p=document.createElement('p');p.textContent='No matching categories.';root.append(p);}}
search.addEventListener('input',render);category.addEventListener('change',render);render();