// NEXUS Inventaire Manager — Réassort cigarettes boutique V3
// Toutes les références cigarettes actives sont analysées, indépendamment
// des missions du quart. Les transferts internes postérieurs au dernier
// relevé physique sont intégrés avant de calculer la couverture boutique.
(function(){
  'use strict';
  if((location.pathname.split('/').pop()||'')!=='NEXUS-Inventaire-Manager-v1.html') return;
  const AGE_MAX_HEURES=36;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const num=v=>Number(v)||0;
  let employee=null,site=null,rendering=false;
  function ageH(d){return d?(Date.now()-new Date(d).getTime())/36e5:Infinity;}
  function nbJours(a,b){if(!a||!b)return 0;return Math.max(1,Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000)+1);}
  function firstBy(rows,key='produit_id'){const m=new Map();for(const r of rows||[])if(!m.has(r[key]))m.set(r[key],r);return m;}

  async function analyser(){
    const {data:cat,error:ec}=await nexusClient.from('inventaire_categories').select('id,nom').eq('site',site).ilike('nom','Cigarettes').limit(1).maybeSingle();
    if(ec)throw ec;if(!cat)return null;
    const [pr,rr,zr,per]=await Promise.all([
      nexusClient.from('inventaire_zone_produit').select('id,designation,code_barres,facteur_conditionnement').eq('site',site).eq('categorie_id',cat.id).eq('actif',true).order('designation'),
      nexusClient.from('inventaire_reassort_interne_regles').select('*').eq('site',site).eq('categorie_id',cat.id).is('produit_id',null).eq('actif',true).limit(1).maybeSingle(),
      nexusClient.from('inventaire_zones').select('id,code,nom').eq('site',site),
      nexusClient.from('products').select('periode_debut,periode_fin').eq('site',site).order('periode_fin',{ascending:false}).limit(1).maybeSingle()
    ]);
    for(const r of [pr,rr,zr,per])if(r.error)throw r.error;
    const produits=pr.data||[],regle=rr.data;
    if(!regle||regle.mode_calcul!=='couverture_jours')return {produits,regle:null};
    const zones=zr.data||[];
    const dest=zones.find(z=>z.id===regle.zone_destination_id)||zones.find(z=>z.code==='boutique');
    const src=zones.find(z=>z.id===regle.zone_source_id)||zones.find(z=>z.code==='bureau');
    if(!dest)return {produits,regle,erreur:'destination'};
    const ids=produits.map(p=>p.id),codes=[...new Set(produits.map(p=>String(p.code_barres||'').trim()).filter(Boolean))];

    let ventes=[],locaux=[],sources=[],comptages=[],mouvements=[];
    if(per.data&&codes.length){const r=await nexusClient.from('products').select('code_barres,quantite').eq('site',site).eq('periode_fin',per.data.periode_fin).in('code_barres',codes);if(r.error)throw r.error;ventes=r.data||[];}
    if(ids.length){
      const reqs=[
        nexusClient.from('inventaire_stock_localise_releves').select('produit_id,zone_id,quantite_base,releve_le').eq('site',site).eq('zone_id',dest.id).in('produit_id',ids).order('releve_le',{ascending:false}),
        nexusClient.from('inventaire_comptages').select('produit_id,quantite,quantite_boutique,compte_le').eq('site',site).in('produit_id',ids).eq('statut','valide').eq('source','manuel').order('compte_le',{ascending:false}),
        nexusClient.from('inventaire_mouvements').select('produit_id,quantite,zone_source_id,zone_destination_id,cree_le,statut_validation').eq('site',site).eq('type_mouvement','transfert').in('produit_id',ids).order('cree_le',{ascending:true})
      ];
      if(src) reqs.push(nexusClient.from('inventaire_stock_localise_releves').select('produit_id,zone_id,quantite_base,releve_le').eq('site',site).eq('zone_id',src.id).in('produit_id',ids).order('releve_le',{ascending:false}));
      const rs=await Promise.all(reqs);for(const r of rs)if(r.error)throw r.error;
      locaux=rs[0].data||[];comptages=rs[1].data||[];mouvements=rs[2].data||[];sources=rs[3]?.data||[];
    }
    const ml=firstBy(locaux),mc=firstBy(comptages),ms=firstBy(sources);
    const mvParProduit=new Map();for(const mv of mouvements){if(mv.statut_validation&&mv.statut_validation!=='valide')continue;if(!mvParProduit.has(mv.produit_id))mvParProduit.set(mv.produit_id,[]);mvParProduit.get(mv.produit_id).push(mv);}
    const vmap=new Map();for(const v of ventes){const c=String(v.code_barres||'').trim();vmap.set(c,(vmap.get(c)||0)+Math.max(0,num(v.quantite)));}
    const jours=per.data?nbJours(per.data.periode_debut,per.data.periode_fin):0;
    const cible=Math.max(.1,num(regle.couverture_cible_jours)||1.5);
    const urgenceConfig=Number(regle.couverture_urgente_jours);
    const urgent=Number.isFinite(urgenceConfig)&&urgenceConfig>=0?Math.min(urgenceConfig,cible):Math.min(.5,cible/3);

    function stockApresTransferts(produitId,zoneId,releve){
      if(!releve)return null;
      let q=num(releve.quantite_base);const at=new Date(releve.releve_le).getTime();
      for(const mv of mvParProduit.get(produitId)||[]){if(new Date(mv.cree_le).getTime()<=at)continue;const d=num(mv.quantite);if(mv.zone_source_id===zoneId)q-=d;if(mv.zone_destination_id===zoneId)q+=d;}
      return Math.max(0,q);
    }

    const lignes=produits.map(p=>{
      const code=String(p.code_barres||'').trim(),vj=jours?((vmap.get(code)||0)/jours):0,l=ml.get(p.id),c=mc.get(p.id),sr=ms.get(p.id);
      let stock=null,stockLe=null,stockNature=null;
      if(l){stock=stockApresTransferts(p.id,dest.id,l);stockLe=l.releve_le;stockNature='localise';}
      else if(c){stock=c.quantite_boutique!=null?num(c.quantite_boutique):num(c.quantite);stockLe=c.compte_le;stockNature='comptage';}
      const sourceQ=src&&sr?stockApresTransferts(p.id,src.id,sr):null;
      const frais=stock!=null&&ageH(stockLe)<=AGE_MAX_HEURES;
      const couverture=frais&&vj>0?stock/vj:null;
      const facteur=Math.max(1,num(p.facteur_conditionnement)||1);
      const manque=frais&&vj>0?Math.max(0,vj*cible-stock):0;
      const cartouches=manque>0?Math.ceil(manque/facteur):0;
      const sourceCart=sourceQ==null?null:Math.floor(sourceQ/facteur);
      const peutServir=cartouches>0&&sourceCart!=null?Math.min(cartouches,sourceCart):0;
      return {p,vj,stock,stockLe,stockNature,frais,couverture,facteur,cartouches,sourceQ,sourceCart,peutServir,besoin:cartouches>0,urgent:cartouches>0&&couverture!=null&&couverture<=urgent};
    });
    return {produits,regle,cible,urgent,lignes,periode:per.data,src,dest};
  }

  function css(){if(document.getElementById('nirc3Style'))return;const s=document.createElement('style');s.id='nirc3Style';s.textContent=`
    @keyframes nirc3Pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(240,87,90,.65)}50%{opacity:.22;box-shadow:0 0 0 8px rgba(240,87,90,0)}}
    .nirc3{grid-column:1/-1;margin-bottom:14px;padding:13px;border:1px solid rgba(79,195,217,.22);border-radius:13px;background:#141B22}.nirc3.compact{padding:10px 13px}.nirc3h{display:flex;align-items:center;gap:9px}.nirc3t{font-size:13px;font-weight:700}.nirc3s{font-size:10.5px;color:#8A96A5;margin-top:2px}.nirc3sp{flex:1}.nirc3badge{font:700 9px var(--mono);padding:4px 7px;border:1px solid rgba(79,195,217,.25);border-radius:999px;color:#4FC3D9;white-space:nowrap}.nirc3dot{width:11px;height:11px;border-radius:50%;background:#F0575A;animation:nirc3Pulse .9s infinite}.nirc3urgent{font:700 9px var(--mono);color:#F0575A}.nirc3sum{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.nirc3chip{font-size:10px;color:#8A96A5;background:#1A222C;border-radius:7px;padding:5px 7px}.nirc3chip.red{color:#ff8b8e;background:rgba(240,87,90,.08)}.nirc3chip.amber{color:#f5bd5b;background:rgba(245,166,35,.08)}.nirc3list{display:flex;flex-direction:column;gap:5px;margin-top:9px}.nirc3row{display:grid;grid-template-columns:1fr auto;gap:8px;padding:8px 9px;border:1px solid #242E38;border-radius:9px;background:#10171d}.nirc3row.u{border-color:rgba(240,87,90,.4);background:rgba(240,87,90,.04)}.nirc3name{font-size:11.5px;font-weight:650}.nirc3meta{font-size:9.8px;color:#8A96A5;margin-top:3px;line-height:1.45}.nirc3side{text-align:right}.nirc3q{font:700 11px var(--mono);color:#34D399}.nirc3q.u{color:#ff777a}.nirc3btn{display:inline-block;margin-top:5px;border:1px solid rgba(79,195,217,.28);background:rgba(79,195,217,.07);color:#bdeff8;border-radius:7px;padding:5px 7px;font:600 9.5px var(--mono);text-decoration:none}.nirc3btn.disabled{pointer-events:none;opacity:.45;border-color:#2a3540;color:#718096;background:transparent}.nirc3foot{display:flex;gap:12px;align-items:center;margin-top:9px}.nirc3a{font:600 10px var(--mono);color:#4FC3D9;text-decoration:none}.nirc3toggle{margin-left:auto;border:0;background:transparent;color:#718096;font-size:10px;cursor:pointer}@media(max-width:620px){.nirc3row{grid-template-columns:1fr}.nirc3side{text-align:left}}
  `;document.head.appendChild(s);}

  function deepLink(x,ctx){
    if(!(x.peutServir>0)||!ctx.src||!ctx.dest)return null;
    const u=new URL('NEXUS-Stock-Localise-v1.html',location.href);
    u.searchParams.set('reassort_produit',x.p.id);u.searchParams.set('reassort_source',ctx.src.id);u.searchParams.set('reassort_destination',ctx.dest.id);u.searchParams.set('reassort_cartouches',String(x.peutServir));u.searchParams.set('reassort_facteur',String(x.facteur));
    return u.pathname.split('/').pop()+u.search;
  }
  function row(x,ctx){
    const cov=x.couverture==null?'—':x.couverture.toFixed(1)+' j',stock=x.stock==null?'—':Math.round(x.stock)+' pqt',src=x.sourceCart==null?'bureau à relever':x.sourceCart+' cart. bureau';
    const href=deepLink(x,ctx),insuff=x.sourceCart!=null&&x.sourceCart<x.cartouches;
    return `<div class="nirc3row ${x.urgent?'u':''}"><div><div class="nirc3name">${esc(x.p.designation)}</div><div class="nirc3meta">Boutique ${stock} · couverture ${cov} · ${src}${insuff?' · réserve insuffisante pour couvrir toute la cible':''}</div></div><div class="nirc3side"><div class="nirc3q ${x.urgent?'u':''}">Besoin ${x.cartouches} cartouche${x.cartouches>1?'s':''}</div>${href?`<a class="nirc3btn" href="${href}">Préparer ${x.peutServir} cart. →</a>`:'<span class="nirc3btn disabled">Relever le bureau</span>'}</div></div>`;
  }
  function allRows(lines,ctx){return lines.map(x=>x.besoin?row(x,ctx):`<div class="nirc3row"><div><div class="nirc3name">${esc(x.p.designation)}</div><div class="nirc3meta">${!x.frais?'Stock à actualiser':x.vj<=0?'Rotation non calculable':'Couverture suffisante'+(x.couverture!=null?' · '+x.couverture.toFixed(1)+' j':'')}</div></div><div class="nirc3q" style="color:#718096">—</div></div>`).join('');}
  function markup(ctx){
    if(!ctx||!ctx.regle)return `<div class="nirc3 compact"><div class="nirc3h"><div>🚬</div><div><div class="nirc3t">Réassort cigarettes</div><div class="nirc3s">Couverture boutique non configurée.</div></div><div class="nirc3sp"></div><a class="nirc3a" href="NEXUS-Parametres-Inventaire-v1.html">Configurer →</a></div></div>`;
    const l=ctx.lignes||[],bes=l.filter(x=>x.besoin),urg=bes.filter(x=>x.urgent),stale=l.filter(x=>!x.frais);
    if(!bes.length)return `<div class="nirc3 compact"><div class="nirc3h"><div>🚬</div><div><div class="nirc3t">Réassort cigarettes</div><div class="nirc3s">${stale.length?stale.length+' référence(s) à actualiser avant conclusion.':'Aucun besoin de réassort détecté.'}</div></div><div class="nirc3sp"></div><span class="nirc3badge">Cible ${ctx.cible.toFixed(1)} j</span></div><div class="nirc3foot"><a class="nirc3a" href="NEXUS-Stock-Localise-v1.html">Stock par emplacement →</a><button class="nirc3toggle" data-nirc3-toggle>Voir les ${l.length} références</button></div><div class="nirc3list" data-nirc3-all style="display:none">${allRows(l,ctx)}</div></div>`;
    return `<div class="nirc3"><div class="nirc3h"><div>🚬</div><div><div class="nirc3t">Besoins de réassort cigarettes</div><div class="nirc3s">Toutes les cigarettes actives sont analysées. Les transferts déjà enregistrés sont intégrés.</div></div><div class="nirc3sp"></div>${urg.length?'<span class="nirc3dot"></span><span class="nirc3urgent">URGENT</span>':''}<span class="nirc3badge">Cible ${ctx.cible.toFixed(1)} j</span></div><div class="nirc3sum"><span class="nirc3chip">${l.length} suivies</span><span class="nirc3chip ${urg.length?'red':''}">${urg.length} urgentes</span><span class="nirc3chip">${bes.length} à réassortir</span>${stale.length?`<span class="nirc3chip amber">${stale.length} à actualiser</span>`:''}</div><div class="nirc3list">${bes.sort((a,b)=>(Number(b.urgent)-Number(a.urgent))||((a.couverture??999)-(b.couverture??999))).map(x=>row(x,ctx)).join('')}</div><div class="nirc3foot"><a class="nirc3a" href="NEXUS-Stock-Localise-v1.html">Stock par emplacement →</a><a class="nirc3a" href="NEXUS-Parametres-Inventaire-v1.html">Régler la couverture →</a><button class="nirc3toggle" data-nirc3-toggle>Voir toutes les cigarettes</button></div><div class="nirc3list" data-nirc3-all style="display:none">${allRows(l,ctx)}</div></div>`;
  }
  async function render(){if(rendering||document.getElementById('nexusManagerReassortCigarettesV3'))return;rendering=true;try{const content=document.getElementById('content');if(!content)return;document.getElementById('nexusManagerReassortCigarettesV2')?.remove();const ctx=await analyser();const w=document.createElement('div');w.id='nexusManagerReassortCigarettesV3';w.style.gridColumn='1/-1';w.innerHTML=markup(ctx);content.insertBefore(w,content.firstChild);w.querySelectorAll('[data-nirc3-toggle]').forEach(b=>b.onclick=()=>{const l=w.querySelector('[data-nirc3-all]');const on=l.style.display!=='none';l.style.display=on?'none':'flex';b.textContent=on?'Voir toutes les cigarettes':'Réduire';});}catch(e){console.error('NEXUS Réassort cigarettes manager V3:',e);}finally{rendering=false;}}
  async function init(){employee=await nexusRequireAuth();if(!employee||!['manager','gerant'].includes(employee.role))return;site=employee.site_id;css();setTimeout(render,250);setInterval(()=>{if(!document.getElementById('nexusManagerReassortCigarettesV3'))render();},3000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();