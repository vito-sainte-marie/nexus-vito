// NEXUS Carburants — Démarrage du nouveau mois
// Complément de pilotage : lorsqu'une commande passée aujourd'hui sera livrée
// le mois suivant, NEXUS doit regarder AU-DELÀ de la livraison de transition
// et proposer le premier camion du nouveau mois, même si aucun carburant
// n'est encore sous son seuil de sécurité immédiat.
//
// Règle de capacité volontairement conservatrice : le volume proposé doit
// pouvoir entrer avec le jaugeage physique d'ouverture + toutes les livraisons
// déjà engagées avant/à la prochaine livraison, SANS supposer qu'un seul litre
// sera vendu entre-temps. Ainsi une prévision de ventes ne peut jamais créer
// artificiellement de la place en cuve.
(function(){
  'use strict';
  if((location.pathname.split('/').pop()||'')!=='NEXUS-Carburants-Pilotage-v1.html') return;

  const PAS=1000;
  const NOM={sp95:'SP95',go:'GO',gnr:'GNR'};
  let employee=null,site=null,done=false;
  const fmt=v=>Math.round(Number(v)||0).toLocaleString('fr-FR')+' L';
  const dateFr=iso=>{
    if(!iso)return '—';
    const d=new Date(iso+'T12:00:00');
    return d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  };

  async function commandesEngagees(dateDebut,dateFin){
    const {data,error}=await nexusClient.from('carburant_commandes')
      .select('id,carburants,livraison_prevue_le,statut,volume_total_l')
      .eq('site',site)
      .in('statut',['validee','modifiee','confirmee_fournisseur','hors_nexus'])
      .gte('livraison_prevue_le',dateDebut)
      .lte('livraison_prevue_le',dateFin)
      .order('livraison_prevue_le',{ascending:true});
    if(error) throw error;
    return data||[];
  }

  function volumesEngagesParCarburant(commandes){
    const out={};
    for(const cmd of commandes||[]){
      for(const [c,l] of Object.entries(cmd.carburants||{})){
        const v=Number(l&&l.volumeL);
        if(Number.isFinite(v)&&v>0) out[c]=(out[c]||0)+v;
      }
    }
    return out;
  }

  function construireSuggestion(ctx,engages,joursFeriesISO){
    const M=window.NexusCarburantCommandeMoteur;
    if(!ctx||ctx.ok===false||!ctx.config||!M) return null;
    const fenetre=M.calculerFenetreLivraison({
      dateCommandeISO:ctx.dateISO,
      heureCommandeHHMM:ctx.heureMaintenantHHMM,
      config:ctx.config,
      joursFeriesISO:joursFeriesISO||[]
    });
    const livraison=fenetre&&fenetre.livraisonISO;
    if(!livraison || livraison.slice(0,7)===ctx.dateISO.slice(0,7)) return null;

    const maximum=Number(ctx.config.maximum_camion_litres)||36000;
    const minimum=Number(ctx.config.minimum_camion_litres)||3000;
    const deja=volumesEngagesParCarburant(engages);
    const candidats=[];

    for(const [c,ev] of Object.entries(ctx.parCarburant||{})){
      // Un carburant sans rotation exploitable ne doit pas servir à remplir
      // artificiellement le camion (cas GNR sans prévision fiable).
      if(!(Number(ev.consommationMoyenneJour)>0)) continue;
      if(ev.jaugeageOuvertureL==null || ev.limiteRemplissageL==null) continue;
      const stockConservateur=Number(ev.jaugeageOuvertureL)+(deja[c]||0);
      const place=Math.max(0,Number(ev.limiteRemplissageL)-stockConservateur);
      const placeArrondie=Math.floor(place/PAS)*PAS;
      if(placeArrondie<PAS) continue;
      candidats.push({c,ev,stockConservateur,place:placeArrondie});
    }
    if(!candidats.length) return null;

    // Même philosophie que le moteur principal : priorité à la rotation la
    // plus forte, puis complément sur les autres carburants jusqu'au camion.
    candidats.sort((a,b)=>(Number(b.ev.consommationMoyenneJour)||0)-(Number(a.ev.consommationMoyenneJour)||0));
    let reste=maximum;
    const volumes={};
    for(const x of candidats){
      if(reste<PAS) break;
      const v=Math.min(x.place,Math.floor(reste/PAS)*PAS);
      if(v>=PAS){volumes[x.c]=v;reste-=v;}
    }
    const total=Object.values(volumes).reduce((s,v)=>s+v,0);
    if(total<minimum) return null;
    return {dateISO:ctx.dateISO,livraison,maximum,total,volumes,candidats,engages,deja,complet:total>=maximum};
  }

  function styles(){
    if(document.getElementById('ncdmStyle'))return;
    const s=document.createElement('style');s.id='ncdmStyle';s.textContent=`
      .ncdm{margin:0 20px 14px;padding:14px 16px;border:1px solid rgba(79,195,217,.34);border-radius:14px;background:linear-gradient(135deg,rgba(79,195,217,.08),rgba(20,27,34,.98));box-shadow:0 10px 30px rgba(0,0,0,.16)}
      .ncdm-head{display:flex;align-items:flex-start;gap:10px}.ncdm-icon{font-size:18px}.ncdm-title{font-size:13px;font-weight:700}.ncdm-sub{font-size:10.5px;color:var(--text-mid);margin-top:3px;line-height:1.45}.ncdm-badge{margin-left:auto;font:700 9px var(--mono);padding:5px 8px;border-radius:999px;color:#bff7ff;background:rgba(79,195,217,.10);border:1px solid rgba(79,195,217,.28);white-space:nowrap}
      .ncdm-total{font:700 24px var(--mono);margin-top:13px}.ncdm-total span{font-size:11px;color:var(--text-mid);font-weight:500}.ncdm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-top:10px}.ncdm-fuel{padding:10px 11px;border:1px solid var(--hairline);border-radius:10px;background:rgba(10,15,20,.55)}.ncdm-fuel b{display:block;font:700 16px var(--mono);margin-top:3px}.ncdm-fuel small{font-size:9.5px;color:var(--text-dim)}
      .ncdm-note{margin-top:10px;padding-top:9px;border-top:1px solid rgba(148,163,184,.13);font-size:10px;color:var(--text-dim);line-height:1.5}.ncdm-ok{color:var(--green)}
      @media(max-width:620px){.ncdm{margin-left:20px;margin-right:20px}.ncdm-head{flex-wrap:wrap}.ncdm-badge{margin-left:28px}}
    `;document.head.appendChild(s);
  }

  function trouverAncre(){
    // Cherche le bloc visuel "Prochaine commande" sans dépendre d'un nom de
    // classe historique précis. Si la structure évolue, repli sous Lecture NEXUS.
    const els=[...document.querySelectorAll('div,section,article')];
    const titre=els.find(el=>/Prochaine commande/i.test((el.textContent||'').trim()) && el.children.length<12);
    if(titre){
      const bloc=titre.closest('.commande-card,.accordion-card,[class*="commande"],section,article');
      if(bloc&&bloc.parentNode)return {parent:bloc.parentNode,before:bloc};
    }
    const lecture=[...document.querySelectorAll('div,section')].find(el=>/LECTURE NEXUS/i.test((el.textContent||'').trim())&&el.children.length<10);
    if(lecture){const bloc=lecture.closest('section,article,div');if(bloc&&bloc.parentNode)return {parent:bloc.parentNode,before:bloc.nextSibling};}
    const root=document.querySelector('.phone')||document.body;
    return {parent:root,before:null};
  }

  function render(sug){
    if(!sug||document.getElementById('nexusDemarrageMois'))return;
    styles();
    const card=document.createElement('div');card.id='nexusDemarrageMois';card.className='ncdm';
    const commandesDuJour=(sug.engages||[]).filter(c=>c.livraison_prevue_le===sug.dateISO);
    const livraisonJour=commandesDuJour.reduce((s,c)=>s+(Number(c.volume_total_l)||Object.values(c.carburants||{}).reduce((a,l)=>a+(Number(l&&l.volumeL)||0),0)),0);
    const fuels=Object.entries(sug.volumes).map(([c,v])=>`<div class="ncdm-fuel"><small>${NOM[c]||c.toUpperCase()}</small><b>${fmt(v)}</b><small>volume conseillé</small></div>`).join('');
    card.innerHTML=`<div class="ncdm-head"><div class="ncdm-icon">🚚</div><div><div class="ncdm-title">Démarrage du nouveau mois</div><div class="ncdm-sub">NEXUS regarde après la livraison de transition et prépare déjà le premier camion du mois suivant.</div></div><span class="ncdm-badge">${dateFr(sug.livraison)}</span></div>
      <div class="ncdm-total">${fmt(sug.total)} <span>${sug.complet?'· camion complet':'· capacité disponible'}</span></div>
      <div class="ncdm-grid">${fuels}</div>
      <div class="ncdm-note">${livraisonJour>0?`Livraison déjà engagée aujourd'hui intégrée : <b>${fmt(livraisonJour)}</b>. `:''}Capacité calculée de façon conservatrice sur le jaugeage du matin + les livraisons déjà engagées. <b>Aucune vente future n'est utilisée pour créer artificiellement de la place dans les cuves.</b></div>`;
    const a=trouverAncre();a.parent.insertBefore(card,a.before||null);
  }

  async function run(){
    if(done)return;
    if(!window.NexusCarburantCommandeDonnees||!window.NexusCarburantCommandeMoteur)return;
    done=true;
    try{
      const D=window.NexusCarburantCommandeDonnees;
      const ctx=await D.evaluerCommandeCarburantSite(nexusClient,site);
      if(!ctx||ctx.ok===false)return;
      const joursFeriesISO=D.chargerJoursFeries?await D.chargerJoursFeries(nexusClient,site):[];
      const M=window.NexusCarburantCommandeMoteur;
      const fen=M.calculerFenetreLivraison({dateCommandeISO:ctx.dateISO,heureCommandeHHMM:ctx.heureMaintenantHHMM,config:ctx.config,joursFeriesISO});
      if(!fen||!fen.livraisonISO||fen.livraisonISO.slice(0,7)===ctx.dateISO.slice(0,7))return;
      const engages=await commandesEngagees(ctx.dateISO,fen.livraisonISO);
      const sug=construireSuggestion(ctx,engages,joursFeriesISO);
      render(sug);
    }catch(e){done=false;console.error('NEXUS démarrage nouveau mois:',e);}
  }

  async function init(){employee=await nexusRequireAuth();if(!employee||!['manager','gerant'].includes(employee.role))return;site=employee.site_id;for(let i=0;i<30;i++){await run();if(done)break;await new Promise(r=>setTimeout(r,250));}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
