// NEXUS Inventaire — Réassort interne boutique
// Déplace du stock déjà présent dans l'établissement entre deux emplacements.
// Ce moteur ne crée JAMAIS une commande fournisseur, une livraison ou une entrée de stock global.
// V2 : possibilité de raisonner en couverture de ventes et en conditionnements complets.
(function(){
  'use strict';
  if((location.pathname.split('/').pop()||'')!=='NEXUS-Stock-Localise-v1.html') return;

  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  let employee=null, site=null;

  function installerStyle(){
    if($('nexusReassortBoutiqueStyle')) return;
    const st=document.createElement('style'); st.id='nexusReassortBoutiqueStyle';
    st.textContent=`
      #nrbBtn{border-color:rgba(52,211,153,.32);color:#bdf7df;background:rgba(52,211,153,.07)}
      #nrbModal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(5,9,13,.84);z-index:670}
      #nrbModal.on{display:flex}.nrb-card{width:min(680px,100%);max-height:92vh;overflow:auto;background:#141B22;border:1px solid #283440;border-radius:16px;padding:18px}
      .nrb-title{font-size:19px;font-weight:700}.nrb-sub{font-size:12px;color:#8A96A5;line-height:1.5;margin:4px 0 14px}
      .nrb-config{padding:12px;border:1px solid rgba(79,195,217,.18);border-radius:11px;background:rgba(79,195,217,.04);margin-bottom:14px}
      .nrb-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.nrb-label{font:9.5px 'IBM Plex Mono',monospace;color:#718096;text-transform:uppercase;letter-spacing:.05em;margin:7px 0 4px}
      .nrb-input{width:100%;background:#1A222C;border:1px solid #2a3540;border-radius:8px;padding:9px 10px;color:#EDF1F5}
      .nrb-save{margin-top:10px;border:1px solid rgba(79,195,217,.35);background:rgba(79,195,217,.09);color:#bdeff8;border-radius:8px;padding:9px 11px;font-weight:600;cursor:pointer}
      .nrb-list{display:flex;flex-direction:column;gap:8px}.nrb-item{border:1px solid #283440;border-radius:11px;padding:12px;background:#10171d}
      .nrb-top{display:flex;gap:10px;align-items:flex-start}.nrb-name{font-size:13px;font-weight:700;flex:1}.nrb-badge{font:700 9px 'IBM Plex Mono',monospace;padding:4px 7px;border-radius:999px;background:rgba(245,166,35,.12);color:#F5A623}
      .nrb-meta{font-size:11px;color:#8A96A5;line-height:1.55;margin-top:6px}.nrb-meta b{color:#EDF1F5}.nrb-action{margin-top:9px;width:100%;border:1px solid rgba(52,211,153,.35);background:rgba(52,211,153,.10);color:#9ef0c8;border-radius:8px;padding:9px;font-weight:700;cursor:pointer}
      .nrb-empty{padding:20px;text-align:center;color:#718096;font-size:12px;line-height:1.55}.nrb-footer{display:flex;gap:8px;margin-top:14px}.nrb-close{width:100%;border:1px solid #283440;background:transparent;color:#8A96A5;border-radius:9px;padding:10px;font-weight:600}
      @media(max-width:620px){.nrb-grid{grid-template-columns:1fr}}
    `; document.head.appendChild(st);
  }

  async function contexte(){
    employee=await nexusRequireAuth(); if(!employee||!['manager','gerant'].includes(employee.role)) return false;
    site=employee.site_id; return true;
  }

  async function donneesCategorie(catId){
    const [zr,mr,pr,rr]=await Promise.all([
      nexusClient.from('inventaire_zones').select('id,code,nom,ordre_affichage').eq('site',site).order('ordre_affichage'),
      nexusClient.from('inventaire_categories_zones_stock').select('zone_id,ordre,actif').eq('site',site).eq('categorie_id',catId).eq('actif',true).order('ordre'),
      nexusClient.from('inventaire_zone_produit').select('id,designation,code_barres,categorie_id,actif,facteur_conditionnement').eq('site',site).eq('categorie_id',catId).eq('actif',true).order('designation'),
      nexusClient.from('inventaire_reassort_interne_regles').select('*').eq('site',site).eq('actif',true)
    ]);
    for(const r of [zr,mr,pr,rr]) if(r.error) throw r.error;
    const zBy=Object.fromEntries((zr.data||[]).map(z=>[z.id,z]));
    const zones=(mr.data||[]).map(m=>zBy[m.zone_id]).filter(Boolean);
    return {zones,produits:pr.data||[],regles:rr.data||[]};
  }

  async function chargerVentesRecentes(produits){
    const codes=[...new Set((produits||[]).map(p=>String(p.code_barres||'').trim()).filter(Boolean))];
    if(!codes.length) return {parCode:new Map(),jours:0,periode:null};
    const {data:derniere,error:e1}=await nexusClient.from('products').select('periode_debut,periode_fin').eq('site',site).order('periode_fin',{ascending:false}).limit(1).maybeSingle();
    if(e1||!derniere) return {parCode:new Map(),jours:0,periode:null};
    const {data,error}=await nexusClient.from('products').select('code_barres,quantite,periode_debut,periode_fin').eq('site',site).eq('periode_fin',derniere.periode_fin).in('code_barres',codes);
    if(error) throw error;
    const debut=new Date(`${derniere.periode_debut}T00:00:00`), fin=new Date(`${derniere.periode_fin}T00:00:00`);
    const jours=Math.max(1,Math.round((fin-debut)/86400000)+1);
    const parCode=new Map();
    for(const l of data||[]){const c=String(l.code_barres||'').trim();if(!c)continue;parCode.set(c,(parCode.get(c)||0)+Math.max(0,Number(l.quantite)||0));}
    return {parCode,jours,periode:derniere};
  }

  async function stockZone(produitId,zoneId){
    const {data:releve,error}=await nexusClient.from('inventaire_stock_localise_releves')
      .select('quantite_base,releve_le').eq('site',site).eq('produit_id',produitId).eq('zone_id',zoneId)
      .order('releve_le',{ascending:false}).limit(1).maybeSingle();
    if(error) throw error; if(!releve) return null;
    const {data:mvs,error:em}=await nexusClient.from('inventaire_mouvements')
      .select('quantite,zone_source_id,zone_destination_id,cree_le,statut_validation')
      .eq('site',site).eq('produit_id',produitId).eq('type_mouvement','transfert').gt('cree_le',releve.releve_le).order('cree_le');
    if(em) throw em;
    let q=Number(releve.quantite_base)||0;
    for(const mv of mvs||[]){
      if(mv.statut_validation && mv.statut_validation!=='valide') continue;
      const d=Number(mv.quantite)||0; if(mv.zone_source_id===zoneId)q-=d; if(mv.zone_destination_id===zoneId)q+=d;
    }
    return q;
  }

  function regleEffective(produit,catId,regles){
    return regles.find(r=>r.produit_id===produit.id) || regles.find(r=>r.categorie_id===catId&&r.produit_id==null) || null;
  }

  async function analyser(catId,data){
    const out=[];
    const ventes=await chargerVentesRecentes(data.produits);
    for(const p of data.produits){
      const r=regleEffective(p,catId,data.regles); if(!r) continue;
      const [src,dst]=await Promise.all([stockZone(p.id,r.zone_source_id),stockZone(p.id,r.zone_destination_id)]);
      if(src==null||dst==null) continue;

      if(r.mode_calcul==='couverture_jours'){
        const code=String(p.code_barres||'').trim();
        const vendus=ventes.parCode.get(code)||0;
        const ventesJour=ventes.jours>0?vendus/ventes.jours:0;
        if(!(ventesJour>0)) continue;
        const couvertureCible=Math.max(.1,Number(r.couverture_cible_jours)||1.5);
        const ciblePaquets=ventesJour*couvertureCible;
        if(dst>=ciblePaquets) continue;
        const manque=Math.max(0,ciblePaquets-dst);
        const facteur=Math.max(1,Number(p.facteur_conditionnement)||1);
        // Le réassort cigarettes se raisonne en conditionnements COMPLETS :
        // besoin 1 cartouche + 2 paquets => proposition 2 cartouches.
        const conditionnementsNecessaires=Math.ceil(manque/facteur);
        const conditionnementsDisponibles=Math.floor(Math.max(0,src)/facteur);
        const conditionnements=Math.min(conditionnementsNecessaires,conditionnementsDisponibles);
        if(conditionnements<=0) continue;
        const quantiteBase=conditionnements*facteur;
        out.push({produit:p,regle:r,source:src,destination:dst,quantite:quantiteBase,conditionnements,facteur,ventesJour,couvertureActuelle:dst/ventesJour,couvertureCible,periode:ventes.periode});
        continue;
      }

      const seuil=Number(r.seuil_destination), cible=Number(r.cible_destination);
      if(dst>seuil) continue;
      const q=Math.min(Math.max(0,cible-dst),Math.max(0,src));
      if(q>0) out.push({produit:p,regle:r,source:src,destination:dst,quantite:q,conditionnements:null,facteur:1});
    }
    return out;
  }

  async function sauvegarderRegleCategorie(catId,ancienne,payload){
    if(ancienne){const {error}=await nexusClient.from('inventaire_reassort_interne_regles').update(payload).eq('id',ancienne.id);if(error)throw error;return;}
    const {error}=await nexusClient.from('inventaire_reassort_interne_regles').insert(payload);if(error)throw error;
  }

  function creerUI(){
    if($('nrbBtn')) return true;
    const actions=document.querySelector('.actions'), cat=$('categorie'); if(!actions||!cat) return false;
    installerStyle();
    const btn=document.createElement('button'); btn.type='button'; btn.id='nrbBtn'; btn.className='btn'; btn.textContent='↓ Réassort boutique';
    actions.insertBefore(btn,$('nexusStockTransferBtn')||$('btnAnnuler')||null);
    const modal=document.createElement('div'); modal.id='nrbModal'; modal.innerHTML=`<div class="nrb-card">
      <div class="nrb-title">Réassort boutique</div>
      <div class="nrb-sub">NEXUS déplace uniquement du stock déjà présent entre réserve et point de vente. Pour les catégories configurées en couverture, la cible est calculée à partir des ventes récentes puis arrondie au conditionnement complet supérieur.</div>
      <div id="nrbConfig" class="nrb-config"></div><div id="nrbList" class="nrb-list"></div>
      <div class="nrb-footer"><button type="button" id="nrbClose" class="nrb-close">Fermer</button></div></div>`;
    document.body.appendChild(modal);

    async function ouvrir(){
      const catId=cat.value; if(!catId) return;
      const data=await donneesCategorie(catId), zones=data.zones;
      const catRule=data.regles.find(r=>r.categorie_id===catId&&r.produit_id==null)||null;
      const bureau=zones.find(z=>z.code==='bureau')||zones[0], boutique=zones.find(z=>z.code==='boutique')||zones[1];
      const sourceId=catRule?.zone_source_id||bureau?.id||'', destId=catRule?.zone_destination_id||boutique?.id||'';
      const mode=catRule?.mode_calcul||'quantite_fixe';
      $('nrbConfig').innerHTML=`<div style="font-size:11.5px;font-weight:700">Règle de la catégorie</div>
        <div class="nrb-grid"><div><div class="nrb-label">Réserve / source</div><select id="nrbSource" class="nrb-input">${zones.map(z=>`<option value="${z.id}" ${z.id===sourceId?'selected':''}>${esc(z.nom)}</option>`).join('')}</select></div>
        <div><div class="nrb-label">Boutique / destination</div><select id="nrbDest" class="nrb-input">${zones.map(z=>`<option value="${z.id}" ${z.id===destId?'selected':''}>${esc(z.nom)}</option>`).join('')}</select></div>
        <div><div class="nrb-label">Mode de calcul</div><select id="nrbMode" class="nrb-input"><option value="couverture_jours" ${mode==='couverture_jours'?'selected':''}>Couverture en jours</option><option value="quantite_fixe" ${mode==='quantite_fixe'?'selected':''}>Seuil / cible fixes</option></select></div>
        <div id="nrbCouvertureBloc"><div class="nrb-label">Couverture cible</div><input id="nrbCouverture" class="nrb-input" type="number" min="0.1" step="0.1" value="${catRule?.couverture_cible_jours??1.5}"><div style="font-size:10px;color:#718096;margin-top:4px">jours complets de ventes</div></div>
        <div id="nrbSeuilBloc"><div class="nrb-label">Déclencher à ou sous</div><input id="nrbSeuil" class="nrb-input" type="number" min="0" step="1" value="${catRule?.seuil_destination??0}"></div>
        <div id="nrbCibleBloc"><div class="nrb-label">Remonter jusqu'à</div><input id="nrbCible" class="nrb-input" type="number" min="0" step="1" value="${catRule?.cible_destination??0}"></div></div>
        <button id="nrbSave" type="button" class="nrb-save">Enregistrer la règle</button>
        <div style="font-size:10.5px;color:#718096;margin-top:7px">En mode couverture, NEXUS utilise la dernière période de ventes disponible. Si le besoin représente 1 cartouche + quelques paquets, il propose 2 cartouches complètes.</div>`;

      const majMode=()=>{const cov=$('nrbMode').value==='couverture_jours';$('nrbCouvertureBloc').style.display=cov?'block':'none';$('nrbSeuilBloc').style.display=cov?'none':'block';$('nrbCibleBloc').style.display=cov?'none':'block';};
      $('nrbMode').onchange=majMode;majMode();

      const suggestions=await analyser(catId,data);
      $('nrbList').innerHTML=suggestions.length?suggestions.map(s=>{
        const couverture=s.conditionnements!=null?` · Couverture actuelle : <b>${s.couvertureActuelle.toFixed(1)} j</b> · Cible : <b>${s.couvertureCible.toFixed(1)} j</b>`:'';
        const proposition=s.conditionnements!=null?`<b>${s.conditionnements} cartouche${s.conditionnements>1?'s':''}</b> (${s.quantite} paquets)`:`<b>${s.quantite}</b> unité(s)`;
        return `<div class="nrb-item"><div class="nrb-top"><div class="nrb-name">${esc(s.produit.designation)}</div><div class="nrb-badge">À réassortir</div></div><div class="nrb-meta">Boutique : <b>${s.destination}</b> · Réserve : <b>${s.source}</b>${couverture}<br>Proposition interne : ${proposition}</div><button class="nrb-action" data-prod="${s.produit.id}" data-src="${s.regle.zone_source_id}" data-dst="${s.regle.zone_destination_id}" data-q="${s.quantite}" data-cond="${s.conditionnements??''}" data-facteur="${s.facteur}">Préparer le transfert</button></div>`;
      }).join(''):`<div class="nrb-empty">${catRule?'Aucun réassort boutique nécessaire avec la règle actuelle, ou les données physiques/ventes nécessaires ne sont pas encore disponibles.':'Aucune règle de réassort boutique n’est encore configurée pour cette catégorie.'}</div>`;
      modal.classList.add('on');

      $('nrbSave').onclick=async()=>{
        const src=$('nrbSource').value,dst=$('nrbDest').value,modeCalcul=$('nrbMode').value;
        if(!src||!dst||src===dst) return alert('Choisissez deux emplacements différents.');
        const couverture=Number($('nrbCouverture').value),seuil=Number($('nrbSeuil').value),cible=Number($('nrbCible').value);
        if(modeCalcul==='couverture_jours'&&(!(couverture>0))) return alert('La couverture cible doit être supérieure à 0 jour.');
        if(modeCalcul==='quantite_fixe'&&(!Number.isFinite(seuil)||!Number.isFinite(cible)||seuil<0||cible<seuil)) return alert('La cible doit être supérieure ou égale au seuil.');
        const payload={site,categorie_id:catId,produit_id:null,zone_source_id:src,zone_destination_id:dst,seuil_destination:modeCalcul==='quantite_fixe'?seuil:0,cible_destination:modeCalcul==='quantite_fixe'?cible:0,mode_calcul:modeCalcul,couverture_cible_jours:modeCalcul==='couverture_jours'?couverture:null,actif:true,updated_at:new Date().toISOString(),updated_by:employee.id};
        try{await sauvegarderRegleCategorie(catId,catRule,payload);}catch(error){console.error(error);alert('La règle n’a pas pu être enregistrée.');return;}
        modal.classList.remove('on'); await ouvrir();
      };

      modal.querySelectorAll('.nrb-action').forEach(b=>b.onclick=()=>{
        const t=$('nexusStockTransferBtn'); if(!t) return alert('Le module Transfert interne est indisponible.');
        modal.classList.remove('on'); t.click();
        setTimeout(()=>{
          const p=$('nstProduit'),s=$('nstSource'),d=$('nstDestination'),q=$('nstQuantite'),u=$('nstUnite'),f=$('nstFacteur');
          if(p){p.value=b.dataset.prod;p.dispatchEvent(new Event('change'));}
          if(s){s.value=b.dataset.src;s.dispatchEvent(new Event('change'));}
          if(d){d.value=b.dataset.dst;d.dispatchEvent(new Event('change'));}
          const nbCond=Number(b.dataset.cond);
          if(Number.isFinite(nbCond)&&nbCond>0){if(q)q.value=String(nbCond);if(u){u.value='cartouche';u.dispatchEvent(new Event('change'));}if(f)f.value=String(Number(b.dataset.facteur)||1);}
          else {if(q)q.value=b.dataset.q;if(u){u.value='paquet';u.dispatchEvent(new Event('change'));}}
        },250);
      });
    }

    btn.onclick=()=>ouvrir().catch(e=>{console.error('Réassort boutique:',e);alert('Le réassort boutique est momentanément indisponible.');});
    $('nrbClose').onclick=()=>modal.classList.remove('on'); modal.onclick=e=>{if(e.target===modal)modal.classList.remove('on')};
    return true;
  }

  async function init(){if(!await contexte()) return; for(let i=0;i<60;i++){if(creerUI()) return; await new Promise(r=>setTimeout(r,100));}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
