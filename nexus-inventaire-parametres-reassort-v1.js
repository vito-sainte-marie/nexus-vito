// NEXUS Inventaire — Paramètres Réassort interne
// Règles de couverture au niveau de la catégorie, sans transformer NEXUS
// en outil de commande fournisseur.
(function(){
  'use strict';
  if(!/NEXUS-Parametres-Inventaire-v1\.html$/i.test(location.pathname))return;
  let employee=null,site=null,rules=[],cats=[];
  const $q=(s,r=document)=>r.querySelector(s);

  function styles(){
    if(document.getElementById('niprStyle'))return;
    const s=document.createElement('style');s.id='niprStyle';s.textContent=`
      .nipr-row{margin-top:9px;padding-top:9px;border-top:1px solid rgba(148,163,184,.12);display:flex;align-items:center;gap:9px;flex-wrap:wrap}
      .nipr-label{font-size:10.5px;color:#718096;min-width:72px}.nipr-main{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
      .nipr-input{width:78px;background:#1A222C;border:1px solid #2a3540;border-radius:8px;padding:7px 8px;color:#EDF1F5;font:600 12px 'IBM Plex Mono',monospace}
      .nipr-unit{font-size:10.5px;color:#8A96A5}.nipr-save{border:1px solid rgba(79,195,217,.28);background:rgba(79,195,217,.07);color:#bdeff8;border-radius:8px;padding:7px 9px;font:600 10px 'IBM Plex Mono',monospace;cursor:pointer}
      .nipr-note{font-size:10px;color:#64748b;line-height:1.4;flex-basis:100%}.nipr-status{font-size:10px;color:#718096}.nipr-status.ok{color:#34D399}.nipr-status.err{color:#F5A623}
      .nipr-sep{width:1px;height:25px;background:rgba(148,163,184,.14);margin:0 2px}
    `;document.head.appendChild(s);
  }
  const norm=s=>String(s||'').trim().toLowerCase();
  async function charger(){
    employee=await nexusRequireAuth();if(!employee)return false;site=employee.site_id;
    const [c,r]=await Promise.all([
      nexusClient.from('inventaire_categories').select('id,nom,actif').eq('site',site).eq('actif',true),
      nexusClient.from('inventaire_reassort_interne_regles').select('*').eq('site',site).is('produit_id',null).eq('actif',true)
    ]);
    if(c.error||r.error){console.error(c.error||r.error);return false;}cats=c.data||[];rules=r.data||[];return true;
  }
  function catDepuisRow(row){
    const id=row.dataset.categorieRegle;if(id)return cats.find(c=>c.id===id)||null;
    const txt=row.textContent||'';return cats.find(c=>norm(txt).includes(norm(c.nom)))||null;
  }
  function regle(catId){return rules.find(r=>r.categorie_id===catId&&r.mode_calcul==='couverture_jours')||null;}
  function statut(el,msg,cls=''){el.textContent=msg;el.className=`nipr-status ${cls}`;if(msg)setTimeout(()=>{if(el.textContent===msg)el.textContent='';},2200);}
  async function sauver(r,cibleInput,urgenceInput,status){
    const cible=Number(cibleInput.value),urgence=Number(urgenceInput.value);
    if(!(cible>0)){statut(status,'Cible invalide','err');return;}
    if(!(urgence>=0)||urgence>=cible){statut(status,'Urgence : entre 0 et la cible','err');return;}
    const {error}=await nexusClient.from('inventaire_reassort_interne_regles').update({
      couverture_cible_jours:cible,couverture_urgente_jours:urgence,
      updated_at:new Date().toISOString(),updated_by:employee.id
    }).eq('id',r.id);
    if(error){console.error(error);statut(status,'Échec','err');return;}
    r.couverture_cible_jours=cible;r.couverture_urgente_jours=urgence;statut(status,'Enregistré','ok');
  }
  function injecter(){
    document.querySelectorAll('[data-categorie-regle]').forEach(row=>{
      const cat=catDepuisRow(row);if(!cat)return;const r=regle(cat.id);if(!r)return;
      const card=row.closest('.card');if(!card||card.querySelector(`.nipr-row[data-cat="${cat.id}"]`))return;
      const cible=Number(r.couverture_cible_jours)||1.5;
      const urgence=Number.isFinite(Number(r.couverture_urgente_jours))?Number(r.couverture_urgente_jours):Math.min(.5,cible/3);
      const el=document.createElement('div');el.className='nipr-row';el.dataset.cat=cat.id;
      el.innerHTML=`<span class="nipr-label">Réassort</span><span class="nipr-main">
        <span class="nipr-unit">Cible boutique</span><input class="nipr-input nipr-cible" type="number" min="0.1" step="0.1" value="${cible}"><span class="nipr-unit">jour(s)</span>
        <span class="nipr-sep"></span><span class="nipr-unit">Urgent sous</span><input class="nipr-input nipr-urgence" type="number" min="0" step="0.1" value="${urgence}"><span class="nipr-unit">jour(s)</span>
        <button type="button" class="nipr-save">Enregistrer</button><span class="nipr-status"></span></span>
        <span class="nipr-note">La cible détermine le stock souhaité en boutique. Le seuil urgent pilote le voyant rouge dans Contrôle inventaire. Le besoin est arrondi au conditionnement complet supérieur.</span>`;
      card.appendChild(el);
      const cibleInput=$q('.nipr-cible',el),urgenceInput=$q('.nipr-urgence',el),status=$q('.nipr-status',el);
      $q('.nipr-save',el).onclick=()=>sauver(r,cibleInput,urgenceInput,status);
    });
  }
  async function init(){styles();if(!await charger())return;injecter();const o=new MutationObserver(()=>injecter());o.observe(document.body,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();