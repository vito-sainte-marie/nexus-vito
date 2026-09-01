// NEXUS Carburants — cohérence post point-zéro + finition visuelle (01/09/2026)
(function (global) {
  'use strict';
  if ((location.pathname.split('/').pop() || '').toLowerCase() !== 'nexus-carburants-pilotage-v1.html') return;

  var cacheP0 = {}, cacheReception = {}, observer = null, siteCache = null;
  function frDate(iso){var p=String(iso||'').slice(0,10).split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:iso;}
  function fmtL(v){return v==null||!Number.isFinite(Number(v))?'—':Math.round(Number(v)).toLocaleString('fr-FR')+' L';}
  function aujourdhuiLocal(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function clientNexus(){try{return typeof nexusClient!=='undefined'?nexusClient:(global.nexusClient||null);}catch(e){return global.nexusClient||null;}}

  async function siteCourant(){
    if(siteCache)return siteCache;var client=clientNexus();if(!client)return null;
    var s=await client.auth.getSession(),uid=s&&s.data&&s.data.session&&s.data.session.user?s.data.session.user.id:null;if(!uid)return null;
    var q=await client.from('employees').select('site_id,est_createur').eq('id',uid).maybeSingle();if(q.error||!q.data)return null;
    var site=q.data.site_id;
    if(q.data.est_createur){var consulte=localStorage.getItem('nexus_site_consulte_createur');if(consulte)site=consulte;}
    siteCache=site;return site;
  }

  async function chargerP0(client,site,dateISO){
    var k=site+':'+dateISO;if(cacheP0[k])return cacheP0[k];
    var q=await client.from('carburant_stock_references').select('id,date,type,statut,source,created_at')
      .eq('site',site).eq('type','initialisation').lte('date',dateISO)
      .order('date',{ascending:false}).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(q.error||!q.data)return null;
    var ql=await client.from('carburant_stock_reference_lignes').select('carburant,stock_reel,stock_theorique_avant').eq('reference_id',q.data.id);
    if(ql.error)return null;var lignes={};(ql.data||[]).forEach(function(l){lignes[l.carburant]=l;});
    return cacheP0[k]={reference:q.data,lignes:lignes};
  }

  function correspondAuP0(p0,cle,ev){var l=p0&&p0.lignes[cle];return !!(l&&ev&&ev.jaugeageOuvertureL!=null&&Math.abs(Number(l.stock_reel)-Number(ev.jaugeageOuvertureL))<=1);}
  function neutraliserAncienneAnomalie(resultat,p0){
    var MC=global.NexusCarburantCommandeMoteur;
    if(!MC||!resultat||!p0||p0.reference.date!==resultat.dateISO||!resultat.parCarburant)return resultat;
    Object.keys(resultat.parCarburant).forEach(function(cle){
      var ev=resultat.parCarburant[cle],d=ev&&ev.detailConfiance,causes=d&&Array.isArray(d.causes)?d.causes.slice():[];
      if(!correspondAuP0(p0,cle,ev)||!causes.includes('anomalie_majeure'))return;
      // Toute réception documentaire du jour est un fait postérieur potentiel :
      // elle conserve sa propre réserve de fiabilité et n'est jamais effacée.
      if(Number(ev.livraisonDocumentaireAujourdhuiL||0)>0||ev.livraisonDocumentaireAmbigue)return;
      causes=causes.filter(function(c){return c!=='anomalie_majeure';});
      if(d&&d.facteurs)d.facteurs.aucune_anomalie_majeure=true;
      ev.ecartPhysiqueTheoriqueL=0;
      if(d){d.causes=causes;if(!causes.length){d.niveau='fiable';d.raison='Référence certifiée active — aucun écart courant non résolu.';ev.confiance='fiable';}}
    });
    var inclus=resultat.commandeRecommandee&&resultat.commandeRecommandee.volumes?Object.keys(resultat.commandeRecommandee.volumes):null;
    resultat.causesAConfirmer=MC.resumerCausesConfirmationCommande(resultat.parCarburant,inclus);
    resultat.etatConfirmationCommande=MC.etatConfirmationCommande({commandeRecommandee:resultat.commandeRecommandee,causesAConfirmer:resultat.causesAConfirmer});
    resultat.referenceCertifieeCommande=p0.reference;return resultat;
  }

  function installerCommande(){
    // Doit rester la couche la plus externe : on attend que les correctifs P0
    // (réceptions/BL/journal) soient eux-mêmes installés avant d'envelopper
    // l'évaluation finale, sinon un wrapper chargé après nous pourrait
    // réintroduire l'ancienne anomalie.
    var CMD=global.NexusCarburantCommandeDonnees;
    if(!global.NexusCarburantsP0UI||!global.NexusCarburantsP0UI.actif||!CMD||!CMD.evaluerCommandeCarburantSite||CMD.__p0CoherenceUI)return false;
    var original=CMD.evaluerCommandeCarburantSite;
    CMD.evaluerCommandeCarburantSite=async function(client,site,options){var r=await original.apply(this,arguments);if(!r||r.ok===false||!r.dateISO)return r;try{return neutraliserAncienneAnomalie(r,await chargerP0(client,site,r.dateISO));}catch(e){console.error('Carburants cohérence post-P0:',e);return r;}};
    CMD.__p0CoherenceUI=true;return true;
  }

  async function chargerReception(client,site){
    if(cacheReception[site])return cacheReception[site];
    var qv=await client.from('carburant_reception_visites').select('id,date_visite,heure_fin,statut,numero_bl').eq('site',site).neq('statut','en_cours').order('date_visite',{ascending:false}).order('heure_fin',{ascending:false}).limit(1).maybeSingle();
    if(qv.error||!qv.data)return null;
    var ql=await client.from('carburant_reception_visite_lignes').select('quantite_bl_l,quantite_mesuree_l,statut').eq('visite_id',qv.data.id);if(ql.error)return null;
    var bl=0,mes=0,rap=false;(ql.data||[]).forEach(function(l){bl+=Number(l.quantite_bl_l)||0;mes+=Number(l.quantite_mesuree_l)||0;if(l.statut==='a_rapprocher')rap=true;});
    return cacheReception[site]={visite:qv.data,totalBl:bl,totalMesure:mes,aRapprocher:rap};
  }

  function injecterCSS(){if(document.getElementById('nexus-carburants-polish-css'))return;var s=document.createElement('style');s.id='nexus-carburants-polish-css';s.textContent=`
    .section-note,.commande-pourquoi,.commande-objectif,.commande-fiche-detail,.ventes-desc,.pointzero-texte,.historique-pz-note,.livraison-carte,.commande-plan-body{font-family:var(--sans)!important;letter-spacing:0!important;line-height:1.52!important}
    .section-note{font-size:11.5px!important;line-height:1.55!important}.commande-pourquoi{font-size:12.5px!important}.commande-reco-principale{font-family:var(--sans)!important;font-weight:700;letter-spacing:-.01em;line-height:1.35}.commande-carte-titre,.section-titre{font-family:var(--sans)!important;letter-spacing:-.01em!important}.commande-plan-head{font-family:var(--sans)!important;font-weight:600;letter-spacing:0!important}.commande-plan-body b,.commande-plan-body strong,.commande-carte-badge,.badge-regime,.historique-pz-statut,.livraison-statut{font-family:var(--mono)!important}.historique-pz-source{font-family:var(--sans)!important;font-weight:600!important;letter-spacing:.01em!important;text-transform:none!important}
    .nexus-p0-reception-note{margin-top:7px;padding:8px 10px;border-radius:9px;background:rgba(245,166,35,.08);border:1px solid rgba(245,166,35,.22);font-family:var(--sans);font-size:11px;line-height:1.5;color:var(--text-mid)}.nexus-p0-reception-note b{color:var(--text);font-family:var(--mono);font-weight:600}@media(max-width:430px){.commande-carte-tete{align-items:flex-start!important;gap:10px!important}.commande-carte-badge{font-size:9.5px!important;line-height:1.35;white-space:normal!important;text-align:center}.commande-reco-principale{font-size:15px!important}}
  `;document.head.appendChild(s);}

  function remplacer(root,re,txt){if(!root)return;var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),n;while((n=w.nextNode())){re.lastIndex=0;if(n.nodeValue&&re.test(n.nodeValue)){re.lastIndex=0;n.nodeValue=n.nodeValue.replace(re,txt);}}}
  function corrigerSituations(){document.querySelectorAll('.carb-carte').forEach(function(c){var t=c.textContent||'';if(/Situation stock\s*:\s*Non évaluable/i.test(t)&&(/\bGO\b/.test(t)||/\bSP95\b/.test(t))&&/Autonomie[\s\S]*?\d+[\.,]?\d*\s*j/i.test(t)&&/Écart[\s\S]*?[+−-]?0\s*L/i.test(t))remplacer(c,/Situation stock\s*:\s*Non évaluable/gi,'Situation stock : Référence certifiée');});}

  async function corrigerP0EtReception(){
    var client=clientNexus(),site=await siteCourant();if(!site||!client)return;var auj=aujourdhuiLocal(),p0=await chargerP0(client,site,auj);
    if(p0&&p0.reference.date===auj){document.querySelectorAll('.section-note').forEach(function(el){if(/Écart calculé depuis le dernier relevé du/i.test(el.textContent||''))el.textContent=(el.textContent||'').replace(/Écart calculé depuis le dernier relevé du [0-9/]+\./i,'Écart courant calculé depuis la référence certifiée du '+frDate(p0.reference.date)+'.');});var src=document.querySelector('.historique-pz-source');if(src){var card=src.closest('[class*="historique-pz"],.card')||src.parentElement;if(card&&/1\s*sept/i.test(card.textContent||'')){src.textContent='Ouvrir le relevé source ↗';src.title='Référence certifiée du '+frDate(p0.reference.date);}}}
    var r=await chargerReception(client,site);if(!r||!r.totalBl)return;var sous=document.getElementById('livraisonSousTitre'),stat=r.aRapprocher?' · à rapprocher':'';if(sous)sous.textContent='BL '+fmtL(r.totalBl)+(r.totalMesure?' · jauge +'+fmtL(r.totalMesure):'')+stat+' — '+frDate(r.visite.date_visite);
    var carte=document.querySelector('#livraisonZone .livraison-carte');if(carte&&!carte.querySelector('.nexus-p0-reception-note')){var note=document.createElement('div');note.className='nexus-p0-reception-note';note.innerHTML='Quantité documentaire BL : <b>'+fmtL(r.totalBl)+'</b>'+(r.totalMesure?' · Variation physique mesurée par jauge : <b>+'+fmtL(r.totalMesure)+'</b>':'')+(r.aRapprocher?' · <span style="color:var(--amber);font-weight:600">Rapprochement à confirmer</span>':'');carte.insertBefore(note,carte.firstChild.nextSibling);var total=carte.querySelector('.livraison-total');if(total){var sp=total.querySelectorAll('span');if(sp[0])sp[0].textContent='Total BL documentaire';if(sp[1])sp[1].textContent=fmtL(r.totalBl);}}
  }

  function corrigerUI(){remplacer(document.body,/marge après livraison/gi,'marge avant livraison');corrigerSituations();corrigerP0EtReception();}
  function installerUI(){injecterCSS();corrigerUI();if(!observer){var raf=null;observer=new MutationObserver(function(){if(raf)return;raf=requestAnimationFrame(function(){raf=null;corrigerUI();});});observer.observe(document.body,{childList:true,subtree:true});}}
  function installer(){var ok=installerCommande();installerUI();if(ok){global.NexusCarburantsP0CoherenceUI={actif:true,version:'20260901-0650'};console.info('NEXUS Carburants — cohérence P0 + finition UI installées.');}return ok;}
  if(!installer()){var n=0,t=setInterval(function(){n++;if(installer()||n>750)clearInterval(t);},20);}
})(typeof window!=='undefined'?window:globalThis);
