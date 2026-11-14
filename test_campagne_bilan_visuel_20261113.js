// Campagne NEXUS V2 : bilan visuel (moteur G5, fenêtres de 28 jours, page, lexique).
const assert=require('assert'); const fs=require('fs'); const path=require('path'); const crypto=require('crypto');
global.window={}; require('./nexus-vocabulaire.js'); require('./nexus-mesure-compensation.js'); require('./nexus-campagnes.js');
const V=window.NexusVocab, NC=globalThis.NexusCampagnes||window.NexusCampagnes; const MC=globalThis.NexusMesureCompensation||window.NexusMesureCompensation;
const lire=f=>fs.readFileSync(path.join(__dirname,f),'utf8');
let echecs=0; function t(nom,fn){try{fn();console.log('  ok   '+nom)}catch(e){echecs++;console.log('  FAIL '+nom+'\n       '+e.message)}}
const page=lire('NEXUS-Campagne-v2.html'); const B=V.campagne.bilan;
const debut=page.indexOf('function ico('), fin=page.indexOf('async function chargerMesures');
const code=page.slice(debut,fin);

const jour=(i,v)=>{const d=new Date(Date.UTC(2026,0,1+i));return {date:d.toISOString().slice(0,10),venteBoutique:v,ventePiste:0,quarts:[{quart:1},{quart:2}]}};
const serie=(n,dep,f)=>Array.from({length:n},(_,k)=>jour(dep+k,f(k)));

t('seuil G5 épinglé sur la source de Tempo',()=>{
  const m=lire('nexus-tempo.js').match(/const SEUIL_ECART_TYPES\s*=\s*(\d+(?:\.\d+)?)/);
  assert(m,'seuil absent de nexus-tempo.js'); assert.strictEqual(NC.SEUIL_ECART_TYPES,Number(m[1]));
});
t('G5 aux bornes : juste sous 2 erreurs-types = variation habituelle, au-dessus = nette',()=>{
  const R=[10,12,10,12,10,12,10,12], E=[10,12,10,12,10,12,10,12];
  const base=NC.comparerG5(R,E); assert.strictEqual(base.label,'variation_habituelle');
  const se=base.erreurType; assert(se>0);
  const decale=d=>E.map(v=>v+d);
  assert.strictEqual(NC.comparerG5(R,decale(1.99*se)).label,'variation_habituelle');
  assert.strictEqual(NC.comparerG5(R,decale(2.01*se)).label,'hausse_nette');
  assert.strictEqual(NC.comparerG5(R,decale(-2.01*se)).label,'baisse_nette');
  assert.strictEqual(NC.comparerG5(R,decale(-1.99*se)).label,'variation_habituelle');
});
t('G5 : pas assez de jours = non mesurable',()=>{
  const peu=Array.from({length:NC.MIN_JOURS_BILAN-1},(_,k)=>k);
  assert.strictEqual(NC.comparerG5(peu,[3,4,5,6,7,8,9]).label,'non_mesurable');
  assert.strictEqual(NC.comparerG5([3,4,5,6,7,8,9],peu).label,'non_mesurable');
  assert.strictEqual(NC.comparerG5([],[]).label,'non_mesurable');
});
t('fenêtres : avant = 28 jours complets au plus, après = 28 au plus',()=>{
  const lignes=serie(120,0,()=>100); const camp={id:'c',nom:'X',type:'boutique',date_debut:lignes[50].date,date_fin:lignes[55].date};
  const f=NC.fenetresBilan(camp,lignes);
  assert.strictEqual(f.avant.length,28); assert.strictEqual(f.pendant.length,6); assert.strictEqual(f.apres.length,28);
  assert(f.avant[27].date<camp.date_debut&&f.apres[0].date>camp.date_fin);
  const court={...camp,date_debut:lignes[10].date,date_fin:lignes[12].date};
  const g=NC.fenetresBilan(court,lignes); assert.strictEqual(g.avant.length,10);
  const b=NC.analyserBilanCampagne(court,lignes,[]); assert.strictEqual(b.nbJoursAvant,10); assert.strictEqual(b.nbJoursPendant,3);
});
t('analyse : un écart net sur CA ressort net, un bruit reste dans la variation habituelle',()=>{
  const bruit=k=>100+(k%2?3:-3);
  const net=serie(60,0,k=>k<30?bruit(k):200+(k%2?3:-3));
  const camp={id:'c',nom:'X',type:'boutique',date_debut:net[30].date,date_fin:net[40].date};
  assert.strictEqual(NC.analyserBilanCampagne(camp,net,[]).ca.pendant.label,'hausse_nette');
  const plat=serie(60,0,bruit);
  assert.strictEqual(NC.analyserBilanCampagne(camp,plat,[]).ca.pendant.label,'variation_habituelle');
});
t('état de rentabilité pris du moteur de mesure, jamais recalculé dans la page',()=>{
  assert(/MC\.mesurerCampagne\(/.test(code),'la page n’appelle pas mesurerCampagne');
  assert(/\.etat\b/.test(code));
  const r=MC.mesurerCampagne([],[]); assert(r&&'etat' in r);
  assert(V.campagne.etats.some(e=>e.cle==='non-mesurable'));
  assert(!/gainApresCouts\s*[<>]=?\s*0|marge\s*\/\s*(ca|vente)/i.test(code),'état recalculé dans la page');
});
t('aucun chiffre en dur : ni dans le lexique du bilan, ni dans le code du bilan',()=>{
  const lex=JSON.stringify(Object.keys(B).map(k=>typeof B[k]==='function'?'':B[k]));
  assert(!/\d/.test(lex),'chiffre dans le lexique du bilan');
  const sansNombres=code.replace(/\b(28|44|100|0|1|2|3)\b/g,'').replace(/\d+(\.\d+)?(px|%|em|rem)/g,'');
  for(const nom of ['Boissons fraîches','Pause gourmande']) assert(!page.includes(nom)&&!JSON.stringify(B).includes(nom),nom);
  assert(!/\b\d{2,}(?:[.,]\d+)?\s*(€|%)/.test(code),'montant ou pourcentage en dur dans le code du bilan');
  assert(sansNombres.length>0);
});
t('étiquettes G5 et phrases de conclusion dans le lexique, pas dans la page',()=>{
  assert.deepStrictEqual(Object.keys(B.g5),['hausse_nette','baisse_nette','variation_habituelle','non_mesurable']);
  assert.strictEqual(typeof B.conclusion,'function');
  for(const frag of ['Reste à vérifier','sans sortir de la variation habituelle','ont augmenté']) assert(!page.includes(frag),frag+' dans la page');
  assert(/V\.bilan\.conclusion|bilan\.conclusion/.test(page));
});
t('conclusion : hausse nette, bruit, non mesurable',()=>{
  const g=(label,sens)=>({label,sens});
  const a=B.conclusion('P',g('hausse_nette','hausse'),g('hausse_nette','hausse'),g('baisse_nette','baisse'));
  assert(/ont augmenté, malgré un panier moyen légèrement inférieur/.test(a)&&/compensé les remises/.test(a));
  const b=B.conclusion('P',g('variation_habituelle','hausse'),g('variation_habituelle','hausse'),null);
  assert(/sans sortir de la variation habituelle/.test(b)&&!/hausse nette/.test(b));
  assert(/pas assez de jours/.test(B.conclusion('P',g('non_mesurable',null),g('non_mesurable',null),null)));
  for(const s of [a,b]) assert(!s.includes('—'));
});
t('aucune couleur de statut sans écart net',()=>{
  assert(/\.b-g5\.hausse\{color:var\(--t-green\)\}/.test(page.replace(/\s+/g,' ').replace(/; ?\}/g,'}').replace(/\{ /g,'{')));
  const f=code.slice(code.indexOf('function g5Classe'),code.indexOf('function g5Classe')+200);
  assert(/hausse_nette/.test(f)&&/baisse_nette/.test(f)&&/: ?''/.test(f),'g5Classe doit rendre vide hors écart net');
  const barres=page.match(/\.b-barre[^{]*\{[^}]*\}/g).join('');
  assert(!/--t-(green|red|amber)/.test(barres),'couleur de statut sur les barres');
  assert(/--boutique/.test(barres));
});
t('page : une colonne sous 768 px, cibles de 44 px, thème Jour hérité',()=>{
  assert(/\.b-grille\{[^}]*grid-template-columns:1fr;/.test(page)||/\.b-grille\{[^}]*grid-template-columns: ?1fr/.test(page));
  assert(/@media \(min-width:768px\)\{\s*\.b-grille/.test(page));
  assert(/\.b-carte\{[^}]*min-height:44px/.test(page));
  assert(/\.btn\{[^}]*min-height:44px/.test(page));
  const css=page.slice(page.indexOf('.bilan'),page.indexOf('.intro-historique'));
  assert(!/#[0-9a-fA-F]{3,6}\b|rgb\(/.test(css.replace(/rgba\(var\(--boutique-rgb\)/g,'')),'couleur en dur dans le CSS du bilan');
  assert(/data-theme="jour"/.test(page));
});
t('aucune écriture depuis le code du bilan',()=>{
  const bilan=page.slice(page.indexOf('function tuileBilan'),page.indexOf('async function chargerMesures'));
  assert(!/\.(insert|update|upsert|delete|rpc)\(/.test(bilan),'écriture dans le bilan');
  const charg=page.slice(page.indexOf('async function chargerMesures'),page.indexOf('async function chargerMesures')+900);
  assert(!/\.(insert|update|upsert|delete|rpc)\(/.test(charg)&&/\.select\(/.test(charg));
});
t('accès à la mesure de compensation depuis le bilan, sans git ni lecture de dépôt',()=>{
  assert(B.mesurerLien==='Mesurer la compensation'); assert(/ouvrirMesure\(/.test(code)); assert(/mesurerLien/.test(code));
  const moi=lire('test_campagne_bilan_visuel_20261113.js'); assert(!/require\('child_process'\)/.test(moi),'le test lit git');
});
t('icônes : 8 nouveaux visuels × 3 tailles, srcset 48/96/144, alt vide si décoratif',()=>{
  const cles=['a-retenir','ca-boutique','comparatif-periodes','conseiller','frequentation','marge-commerciale','objectif-commercial','panier-moyen'];
  for(const c of cles) for(const s of [48,96,144]){
    const f='assets/icones/campagne/premium/campagne-'+c+'-'+s+'.webp';
    assert(fs.existsSync(path.join(__dirname,f)),f+' absent');
    assert.strictEqual(fs.readFileSync(path.join(__dirname,f)).slice(0,4).toString(),'RIFF',f+' n’est pas un WebP');
  }
  const ico=code.slice(code.indexOf('function ico('),code.indexOf('function ico(')+700);
  assert(/srcset/.test(ico)&&/48/.test(ico)&&/96/.test(ico)&&/144/.test(ico)&&/alt=""/.test(ico));
});

t('jour incomplet : écarté de la comparaison et listé',()=>{
  const court={id:'c',date_debut:'2026-01-11',date_fin:'2026-01-13',type:'boutique'};
  const l=serie(14,0,()=>100); l[2]={...l[2],quarts:[{quart:1}]};
  const r=NC.analyserBilanCampagne(court,l,[]);
  assert.strictEqual(r.nbJoursAvant,9);
  assert(r.joursEcartes.some(j=>j.date===l[2].date&&j.periode==='avant'));
});
t('estJourComplet exige les quarts 1 et 2',()=>{
  assert(NC.estJourComplet({quarts:[{quart:1},{quart:2}]}));
  assert(!NC.estJourComplet({quarts:[{quart:2}]})); assert(!NC.estJourComplet({}));
});
t('libellés par type et accord de la conclusion',()=>{
  ['boutique','carburant','mixte'].forEach(k=>{const T=B.types[k]; assert(T.tuile&&T.graphTitre&&T.ventes)});
  assert(B.types.carburant.tuile.includes('Piste'));
  assert(B.rentaPhrase('encourageante','+100 €')); assert.strictEqual(B.rentaPhrase('non_mesurable',''),''); assert(B.rentaPhrase('insuffisante','').includes('insuffisante'));
});
t('aucun tiret cadratin dans le lexique du bilan',()=>{ assert(!JSON.stringify(B,(k,v)=>typeof v==='function'?v.toString():v).includes('\u2014')); });
t('page : fréquentation sur la fenêtre panier, objectif masqué si vide',()=>{
  assert(code.includes('b.nbJoursAvantPanier')); assert(code.includes('objectifSpan(i) ?'));
});
t('retouches : tickets par jour en entier, dernière promotion alignée sur le bilan ouvert',()=>{
  assert(!page.includes("B.ticketsParJour.replace"));
  assert(page.includes("x.campagneId === BILAN_COURANT"));
});
t('Conseiller : « Promotion analysée », jamais « Dernière promotion »',()=>{
  const f=V.campagne.conseillerDerniere||V.conseillerDerniere; const r=f('X','01/07','10/07');
  assert(r.startsWith('Promotion analysée : « X »')); assert(!r.includes('Dernière'));
});
console.log(echecs?'\n'+echecs+' échec(s)':'\ntout est vert'); process.exit(echecs?1:0);
