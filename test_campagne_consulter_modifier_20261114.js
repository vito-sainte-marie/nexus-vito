const assert=require('assert'); const fs=require('fs');
global.window={}; require('./nexus-vocabulaire.js');
const V=window.NexusVocab.campagne;
const page=fs.readFileSync(__dirname+'/NEXUS-Campagne-v2.html','utf8');
const mig=fs.readFileSync(__dirname+'/supabase/migrations/20261114100000_campagnes_nexus_modification.sql','utf8');
let echecs=0; function t(nom,fn){ try{fn();console.log('ok   '+nom);}catch(e){echecs++;console.log('FAIL '+nom+' : '+e.message);} }
const norm=s=>s.replace(/\s+/g,' ').trim();
const fn=(deb,fin)=>{const a=page.indexOf(deb),b=page.indexOf(fin,a+1);assert(a>0&&b>a,'bloc introuvable : '+deb);return page.slice(a,b);};

t('migration : colonnes modifie_par et modifie_le, nullables',()=>{
  assert(/add column if not exists modifie_par uuid references public\.employees\(id\)/i.test(mig));
  assert(/add column if not exists modifie_le timestamptz(?!\s+not null)/i.test(mig));});
t('migration : la politique UPDATE porte la même condition que l\'INSERT (using et with check)',()=>{
  const m=norm(mig);
  const cond="((select current_employee_role()) = any (array['manager'::text, 'gerant'::text])) and (site = (select current_employee_site_id()))";
  assert(/create policy modification_manager_meme_site on public\.campagnes_nexus for update/i.test(m));
  assert.strictEqual(m.split(cond).length-1,2,'using + with check');
  // l'INSERT existant porte la même condition de rôle et de site
  const tous=fs.readdirSync(__dirname+'/supabase/migrations').filter(f=>f!=='20261114100000_campagnes_nexus_modification.sql').map(f=>norm(fs.readFileSync(__dirname+'/supabase/migrations/'+f,'utf8')));
  const ins=tous.find(x=>/create policy \S+ on (public\.)?campagnes_nexus for insert/i.test(x));
  assert(ins,'politique INSERT introuvable'); const w=ins.match(/campagnes_nexus for insert[^;]*;/i)[0];
  assert(/current_employee_role\(\)/.test(w)&&/manager/.test(w)&&/gerant/.test(w)&&/current_employee_site_id\(\)/.test(w));});
t('migration : aucune politique DELETE',()=>assert(!/for delete/i.test(mig)&&!/for all/i.test(mig)));
t('page : la modification fait un update filtré par id, jamais un insert',()=>{
  const m=fn('if (MODIF_ID){','const { error } = await nexusClient.from(\'campagnes_nexus\').insert');
  assert(/\.from\('campagnes_nexus'\)\.update\(/.test(m));assert(/\.eq\('id', MODIF_ID\)/.test(m));assert(!/insert|upsert|delete\s*\(/.test(m.replace(/\/\/[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'')));
  assert(/return;\s*\}\s*$/.test(m.trim()),'la branche modification se termine avant l\'insert');
  assert(/modifie_par: EMPLOYEE\.id/.test(m)&&/modifie_le: new Date\(\)\.toISOString\(\)/.test(m));
  assert(/\.select\('id'\)/.test(m)&&/!data \|\| !data\.length/.test(m),'refus RLS silencieux détecté');});
t('page : mêmes contrôles que la création, avant tout accès à la base',()=>{
  const v=fn('async function validerCampagne','if (MODIF_ID){');
  assert(/V\.formManque/.test(v)&&/V\.formDates/.test(v)&&/V\.formAutre/.test(v));
  assert(!/nexusClient/.test(v));});
t('page : le formulaire est prérempli depuis la campagne',()=>{
  const m=fn('function ouvrirModification','function sortirModification');
  ['nom: r.nom','dateDebut: r.date_debut','dateFin: r.date_fin','type: r.type','nature: r.nature','objectif: r.objectif','objectifLibre: r.objectif_libre','produits_concernes'].forEach(k=>assert(m.includes(k),k));
  assert(/remplirDepuis\(/.test(m)&&/V\.modifierTitre/.test(m)&&/V\.modifierValider/.test(m));});
t('page : aucun brouillon en modification',()=>{
  assert(/function sauverBrouillon\(\)\{\s*if \(MODIF_ID\) return;/.test(page));
  const m=fn('function ouvrirModification','function sortirModification');assert(!/stockage\(|brouillon/i.test(m.replace(/cacherReprise/,'')));
  assert(!/effacerBrouillon/.test(fn('if (MODIF_ID){','const { error } = await')));
  assert(/function sortirModification/.test(page)&&/sortirModification\(\);\s*\}\s*function choisirPill/.test(page.replace(/\n/g,' ')+''));});
t('page : Modifier réservé au manager, Consulter pour tous',()=>{
  const a=fn('const peutModifier','function ligneModifiee');
  assert(/nexusEstManager\(EMPLOYEE\)/.test(a));
  assert(/data-consulter=/.test(a)&&/\(peutModifier\(\) \? '<button[^']*data-modifier/.test(a));
  assert(/function ouvrirModification\(id\)\{\s*if \(!peutModifier\(\)\) return;/.test(page));});
t('page : boutons sur les cartes en cours, le bilan détaillé et l\'historique',()=>{
  const n=(page.match(/actionsCampagne\(i\.campagneId\)/g)||[]).length;assert(n>=3,'3 emplacements, trouvé '+n);});
t('page : modifie_le lu ; ligne « Modifiée le » sans nom d\'employé',()=>{
  assert(/objectif_libre, cree_le, modifie_le'/.test(page));
  const l=fn('function ligneModifiee','function ouvrirFiche');assert(!/modifie_par|employ/i.test(l));
  assert(/if \(r\.modifie_le\)/.test(page));});
t('lexique : textes présents',()=>{
  assert.strictEqual(V.consulter,'Consulter');assert.strictEqual(V.modifier,'Modifier');
  assert.strictEqual(V.modifierTitre,'Modifier la promotion');assert.strictEqual(V.modifierValider,'Enregistrer les modifications');
  assert.strictEqual(V.modifierMesureGardee,'Ce produit a une mesure enregistrée. Elle reste dans Mesurer la compensation.');
  assert.strictEqual(V.ficheModifiee.replace('{date}','14/11/2026').replace('{heure}','09 h 05'),'Modifiée le 14/11/2026 à 09 h 05');});
t('page : mesure conservée, rien n\'est supprimé en retirant un produit',()=>{
  assert(/V\.modifierMesureGardee/.test(page));assert(!/campagne_mesures_produits/.test(fn('function ouvrirModification','function brancherFiche')+fn('if (MODIF_ID){','const { error } = await')));});
t('page : boutons de 44 px, une colonne sous 768 px',()=>{
  assert(/\.btn\{[^}]*min-height:44px/.test(page));assert(/\.c-actions\{[^}]*flex-wrap:wrap/.test(page));});
t('aucune lecture git dans la page',()=>assert(!/child_process|execSync|spawn/.test(page)));
console.log(echecs?'\n'+echecs+' échec(s)':'\ntout est vert'); process.exit(echecs?1:0);
