// NEXUS Inventaire Manager — Réassort cigarettes boutique
// Analyse TOUTES les références cigarettes actives du site, indépendamment
// du périmètre de mission du quart. Le module ne crée aucune commande : il
// propose uniquement des transferts internes Bureau -> Boutique en cartouches.
(function(){
  'use strict';
  if((location.pathname.split('/').pop()||'')!=='NEXUS-Inventaire-Manager-v1.html') return;

  const AGE_MAX_HEURES=36; // fraîcheur opérationnelle : au-delà, pas d'alerte de rupture affirmée.
  let site=null, employee=null, observer=null, raf=null, renduEnCours=false;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const n=v=>Number(v)||0;

  function ageHeures(date){return date?(Date.now()-new Date(date).getTime())/36e5:Infinity;}
  function joursPeriode(debut,fin){
    if(!debut||!fin)return 0;
    return Math.max(1,Math.round((new Date(fin+'T00:00:00')-new Date(debut+'T00:00:00'))/86400000)+1);
  }

  async function charger(){
    const {data:cat,error:ec}=await nexusClient.from('inventaire_categories').select('id,nom').eq('site',site).ilike('nom','Cigarettes').limit(1).maybeSingle();
    if(ec)throw ec;if(!cat)return null;
    const [pr,rr,zr]=await Promise.all([
      nexusClient.from('inventaire_zone_produit').select('id,designation,code_barres,facteur_conditionnement,actif').eq('site',site).eq('categorie_id',cat.id).eq('actif',true).order('designation'),
      nexusClient.from('inventaire_reassort_interne_regles').select('*').eq('site',site).eq('categorie_id',cat.id).is('produit_id',null).eq('actif',true).limit(1).maybeSingle(),
      nexusClient.from('inventaire_zones').select('id,code,nom').eq('site',site)
    ]);
    if(pr.error||rr.error||zr.error)throw(pr.error||rr.error||zr.error);
    const produits=pr.data||[], regle=rr.data;
    if(!regle||regle.mode_calcul!=='couverture_jours')return {cat,produits,regle:null};
    const zones=zr.data||[];
    const dest=zones.find(z=>z.id===regle.zone_destination_id)||zones.find(z=>z.code==='boutique');
    const src=zones.find(z=>z.id===regle.zone_source_id)||zones.find(z=>z.code==='bureau');
    if(!dest)return {cat,produits,regle,erreur:'destination'};

    const ids=produits.map(p=>p.id), codes=[...new Set(produits.map(p=>String(p.code_barres||'').trim()).filter(Boolean))];
    const {data:periode,error:ep}=await nexusClient.from('products').select('periode_debut,periode_fin').eq('site',site).order('periode_fin',{ascending:false}).limit(1).maybeSingle();
    if(ep)throw ep;
    let ventes=[];
    if(periode&&codes.length){
      const r=await nexusClient.from('products').select('code_barres,quantite').eq('site',site).eq('periode_fin',periode.periode_fin).in('code_barres',codes);
      if(r.error)throw r.error;ventes=r.data||[];
    }
    const ventesCode=new Map();
    ventes.forEach(v=>{const c=String(v.code_barres||'').trim();ventesCode.set(c,(ventesCode.get(c)||0)+Math.max(0,n(v.quantite)));});
    const jours=periode?joursPeriode(periode.periode_debut,periode.periode_fin):0;

    // Relevés localisés : priorité à la Boutique explicite.
    let releves=[];
    if(ids.length){
      const r=await nexusClient.from('inventaire_stock_localise_releves').select('produit_id,zone_id,quantite_base,releve_le,created_at').eq('site',site).eq('zone_id',dest.id).in('produit_id',ids).order('releve_le',{ascending:false});
      if(r.error)throw r.error;releves=r.data||[];
    }
    const dernierLocal=new Map();
    releves.forEach(r=>{if(!dernierLocal.has(r.produit_id))dernierLocal.set(r.produit_id,r);});

    // Les comptages caisse/boutique sont un repli seulement si aucun relevé
    // localisé n'existe. Ils ne permettent jamais d'affirmer le stock Bureau.
    let comptages=[];
    if(ids.length){
      const r=await nexusClient.from('inventaire_comptages').select('produit_id,quantite,quantite_boutique,compte_le,type_comptage,statut,source').eq('site',site).in('produit_id',ids).eq('statut','valide').eq('source','manuel').order('compte_le',{ascending:false});
      if(r.error)throw r.error;comptages=r.data||[];
    }
    const dernierCompte=new Map();
    comptages.forEach(r=>{if(!dernierCompte.has(r.produit_id))dernierCompte.set(r.produit_id,r);});

    // Stock source localisé, uniquement pour indiquer si la proposition peut
    // matériellement être servie. L'absence de relevé Bureau n'efface pas le besoin boutique.
    let sources=[];
    if(src&&ids.length){
      const r=await nexusClient.from('inventaire_stock_localise_releves').select('produit_id,quantite_base,releve_le').eq('site',site).eq('zone_id',src.id).in('produit_id',ids).order('releve_le',{ascending:false});
      if(r.error)throw r.error;sources=r.data||[];
    }
    const dernierSource=new Map();sources.forEach(r=>{if(!dernierSource.has(r.produit_id))dernierSource.set(r.produit_id,r);});

    const cible=Math.max(.1,n(regle.couverture_cible_jours)||1.5);
    const urgent=Math.max(0,n(regle.couverture_urgente_jours)||(cible/3));
    const analyses=produits.map(p=>{
      const code=String(p.code_barres||'').trim(), vendus=ventesCode.get(code)||0, vj=jours>0?vendus/jours:0;
      const local=dernierLocal.get(p.id), compte=dernierCompte.get(p.id);
      let stock=null, stockLe=null, stockSource=null;
      if(local){stock=n(local.quantite_base);stockLe=local.releve_le;stockSource='stock_localise';}
      else if(compte){stock=compte.quantite_boutique!=null?n(compte.quantite_boutique):n(compte.quantite);stockLe=compte.compte_le;stockSource='comptage_caisse';}
      const frais=stock!=null&&ageHeures(stockLe)<=AGE_MAX_HEURES;
      const facteur=Math.max(1,n(p.facteur_conditionnement)||1);
      const couverture=frais&&vj>0?stock/vj:null;
      const manque=frais&&vj>0?Math.max(0,vj*cible-stock):0;
      const cartouches=manque>0?Math.ceil(manque/facteur):0;
      const srcReleve=dernierSource.get(p.id), sourceQ=srcReleve?n(srcReleve.quantite_base):null;
      const sourceCartouches=sourceQ==null?null:Math.floor(sourceQ/facteur);
      const besoin=cartouches>0;
      return {p,stock,stockLe,stockSource,frais,vj,couverture,facteur,cartouches,sourceQ,sourceCartouches,besoin,urgent:besoin&&couverture!=null&&couverture<=urgent,donneeVente:vj>0};
    });
    return {cat,produits,regle,cible,urgent,periode,src,dest,analyses};
  }

  function installerStyle(){
    if(document.getElementById('nirmcStyle'))return;
    const s=document.createElement('style');s.id='nirmcStyle';s.textContent=`
      @keyframes nexusUrgentPulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(240,87,90,.65)}50%{opacity:.25;box-shadow:0 0 0 7px rgba(240,87,90,0)}}
      .nirmc{grid-column:1/-1;border:1px solid rgba(79,195,217,.22);border-radius:14px;background:linear-gradient(145deg,rgba(20,27,34,.97),rgba(15,22,29,.97));padding:14px;margin-bottom:14px}
      .nirmc.compact{padding:10px 13px}.nirmc-head{display:flex;align-items:center;gap:10px}.nirmc-icon{width:34px;height:34px;border-radius:10px;background:rgba(79,195,217,.09);display:flex;align-items:center;justify-content:center;font-size:17px;flex:none}
      .nirmc-title{font-size:13px;font-weight:700}.nirmc-sub{font-size:10.5px;color:#8A96A5;margin-top:2px;line-height:1.4}.nirmc-spacer{flex:1}
      .nirmc-target{font:700 9px 'IBM Plex Mono',monospace;color:#4FC3D9;border:1px solid rgba(79,195,217,.25);border-radius:999px;padding:4px 7px;white-space:nowrap}
      .nirmc-beacon{width:11px;height:11px;border-radius:50%;background:#F0575A;animation:nexusUrgentPulse .9s infinite;flex:none}.nirmc-urgent-text{font:700 9px 'IBM Plex Mono',monospace;color:#F0575A;text-transform:uppercase}
      .nirmc-summary{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.nirmc-chip{font-size:10.5px;padding:6px 8px;border-radius:8px;background:#1A222C;color:#8A96A5}.nirmc-chip b{color:#EDF1F5}.nirmc-chip.red{background:rgba(240,87,90,.09);color:#ff9b9d}.nirmc-chip.amber{background:rgba(245,166,35,.08);color:#f7c66d}
      .nirmc-list{margin-top:10px;display:flex;flex-direction:column;gap:6px}.nirmc-item{display:grid;grid-template-columns:minmax(150px,1fr) auto;gap:8px;padding:9px 10px;border:1px solid #242E38;border-radius:10px;background:#10171d}.nirmc-item.urgent{border-color:rgba(240,87,90,.38);background:rgba(240,87,90,.045)}
      .nirmc-name{font-size:11.5px;font-weight:650}.nirmc-meta{font-size:10px;color:#8A96A5;margin-top:3px;line-height:1.45}.nirmc-prop{font:700 11px 'IBM Plex Mono',monospace;color:#34D399;text-align:right;white-space:nowrap}.nirmc-prop.red{color:#ff777a}
      .nirmc-foot{display:flex;align-items:center;gap:10px;margin-top:10px}.nirmc-link{font:600 10.5px 'IBM Plex Mono',monospace;color:#4FC3D9;text-decoration:none}.nirmc-toggle{margin-left:auto;border:0;background:transparent;color:#718096;font-size:10.5px;cursor:pointer}.nirmc-note{font-size:10px;color:#718096;line-height:1.45;margin-top:8px}
      @media(max-width:620px){.nirmc-item{grid-template-columns:1fr}.nirmc-prop{text-align:left}}
    `;document.head.appendChild(s);
  }

  function html(ctx){
    if(!ctx||!ctx.regle)return `<div class="nirmc compact"><div class="nirmc-head"><div class="nirmc-icon">🚬</div><div><div class="nirmc-title">Réassort cigarettes</div><div class="nirmc-sub">Configurez une couverture boutique dans Paramètres Inventaire.</div></div><div class="nirmc-spacer"></div><a class="nirmc-link" href="NEXUS-Parametres-Inventaire-v1.html">Configurer →</a></div></div>`;
    const a=ctx.analyses||[], besoins=a.filter(x=>x.besoin), urgents=besoins.filter(x=>x.urgent), aMaj=a.filter(x=>!x.frais), sansVente=a.filter(x=>!x.donneeVente);
    const compact=besoins.length===0;
    if(compact){
      return `<div class="nirmc compact"><div class="nirmc-head"><div class="nirmc-icon">🚬</div><div><div class="nirmc-title">Réassort cigarettes</div><div class="nirmc-sub">${aMaj.length?`${aMaj.length} référence(s) à actualiser avant conclusion.`:`Couverture boutique suffisante sur les ${a.length} références analysables.`}</div></div><div class="nirmc-spacer"></div><span class="nirmc-target">Cible ${ctx.cible.toFixed(1)} j</span>${aMaj.length?'<span class="nirmc-chip amber">Données à actualiser</span>':'<span class="nirmc-chip">✓ Aucun besoin</span>'}</div><div class="nirmc-foot"><a class="nirmc-link" href="NEXUS-Stock-Localise-v1.html">Stock par emplacement →</a><button class="nirmc-toggle" data-nirmc-expand>Voir les références</button></div><div class="nirmc-list" data-nirmc-list style="display:none">${listeToutes(a,ctx)}</div></div>`;
    }
    return `<div class="nirmc"><div class="nirmc-head"><div class="nirmc-icon">🚬</div><div><div class="nirmc-title">Besoins de réassort cigarettes</div><div class="nirmc-sub">Toutes les références cigarettes actives sont analysées, pas seulement celles de la mission d'inventaire.</div></div><div class="nirmc-spacer"></div>${urgents.length?'<span class="nirmc-beacon" title="Besoin urgent"></span><span class="nirmc-urgent-text">Urgent</span>':''}<span class="nirmc-target">Cible ${ctx.cible.toFixed(1)} j</span></div>
      <div class="nirmc-summary"><span class="nirmc-chip"><b>${a.length}</b> références suivies</span><span class="nirmc-chip ${urgents.length?'red':''}"><b>${urgents.length}</b> urgentes</span><span class="nirmc-chip"><b>${besoins.length}</b> à réassortir</span>${aMaj.length?`<span class="nirmc-chip amber"><b>${aMaj.length}</b> à actualiser</span>`:''}</div>
      <div class="nirmc-list">${besoins.sort((x,y)=>(y.urgent-x.urgent)||((x.couverture??999)-(y.couverture??999))).map(x=>ligne(x,ctx)).join('')}</div>
      <div class="nirmc-foot"><a class="nirmc-link" href="NEXUS-Stock-Localise-v1.html">Préparer les transferts →</a><a class="nirmc-link" href="NEXUS-Parametres-Inventaire-v1.html">Régler la couverture →</a><button class="nirmc-toggle" data-nirmc-expand>Voir toutes les cigarettes</button></div><div class="nirmc-list" data-nirmc-list style="display:none">${listeToutes(a,ctx)}</div>
      ${aMaj.length?`<div class="nirmc-note">NEXUS n'affirme pas une rupture à partir d'un ancien comptage : ${aMaj.length} référence(s) ont un stock absent ou âgé de plus de ${AGE_MAX_HEURES} h.</div>`:''}</div>`;
  }

  function ligne(x,ctx){
    const cov=x.couverture==null?'—':`${x.couverture.toFixed(1)} j`;
    const stock=x.stock==null?'—':`${Math.round(x.stock)} pqt`;
    const source=x.sourceCartouches==null?'Bureau non relevé':`${x.sourceCartouches} cart. dispo bureau`;
    return `<div class="nirmc-item ${x.urgent?'urgent':''}"><div><div class="nirmc-name">${esc(x.p.designation)}</div><div class="nirmc-meta">Boutique ${stock} · couverture ${cov} · ${source}</div></div><div class="nirmc-prop ${x.urgent?'red':''}">${x.cartouches} cartouche${x.cartouches>1?'s':''}</div></div>`;
  }
  function listeToutes(a,ctx){
    return a.map(x=>{
      if(x.besoin)return ligne(x,ctx);
      const etat=!x.frais?'Stock à actualiser':!x.donneeVente?'Rotation non calculable':'Couverture suffisante';
      return `<div class="nirmc-item"><div><div class="nirmc-name">${esc(x.p.designation)}</div><div class="nirmc-meta">${etat}${x.couverture!=null?` · ${x.couverture.toFixed(1)} j`:''}</div></div><div class="nirmc-prop" style="color:#718096">—</div></div>`;
    }).join('');
  }

  function brancher(bloc){
    bloc.querySelectorAll('[data-nirmc-expand]').forEach(b=>b.onclick=()=>{const l=bloc.querySelector('[data-nirmc-list]');if(!l)return;const ouvert=l.style.display!=='none';l.style.display=ouvert?'none':'flex';b.textContent=ouvert?(bloc.querySelector('.nirmc-list:not([data-nirmc-list])')?'Voir toutes les cigarettes':'Voir les références'):'Réduire';});
  }

  async function rendre(){
    if(renduEnCours)return;renduEnCours=true;
    try{
      const content=document.getElementById('content');if(!content)return;
      const ancien=document.getElementById('nexusManagerReassortCigarettes');if(ancien)ancien.remove();
      const ctx=await charger();
      const wrap=document.createElement('div');wrap.id='nexusManagerReassortCigarettes';wrap.style.gridColumn='1/-1';wrap.innerHTML=html(ctx);
      content.insertBefore(wrap,content.firstChild);brancher(wrap);
    }catch(e){console.error('NEXUS Réassort cigarettes manager:',e);}finally{renduEnCours=false;}
  }

  async function init(){
    employee=await nexusRequireAuth();if(!employee||!['manager','gerant'].includes(employee.role))return;site=employee.site_id;installerStyle();
    await rendre();
    const content=document.getElementById('content');if(!content)return;
    observer=new MutationObserver(()=>{if(renduEnCours)return;clearTimeout(raf);raf=setTimeout(rendre,180);});observer.observe(content,{childList:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();