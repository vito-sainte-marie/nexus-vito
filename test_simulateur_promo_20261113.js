// Simulateur de promotion : moteur pur, sans écriture, sans git.
const assert=require('assert'); const fs=require('fs'); const path=require('path');
require('./nexus-simulateur-promo.js');
const S=globalThis.NexusSimulateurPromo;
const lire=f=>fs.readFileSync(path.join(__dirname,f),'utf8');
let echecs=0;
function t(nom,fn){try{fn();console.log('  ok  '+nom);}catch(e){echecs++;console.log('  ECHEC '+nom+'\n     '+e.message);}}
const proche=(a,b,tol)=>assert(Math.abs(a-b)<=Math.abs(b)*(tol||0.01)+1e-9,a+' vs '+b);

const floup={ventesMoisPrecedent:903,achatAvant:0.498,achatPendant:0.498,venteAvant:0.93,ventePendant:0.72,jours:30};

t('cas Floup : marges, ratio, seuils',()=>{
  const r=S.calculerCompensation(floup);
  proche(r.margeAvant,0.432); proche(r.margePendant,0.222);
  proche(r.ratio,1.95);
  assert(!r.impossible);
  proche(r.ventesEquilibre,1760,0.01); proche(r.ventesRenouveler,1940,0.01);
  proche(r.hausseEquilibrePct,95,0.02); proche(r.hausseRenouvelerPct,114.5,0.02);
  assert.deepStrictEqual(r.hypotheses.map(h=>h.cle),['habituel','hausse-25','hausse-50','hausse-100','equilibre','renouveler']);
  const eq=r.hypotheses.find(h=>h.cle==='equilibre'); assert(Math.abs(eq.ecart)<1e-6,'écart nul à l’équilibre');
  const hab=r.hypotheses[0]; assert(hab.ecart<0);
});
t('marge pendant la promotion nulle puis négative : impossible',()=>{
  [0.498,0.4].forEach(v=>{
    const r=S.calculerCompensation(Object.assign({},floup,{ventePendant:v}));
    assert(r.impossible); assert.strictEqual(r.ventesEquilibre,null); assert.strictEqual(r.ventesRenouveler,null);
    assert(!r.hypotheses.some(h=>h.cle==='equilibre'));
  });
});
t('durée de 18 jours : volumes proportionnels',()=>{
  const a=S.calculerCompensation(floup), b=S.calculerCompensation(Object.assign({},floup,{jours:18}));
  proche(b.ventesEquilibre,a.ventesEquilibre*18/30,1e-9);
  proche(b.volumeHabituel,903*18/30,1e-9);
  assert.strictEqual(b.ratio,a.ratio);
});
t('somme de deux produits en euros',()=>{
  const a=S.calculerCompensation(floup), b=S.calculerCompensation(Object.assign({},floup,{ventesMoisPrecedent:300,venteAvant:1.5,ventePendant:1.2}));
  const s=S.sommer([a,b]);
  proche(s.margeHabituelle,a.volumeHabituel*a.margeAvant+b.volumeHabituel*b.margeAvant,1e-9);
  const h=s.hypotheses.find(x=>x.cle==='hausse-50');
  proche(h.margeTotale,a.hypotheses[2].margeTotale+b.hypotheses[2].margeTotale,1e-9);
  proche(h.ecart,a.hypotheses[2].ecart+b.hypotheses[2].ecart,1e-9);
  assert(!('ratio' in s)&&!('pourcentage' in s));
});
t('prix net : 0,54 € remise 10 %, sans octroi de mer',()=>{ proche(S.prixNet(0.54,10),0.486,1e-9); proche(S.prixNet(0.54,10,2.5),0.486,1e-9); });
t('lancement : exemple du cahier',()=>{
  const r=S.calculerLancement({achat:1,venteNormale:1.6,ventePromo:1.3},[200]);
  proche(r.lignes[0].cout,60,1e-9); proche(r.lignes[0].margePromo,60,1e-9); proche(r.margeNormale,0.6,1e-9);
  const m=r.lignes[0].mensuel.map(x=>x.ventes);
  proche(m[0],100,1e-9); proche(m[1],50,1e-9); proche(m[2],33.3333,1e-4); assert.strictEqual(Math.round(m[2]),33);
  assert.strictEqual(S.DELAI_RECUPERATION_LANCEMENT_MOIS,3); assert.strictEqual(r.lignes[0].mensuel.length,3);
});
t('lancement : vente à perte et coût irrécupérable',()=>{
  const p=S.calculerLancement({achat:1,venteNormale:1.6,ventePromo:0.9},[100]); assert(p.venteAPerte); assert(p.lignes[0].margePromo<0);
  const i=S.calculerLancement({achat:1.7,venteNormale:1.6,ventePromo:1.3},[100]); assert(i.irrecuperable);
  i.lignes[0].mensuel.forEach(x=>assert.strictEqual(x.ventes,null));
});

// Jeu Floup : cinq périodes juillet à novembre
function lig(d,f,q,prix,cout){return {article:'FLOUP',categorie:'X',periode_debut:d,periode_fin:f,quantite:q,ca:q*prix,marge:q*(prix-cout)};}
const rows=[lig('2026-07-01','2026-07-31',1320,0.63,0.53),lig('2026-08-01','2026-08-23',900,0.79,0.53),lig('2026-08-24','2026-09-18',800,0.86,0.53),
  lig('2026-09-19','2026-10-04',482,0.93,0.53),lig('2026-10-05','2026-11-09',1500,0.79,0.53),
  {article:'AUTRE',periode_debut:'2026-10-05',periode_fin:'2026-11-09',quantite:10,ca:10,marge:1}];
t('Floup : référence 0,93 €, quatre périodes réduites, une seule retenue',()=>{
  const a=S.analyserPeriodes(rows,'FLOUP','2026-11-13');
  proche(a.prixReference,0.93,1e-9);
  assert.strictEqual(a.reduites.length,4);
  assert.strictEqual(a.periodeReference.debut,'2026-09-19'); assert.strictEqual(a.periodeReference.fin,'2026-10-04');
  assert(a.prixBasRecent);
  const sg=S.suggestions(rows,'FLOUP','2026-11-13');
  proche(sg.venteAvant,0.93,1e-9); proche(sg.achatAvant,0.53,1e-9); proche(sg.ventesMoisPrecedent,482/16*30,1e-9);
  assert.deepStrictEqual(sg.source,{debut:'2026-09-19',fin:'2026-10-04'});
  const juillet=a.reduites.find(p=>p.debut==='2026-07-01'); proche(juillet.parJour,1320/31,1e-9); assert.strictEqual(Math.round(juillet.parJour*10)/10,42.6);
});
t('référence : le plus haut prix, pas la médiane',()=>{
  const r=[lig('2026-05-01','2026-05-30',100,1.00,0.5),lig('2026-06-01','2026-06-30',100,0.80,0.5),lig('2026-07-01','2026-07-30',100,0.80,0.5),lig('2026-08-01','2026-08-30',100,0.80,0.5)];
  proche(S.analyserPeriodes(r,'FLOUP','2026-11-13').prixReference,1.0,1e-9);
});
t('seuil 3 % : 2,9 % sous = retenue, 3,0 % = écartée',()=>{
  assert.strictEqual(S.SEUIL_PRIX_REDUIT,0.03);
  const r=[lig('2026-08-01','2026-08-30',100,1.00,0.5),lig('2026-09-01','2026-09-30',100,0.971,0.5),lig('2026-10-01','2026-10-30',100,0.97,0.5)];
  const a=S.analyserPeriodes(r,'FLOUP','2026-11-13');
  assert(!a.periodes.find(p=>p.debut==='2026-09-01').reduite,'2,9 % : retenue');
  assert(a.periodes.find(p=>p.debut==='2026-10-01').reduite,'3,0 % : écartée');
});
t('périodes de plus de 12 mois ignorées',()=>{
  const r=[lig('2025-01-01','2025-01-31',100,2,1),lig('2026-10-01','2026-10-30',100,1,0.5)];
  proche(S.analyserPeriodes(r,'FLOUP','2026-11-13').prixReference,1,1e-9);
});
t('article inconnu : aucune suggestion',()=>{ assert.strictEqual(S.suggestions(rows,'ZZZ','2026-11-13'),null); });

t('aucune écriture ni git dans le moteur et la page',()=>{
  const moteur=lire('nexus-simulateur-promo.js'), page=lire('NEXUS-Campagne-v2.html');
  const sansMesure=src=>src.replace(/nexusClient\s*\.from\('(campagne_mesures_produits|campagne_couts|fournisseurs_conditions)'\)\s*\.(insert|upsert|delete)\(/g,'');
  [moteur,page].forEach(src=>{
    assert(!/\.(insert|upsert|update|delete)\s*\(/.test(sansMesure(src).replace(/nexusClient\s*\.from\('campagnes_nexus'\)\s*\.insert\(/,'').replace(/nexusClient\s*\.from\('campagnes_nexus'\)\s*\.update\(/,'') /* modification d'une campagne existante (lot Consulter/Modifier) : seul update autorisé, sur campagnes_nexus */),'écriture');
    assert(!/from\('(products|campagnes_nexus_imports)'\)\s*\.(insert|upsert|update|delete)/.test(src));
    assert(!/child_process|execSync|spawn/.test(src));
  });
  assert(!/nexusClient|fetch\(|XMLHttpRequest/.test(moteur));
});
const page = fs.readFileSync(path.join(__dirname,'NEXUS-Campagne-v2.html'),'utf8');
t('page : bandeau permanent, moteur chargé, pas d’écriture sur products ni imports', ()=>{
  assert(/nexus-simulateur-promo\.js/.test(page));
  assert(/id="simBanniere"/.test(page) && /SV\.banniere/.test(page));
  const sansV2 = page.replace(/from\('campagnes_nexus'\)\s*\.(insert|update)/g,'');
  assert(!/from\('(products|campagnes_nexus_imports)'\)\s*\.(insert|update|upsert|delete)/.test(sansV2));
  const zone = page.slice(page.indexOf('Simulateur de promotion (aucune'));
  assert(!/\.(insert|update|upsert|delete)\(/.test(zone.replace(/nexusClient\s*\.from\('(campagne_mesures_produits|campagne_couts|fournisseurs_conditions)'\)\s*\.(insert|upsert|delete)\(/g,'')));
});
t('page : noms d’article échappés, aucune saisie injectée brute', ()=>{
  const zone = page.slice(page.indexOf('Simulateur de promotion (aucune'));
  assert(/esc\(e\.article\)/.test(zone) && /esc\(a\)/.test(zone) && /esc\(b\.dataset|data-article="' \+ esc\(a\)/.test(zone));
  assert(!/innerHTML\s*=\s*[^;]*e\.article(?!\))/.test(zone.replace(/esc\(e\.article\)/g,'')));
});
t('page : tableau sans débordement (layout fixe, retour à la ligne)', ()=>{
  assert(/\.sim-table\{[^}]*table-layout:fixed/.test(page));
  assert(/\.sim-table th, \.sim-table td\{[^}]*overflow-wrap:anywhere/.test(page));
  assert(/\.sim-grille input[^{]*\{[^}]*min-width:0/.test(page));
});

t("retouches Guardian : avertissement daté, ventes arrondies, dates homogènes", ()=>{
  const V = lire("nexus-vocabulaire.js");
  assert(V.includes("a un prix moyen bas : promotion possible. La référence est prise sur le"));
  assert(page.includes("Math.round(s.ventesMoisPrecedent)"));
  assert(!page.includes("toLocaleDateString('fr-FR', {month"));
});
process.exit(echecs?1:0);
