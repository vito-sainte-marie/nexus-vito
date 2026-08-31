// NEXUS Inventaire — comptage cigarettes en paquets + cartouches.
// Le moteur principal continue de recevoir UNE quantité de base (paquets).
// Cette couche terrain facilite seulement la saisie physique :
// total = paquets saisis + cartouches × facteur propre au produit (10P, 8P, 5P…).
(function(){
  'use strict';
  if((location.pathname.split('/').pop()||'')!=='NEXUS-Inventaire-v1.html') return;

  const cache=new Map();
  let employee=null;
  let observer=null;

  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
  function nombre(v){
    const n=Number(String(v??'').replace(',','.'));
    return Number.isFinite(n)&&n>=0?n:0;
  }
  function cleMemo(input){
    const phase=/stock final/i.test(input.placeholder||'')?'cloture':'ouverture';
    return `nexus_inv_cond_${employee?.id||'x'}_${phase}_${input.dataset.produit}`;
  }
  function lireMemo(input){
    try{const r=sessionStorage.getItem(cleMemo(input));return r?JSON.parse(r):null;}catch(_){return null;}
  }
  function ecrireMemo(input,paquets,cartouches){
    try{sessionStorage.setItem(cleMemo(input),JSON.stringify({paquets,cartouches}));}catch(_){}
  }

  function styles(){
    if(document.getElementById('niccStyle')) return;
    const s=document.createElement('style');s.id='niccStyle';s.textContent=`
      .nicc-wrap{width:100%;display:grid;grid-template-columns:1fr 1fr;gap:7px}
      .nicc-field{background:var(--panel-raised);border:1px solid var(--hairline);border-radius:9px;padding:7px 9px}
      .nicc-label{font:8.5px var(--mono);color:var(--text-dim);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
      .nicc-input{width:100%;border:0;background:transparent;color:var(--text);font:600 16px var(--mono);text-align:right;outline:none}
      .nicc-total{grid-column:1/-1;font:10px var(--mono);color:var(--cyan);text-align:right;margin-top:1px}
      .nicc-factor{color:var(--text-dim)}
      .nicc-original{display:none!important}
      @media(max-width:420px){.nicc-wrap{grid-template-columns:1fr 1fr}.nicc-field{padding:7px}.nicc-input{font-size:15px}}
    `;document.head.appendChild(s);
  }

  async function chargerMeta(ids){
    const manquants=ids.filter(id=>!cache.has(id));
    if(!manquants.length) return;
    const {data,error}=await nexusClient.from('inventaire_zone_produit')
      .select('id,designation,facteur_conditionnement,categorie_id,inventaire_categories(nom)')
      .eq('site',employee.site_id).in('id',manquants);
    if(error){console.warn('NEXUS conditionnement cigarettes:',error);return;}
    (data||[]).forEach(p=>cache.set(p.id,p));
  }

  function appliquer(input,meta){
    if(!input||input.dataset.nicc==='1') return;
    const categorie=String(meta?.inventaire_categories?.nom||'').toLowerCase();
    const facteur=Number(meta?.facteur_conditionnement)||0;
    if(!categorie.includes('cigarette')||facteur<=1) return;

    input.dataset.nicc='1'; input.classList.add('nicc-original');
    const memo=lireMemo(input);
    // Si aucune décomposition n'a été mémorisée, ne pas inventer de cartouche :
    // une ancienne valeur 22 reste 22 paquets + 0 cartouche.
    let paquets=memo?nombre(memo.paquets):nombre(input.value);
    let cartouches=memo?nombre(memo.cartouches):0;

    const wrap=document.createElement('div');wrap.className='nicc-wrap';
    wrap.innerHTML=`
      <div class="nicc-field"><div class="nicc-label">Paquets</div><input class="nicc-input nicc-paquets" type="number" min="0" step="1" inputmode="numeric" value="${esc(paquets||'')}"></div>
      <div class="nicc-field"><div class="nicc-label">Cartouches × ${facteur}</div><input class="nicc-input nicc-cartouches" type="number" min="0" step="1" inputmode="numeric" value="${esc(cartouches||'')}"></div>
      <div class="nicc-total">Total retenu : <b>0 paquet</b> <span class="nicc-factor">· 1 cartouche = ${facteur} paquets</span></div>`;
    input.parentNode.insertBefore(wrap,input);
    const ip=wrap.querySelector('.nicc-paquets'),ic=wrap.querySelector('.nicc-cartouches'),total=wrap.querySelector('.nicc-total b');

    function synchroniser(){
      paquets=nombre(ip.value); cartouches=nombre(ic.value);
      const base=paquets+cartouches*facteur;
      total.textContent=`${base} paquet${base>1?'s':''}`;
      input.value=String(base);
      ecrireMemo(input,paquets,cartouches);
      // Le moteur historique écoute 'input' sur .produit-input : on conserve
      // exactement ce contrat et on ne touche pas à sa logique métier.
      input.dispatchEvent(new Event('input',{bubbles:true}));
    }
    ip.addEventListener('input',synchroniser);ic.addEventListener('input',synchroniser);
    ip.addEventListener('focus',()=>ip.select());ic.addEventListener('focus',()=>ic.select());
    synchroniser();
  }

  async function scanner(){
    const inputs=[...document.querySelectorAll('.produit-input[data-produit]:not([data-nicc="1"])')].filter(i=>!i.disabled);
    if(!inputs.length) return;
    await chargerMeta([...new Set(inputs.map(i=>i.dataset.produit).filter(Boolean))]);
    inputs.forEach(i=>appliquer(i,cache.get(i.dataset.produit)));
  }

  async function init(){
    employee=await nexusRequireAuth(); if(!employee) return;
    styles(); await scanner();
    observer=new MutationObserver(()=>{clearTimeout(observer._t);observer._t=setTimeout(scanner,30);});
    observer.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
