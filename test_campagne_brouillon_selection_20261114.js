const assert=require('assert'); const fs=require('fs');
global.window={}; require('./nexus-vocabulaire.js');
const V=window.NexusVocab.campagne;
const page=fs.readFileSync(__dirname+'/NEXUS-Campagne-v2.html','utf8');
let echecs=0; function t(nom,fn){ try{fn();console.log('ok   '+nom);}catch(e){echecs++;console.log('FAIL '+nom+' : '+e.message);} }
const a=page.indexOf('const BROUILLON_DUREE_MS'), b=page.indexOf('function stockage()');
assert(a>0&&b>a,'bloc pur introuvable');
const L=new Function(page.slice(a,b)+'; return {BROUILLON_DUREE_MS,brouillonCle,brouillonVide,brouillonLire,brouillonEcrire,brouillonEffacer,brouillonQuestion,listeSuggestions};')();
const faux=()=>{const m={};return {m,getItem:k=>k in m?m[k]:null,setItem:(k,v)=>{m[k]=String(v)},removeItem:k=>{delete m[k]}};};
const cle=L.brouillonCle('s1','e1'), H=3600*1000, T0=1e12;
const plein={nom:'Été',dateDebut:'2026-11-20',dateFin:'',type:'prix',nature:null,objectif:null,objectifLibre:'',produits:['Café']};
const vide={nom:'',dateDebut:'',dateFin:'',type:null,nature:null,objectif:null,objectifLibre:'',produits:[]};
t('clé par site et employé',()=>assert.strictEqual(cle,'nexus_campagne_brouillon_s1_e1'));
t('brouillon écrit avec horodatage',()=>{const s=faux();assert(L.brouillonEcrire(s,cle,plein,T0));assert.strictEqual(JSON.parse(s.m[cle]).t,T0);assert.strictEqual(JSON.parse(s.m[cle]).produits[0],'Café');});
t('formulaire vide : aucun brouillon',()=>{const s=faux();assert.strictEqual(L.brouillonEcrire(s,cle,vide,T0),false);assert(!(cle in s.m));});
t('formulaire vidé efface le brouillon',()=>{const s=faux();L.brouillonEcrire(s,cle,plein,T0);L.brouillonEcrire(s,cle,vide,T0);assert(!(cle in s.m));});
t('23 h 59 : repris',()=>{const s=faux();L.brouillonEcrire(s,cle,plein,T0);assert(L.brouillonLire(s,cle,T0+24*H-60000));});
t('24 h 01 : ignoré et supprimé',()=>{const s=faux();L.brouillonEcrire(s,cle,plein,T0);assert.strictEqual(L.brouillonLire(s,cle,T0+24*H+60000),null);assert(!(cle in s.m));});
t('effacement après enregistrement',()=>{const s=faux();L.brouillonEcrire(s,cle,plein,T0);L.brouillonEffacer(s,cle);assert(!(cle in s.m));});
t('échec d\'insertion : le brouillon reste (effacerBrouillon après le test d\'erreur)',()=>{
  const i=page.indexOf('if (error){ console.error(\'campagnes_nexus insert\'');const j=page.indexOf('effacerBrouillon();',i);assert(i>0&&j>i);});
t('stockage indisponible : aucune erreur',()=>{
  const mort={getItem(){throw new Error('x')},setItem(){throw new Error('x')},removeItem(){throw new Error('x')}};
  assert.strictEqual(L.brouillonLire(mort,cle,T0),null);assert.strictEqual(L.brouillonEcrire(mort,cle,plein,T0),false);L.brouillonEffacer(mort,cle);});
t('JSON corrompu : ignoré',()=>{const s=faux();s.m[cle]='{';assert.strictEqual(L.brouillonLire(s,cle,T0),null);});
t('question avec et sans nom',()=>{
  const d=new Date(2026,10,14,9,5).getTime();
  assert.strictEqual(L.brouillonQuestion({t:d,nom:'Été'},V),'Une saisie non enregistrée du 14/11 à 09 h 05 existe (« Été »). Voulez-vous la reprendre ?');
  assert(!/«/.test(L.brouillonQuestion({t:d,nom:''},V)));});
t('page : question en page, sans confirm()',()=>{assert(!/confirm\(/.test(page.slice(page.indexOf('function toggleForm'),page.indexOf('function reprendreSaisie'))));assert(/brouillonReprise/.test(page));});
t('page : annuler ne supprime pas, vierge supprime',()=>{
  const r=page.slice(page.indexOf('function reinitialiserForm'),page.indexOf('function choisirPill'));assert(!/effacerBrouillon/.test(r));
  const n=page.slice(page.indexOf('function nouvelleSaisieVierge'),page.indexOf('function reinitialiserForm'));assert(/effacerBrouillon/.test(n));});
t('page : le blur ne ferme plus la liste',()=>assert(!/addEventListener\('blur'/.test(page)));
const cat=['Café noir','Café crème','Thé','Décaféiné','Cafetière','Eau','Cacao'];
t('suggestions : début d\'abord, puis contient, tous',()=>{
  const r=L.listeSuggestions(cat,'caf',new Set());assert.deepStrictEqual(r,['Café noir','Café crème','Cafetière','Décaféiné']);});
t('suggestions : plus de 6 résultats, aucun coupé',()=>{
  const g=Array.from({length:23},(_,i)=>'Boisson '+i);assert.strictEqual(L.listeSuggestions(g,'boi',new Set()).length,23);});
t('suggestions : exclut les déjà ajoutés, sans doublon',()=>{
  const r=L.listeSuggestions(cat,'caf',new Set(['café noir']));assert(!r.includes('Café noir'));assert.strictEqual(new Set(r).size,r.length);});
t('suggestions : saisie vide = rien',()=>assert.deepStrictEqual(L.listeSuggestions(cat,'  ',new Set()),[]));
t('page : bouton sélection inactif sans coche, total au-delà de 6, volet défilant',()=>{
  assert(/b\.disabled = !nbSelection\(\)/.test(page));assert(/liste\.length > 6/.test(page));
  assert(/\.sugg-liste\{[^}]*overflow-y:auto/.test(page));assert(/\.sugg-ligne\{[^}]*height:44px/.test(page));
  assert(/#btnAjouterSel|id="btnAjouterSel"/.test(page));});
t('page : les coches survivent à la frappe (Map hors rendu)',()=>{
  assert(/let selectionSugg = \{\}/.test(page));assert(/selectionSugg\[a\.toLowerCase\(\)\] \? ' checked'/.test(page));});
t('page : la sélection ajoutée entre dans le brouillon',()=>{
  const f=page.slice(page.indexOf('function ajouterSelection'),page.indexOf('function majBoutonSelection'));assert(/sauverBrouillon\(\)/.test(f));});
t('page : Entrée sans coche garde le comportement actuel',()=>{
  assert(/if \(nbSelection\(\)\)\{ ajouterSelection\(\); return; \}[\s\S]{0,300}ajouterUnProduit\(c \? c\.dataset\.nom : \$\('promoProduitInput'\)\.value\)/.test(page));});
t('lexique : textes présents',()=>{['suggAjouterSelection','suggTotal','brouillonQuestion','brouillonReprendre','brouillonVierge'].forEach(k=>assert(V[k]));assert.strictEqual(V.brouillonReprendre,'Reprendre la saisie');assert.strictEqual(V.brouillonVierge,'Nouvelle saisie vierge');});
console.log(echecs?'\n'+echecs+' échec(s)':'\ntout est vert'); process.exit(echecs?1:0);
