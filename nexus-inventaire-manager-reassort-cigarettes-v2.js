// NEXUS Inventaire Manager — Réassort cigarettes boutique V2
(function(){
  'use strict';
  if(!NexusPage.est('NEXUS-Inventaire-Manager-v1.html')) return;
  const AGE_MAX_HEURES=36;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const num=v=>Number(v)||0;
  let employee=null,site=null,rendering=false;
  function ageH(d){return d?(Date.now()-new Date(d).getTime())/36e5:Infinity;}
  function nbJours(a,b){if(!a||!b)return 0;return Math.max(1,Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000)+1);}

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
    const produits=pr.data||[], regle=rr.data;
    if(!regle||regle.mode_calcul!=='couverture_jours')return {produits,regle:null};
    const zones=zr.data||[], dest=zones.find(z=>z.id===regle.zone_destination_id)||zones.find(z=>z.code==='boutique'), src=zones.find(z=>z.id===regle.zone_source_id)||zones.find(z=>z.code==='bureau');
    if(!dest)return {produits,regle,erreur:'destination'};
    const ids=produits.map(p=>p.id),codes=[...new Set(produits.map(p=>String(p.code_barres||'').trim()).filter(Boolean))];
    let ventes=[],locaux=[],comptages=[],sources=[];
    if(per.data&&codes.length){const r=await nexusClient.from('products').select('code_barres,quantite').eq('site',site).eq('periode_fin',per.data.periode_fin).in('code_barres',codes);if(r.error)throw r.error;ventes=r.data||[];}
    if(ids.length){
      const reqs=[
        nexusClient.from('inventaire_stock_localise_releves').select('produit_id,quantite_base,releve_le').eq('site',site).eq('zone_id',dest.id).in('produit_id',ids).order('releve_le',{ascending:false}),
        nexusClient.from('inventaire_comptages').select('produit_id,quantite,quantite_boutique,compte_le').eq('site',site).in('produit_id',ids).eq('statut','valide').eq('source','manuel').order('compte_le',{ascending:false})
      ];
      if(src)reqs.push(nexusClient.from('inventaire_stock_localise_releves').select('produit_id,quantite_base,releve_le').eq('site',site).eq('zone_id',src.id).in('produit_id',ids).order('releve_le',{ascending:false}));
      const rs=await Promise.all(reqs);for(const r of rs)if(r.error)throw r.error;locaux=rs[0].data||[];comptages=rs[1].data||[];sources=rs[2]?.data||[];
    }
    const mapFirst=(rows,key='produit_id')=>{const m=new Map();for(const r of rows)if(!m.has(r[key]))m.set(r[key],r);return m;};
    const ml=mapFirst(locaux),mc=mapFirst(comptages),ms=mapFirst(sources);
    const vmap=new Map();for(const v of ventes){const c=String(v.code_barres||'').trim();vmap.set(c,(vmap.get(c)||0)+Math.max(0,num(v.quantite)));}
    const jours=per.data?nbJours(per.data.periode_debut,per.data.periode_fin):0;
    const cible=Math.max(.1,num(regle.couverture_cible_jours)||1.5),urgent=Math.max(0,num(regle.couverture_urgente_jours)||(cible/3));
    const lignes=produits.map(p=>{
      const code=String(p.code_barres||'').trim(),vj=jours?((vmap.get(code)||0)/jours):0, l=ml.get(p.id),c=mc.get(p.id);
      let stock=null,stockLe=null;if(l){stock=num(l.quantite_base);stockLe=l.releve_le;}else if(c){stock=c.quantite_boutique!=null?num(c.quantite_boutique):num(c.quantite);stockLe=c.compte_le;}
      const frais=stock!=null&&ageH(stockLe)<=AGE_MAX_HEURES, couverture=frais&&vj>0?stock/vj:null, facteur=Math.max(1,num(p.facteur_conditionnement)||1), manque=frais&&vj>0?Math.max(0,vj*cible-stock):0,cartouches=manque>0?Math.ceil(manque/facteur):0;
      const sr=ms.get(p.id),sourceCart=sr?Math.floor(num(sr.quantite_base)/facteur):null;
      return {p,vj,stock,stockLe,frais,couverture,facteur,cartouches,sourceCart,besoin:cartouches>0,urgent:cartouches>0&&couverture!=null&&couverture<=urgent};
    });
    return {produits,regle,cible,urgent,lignes,periode:per.data};
  }

  function css(){if(document.getElementById('nirc2Style'))return;const s=document.createElement('style');s.id='nirc2Style';s.textContent=`@keyframes nircPulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(240,87,90,.65)}50%{opacity:.2;box-shadow:0 0 0 8px rgba(240,87,90,0)}}.nirc2{grid-column:1/-1;margin-bottom:14px;padding:13px;border:1px solid rgba(79,195,217,.22);border-radius:13px;background:#141B22}.nirc2.compact{padding:10px 13px}.nirc2h{display:flex;align-items:center;gap:9px}.nirc2t{font-size:13px;font-weight:700}.nirc2s{font-size:10.5px;color:#8A96A5;margin-top:2px}.nirc2sp{flex:1}.nirc2badge{font:700 9px var(--mono);padding:4px 7px;border:1px solid rgba(79,195,217,.25);border-radius:999px;color:#4FC3D9;white-space:nowrap}.nirc2dot{width:11px;height:11px;border-radius:50%;background:#F0575A;animation:nircPulse .9s infinite}.nirc2urgent{font:700 9px var(--mono);color:#F0575A}.nirc2sum{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.nirc2chip{font-size:10px;color:#8A96A5;background:#1A222C;border-radius:7px;padding:5px 7px}.nirc2chip.red{color:#ff8b8e;background:rgba(240,87,90,.08)}.nirc2chip.amber{color:#f5bd5b;background:rgba(245,166,35,.08)}.nirc2list{display:flex;flex-direction:column;gap:5px;margin-top:9px}.nirc2row{display:grid;grid-template-columns:1fr auto;gap:8px;padding:8px 9px;border:1px solid #242E38;border-radius:9px;background:#10171d}.nirc2row.u{border-color:rgba(240,87,90,.4);background:rgba(240,87,90,.04)}.nirc2name{font-size:11.5px;font-weight:650}.nirc2meta{font-size:9.8px;color:#8A96A5;margin-top:3px}.nirc2q{font:700 11px var(--mono);color:#34D399}.nirc2q.u{color:#ff777a}.nirc2foot{display:flex;gap:12px;align-items:center;margin-top:9px}.nirc2a{font:600 10px var(--mono);color:#4FC3D9;text-decoration:none}.nirc2toggle{margin-left:auto;border:0;background:transparent;color:#718096;font-size:10px;cursor:pointer}@media(max-width:620px){.nirc2row{grid-template-columns:1fr}}`;document.head.appendChild(s);}
  function row(x){const cov=x.couverture==null?'—':x.couverture.toFixed(1)+' j',stock=x.stock==null?'—':Math.round(x.stock)+' pqt',src=x.sourceCart==null?'bureau à relever':x.sourceCart+' cart. bureau';return `<div class="nirc2row ${x.urgent?'u':''}"><div><div class="nirc2name">${esc(x.p.designation)}</div><div class="nirc2meta">Boutique ${stock} · couverture ${cov} · ${src}</div></div><div class="nirc2q ${x.urgent?'u':''}">${x.cartouches} cartouche${x.cartouches>1?'s':''}</div></div>`;}
  function allRows(lines){return lines.map(x=>x.besoin?row(x):`<div class="nirc2row"><div><div class="nirc2name">${esc(x.p.designation)}</div><div class="nirc2meta">${!x.frais?'Stock à actualiser':x.vj<=0?'Rotation non calculable':'Couverture suffisante'+(x.couverture!=null?' · '+x.couverture.toFixed(1)+' j':'')}</div></div><div class="nirc2q" style="color:#718096">—</div></div>`).join('');}
  function markup(ctx){
    if(!ctx||!ctx.regle)return `<div class="nirc2 compact"><div class="nirc2h"><div>🚬</div><div><div class="nirc2t">Réassort cigarettes</div><div class="nirc2s">Couverture boutique non configurée.</div></div><div class="nirc2sp"></div><a class="nirc2a" href="NEXUS-Parametres-Inventaire-v1.html">Configurer →</a></div></div>`;
    const l=ctx.lignes||[],bes=l.filter(x=>x.besoin),urg=bes.filter(x=>x.urgent),stale=l.filter(x=>!x.frais);
    if(!bes.length)return `<div class="nirc2 compact"><div class="nirc2h"><div>🚬</div><div><div class="nirc2t">Réassort cigarettes</div><div class="nirc2s">${stale.length?stale.length+' référence(s) à actualiser avant conclusion.':'Aucun besoin de réassort détecté.'}</div></div><div class="nirc2sp"></div><span class="nirc2badge">Cible ${ctx.cible.toFixed(1)} j</span></div><div class="nirc2foot"><a class="nirc2a" href="NEXUS-Stock-Localise-v1.html">Stock par emplacement →</a><button class="nirc2toggle" data-nirc-toggle>Voir les ${l.length} références</button></div><div class="nirc2list" data-nirc-all style="display:none">${allRows(l)}</div></div>`;
    return `<div class="nirc2"><div class="nirc2h"><div>🚬</div><div><div class="nirc2t">Besoins de réassort cigarettes</div><div class="nirc2s">Toutes les cigarettes actives sont analysées, indépendamment de la feuille/missions du quart.</div></div><div class="nirc2sp"></div>${urg.length?'<span class="nirc2dot"></span><span class="nirc2urgent">URGENT</span>':''}<span class="nirc2badge">Cible ${ctx.cible.toFixed(1)} j</span></div><div class="nirc2sum"><span class="nirc2chip">${l.length} suivies</span><span class="nirc2chip ${urg.length?'red':''}">${urg.length} urgentes</span><span class="nirc2chip">${bes.length} à réassortir</span>${stale.length?`<span class="nirc2chip amber">${stale.length} à actualiser</span>`:''}</div><div class="nirc2list">${bes.sort((a,b)=>(Number(b.urgent)-Number(a.urgent))||((a.couverture??999)-(b.couverture??999))).map(row).join('')}</div><div class="nirc2foot"><a class="nirc2a" href="NEXUS-Stock-Localise-v1.html">Préparer les transferts →</a><a class="nirc2a" href="NEXUS-Parametres-Inventaire-v1.html">Régler la couverture →</a><button class="nirc2toggle" data-nirc-toggle>Voir toutes les cigarettes</button></div><div class="nirc2list" data-nirc-all style="display:none">${allRows(l)}</div></div>`;
  }
  async function render(){if(rendering||document.getElementById('nexusManagerReassortCigarettesV2'))return;rendering=true;try{const content=document.getElementById('content');if(!content)return;const ctx=await analyser();const w=document.createElement('div');w.id='nexusManagerReassortCigarettesV2';w.style.gridColumn='1/-1';w.innerHTML=markup(ctx);content.insertBefore(w,content.firstChild);w.querySelectorAll('[data-nirc-toggle]').forEach(b=>b.onclick=()=>{const l=w.querySelector('[data-nirc-all]');const on=l.style.display!=='none';l.style.display=on?'none':'flex';b.textContent=on?'Voir toutes les cigarettes':'Réduire';});}catch(e){console.error('NEXUS Réassort cigarettes manager V2:',e);}finally{rendering=false;}}
  async function init(){employee=await nexusRequireAuth();if(!employee||!['manager','gerant'].includes(employee.role))return;site=employee.site_id;css();setTimeout(render,250);setInterval(()=>{if(!document.getElementById('nexusManagerReassortCigarettesV2'))render();},3000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();