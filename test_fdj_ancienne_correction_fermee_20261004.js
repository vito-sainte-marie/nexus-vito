'use strict';
// Test — FDJ Vague 1 : l'ancienne porte de correction employé est fermée
// (04/10/2026).
//
// POURQUOI CE FICHIER EXISTE
//
// La Vague 1 remplace fdj_corriger_caisse_employe() par
// fdj_corriger_caisse_confirmee(), qui refuse une caisse validée. La suite
// était verte, la remplaçante refusait bien, et pourtant la recette serveur du
// 03/10 sur nexus-test a montré qu'un employé dévalidait encore une caisse
// validée par l'ANCIENNE fonction, restée exécutable : sa seule révocation
// visait PUBLIC, et Supabase accorde EXECUTE à `anon` et `authenticated` par
// des grants nommés qu'un revoke from public ne retire pas.
//
// Une remplaçante ne ferme rien tant que l'ancienne porte reste accordée.
// Lire la nouvelle fonction ne pouvait pas le voir ; il faut rejouer les
// droits de l'ancienne à travers TOUTES les migrations, dans l'ordre.
//
// COMMENT
//
// La CI n'a pas de base. Ce test rejoue donc, migration par migration, les
// seules instructions qui font bouger le droit EXECUTE des fonctions listées
// dans REMPLACEES, selon le modèle de Supabase :
//   - la création d'une fonction accorde EXECUTE à PUBLIC, et à `anon`,
//     `authenticated` et `service_role` par l'alter default privileges ;
//   - `create or replace` sur une fonction existante garde son ACL ;
//   - grant / revoke n'agissent que sur les rôles NOMMÉS ;
//   - drop function retire tout.
// Le vocabulaire est volontairement étroit : toute mention de la fonction que
// ce modèle ne sait pas interpréter (format dynamique, tableau de signatures…)
// fait ÉCHOUER le test plutôt que de produire un état approximatif.
//
// Le modèle est ÉTALONNÉ sur la mesure : rejoué sans la migration de
// fermeture, il doit rendre anon = authenticated = vrai, exactement ce que
// has_function_privilege rendait sur nexus-test le 03/10. Puis chaque garde
// porte sa mutation : un test qui ne rougit pas sur la version fautive ne
// prouve rien (les quatre gardes vertes et inutiles du 08/09).

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const M = path.join(__dirname, 'supabase', 'migrations');
const FERMETURE = '20261004120000_fdj_fermer_ancienne_correction_caisse_employe.sql';

// Fonctions remplacées par la Vague 1, que plus aucun rôle du navigateur ne
// doit pouvoir appeler.
const REMPLACEES = ['public.fdj_corriger_caisse_employe(uuid,numeric,text,text)'];
const ROLES_NAVIGATEUR = ['anon', 'authenticated'];

let n = 0;
function ok(quoi) { n++; console.log('  ✅ ' + quoi); }

const sansCommentaires = (s) => s.split('\n').map(l => {
  const i = l.indexOf('--');
  return i === -1 ? l : l.slice(0, i);
}).join('\n');
const norm = (s) => s.replace(/\s+/g, '').toLowerCase();
const nomSeul = (sig) => sig.slice(0, sig.indexOf('('));

// Rejoue une liste [{ nom, sql }] dans l'ordre et rend l'état EXECUTE de
// chaque fonction de REMPLACEES.
function rejouer(migrations) {
  const etat = {};
  for (const sig of REMPLACEES) etat[sig] = { existe: false, droits: {} };

  for (const { nom, sql } of migrations) {
    const texte = sansCommentaires(sql);
    for (const sig of REMPLACEES) {
      const nomFn = nomSeul(sig);
      const e = etat[sig];
      const motif = new RegExp(nomFn.replace(/\./g, '\\.').replace('public\\.', '(?:public\\.)?'), 'gi');
      let m;
      while ((m = motif.exec(texte)) !== null) {
        // Début de l'instruction : après le dernier ';' ou '$$' qui précède.
        const avant = texte.slice(0, m.index);
        const pv = avant.lastIndexOf(';'), dd = avant.lastIndexOf('$$');
        const debut = Math.max(pv === -1 ? 0 : pv + 1, dd === -1 ? 0 : dd + 2);
        const finInstr = texte.indexOf(';', m.index);
        const instr = texte.slice(debut, finInstr === -1 ? texte.length : finInstr).trim();
        const signatureDe = (s) => {
          const p = s.match(/\(([^)]*)\)/);
          return p ? norm(nomFn + '(' + p[1].split(',').map(a => a.replace(/\s+(default\b|=)[\s\S]*$/i, '').trim().split(/\s+/).pop()).join(',') + ')') : null;
        };
        let r;
        if ((r = instr.match(/^create\s+(or\s+replace\s+)?function\s+([\s\S]*)$/i))) {
          // On ne regarde que l'en-tête : la signature est le type de chaque
          // paramètre (dernier mot, une fois la valeur par défaut retirée).
          if (signatureDe(r[2].slice(0, r[2].indexOf(')') + 1)) !== norm(sig)) continue;
          if (!e.existe) e.droits = { public: true, anon: true, authenticated: true, service_role: true };
          e.existe = true;
        } else if ((r = instr.match(/^drop\s+function\s+(if\s+exists\s+)?(.*)$/is))) {
          if (signatureDe(r[2]) !== norm(sig)) continue;
          e.existe = false; e.droits = {};
        } else if ((r = instr.match(/^(grant|revoke)\s+(all(?:\s+privileges)?|execute)\s+on\s+function\s+(.+?\))\s+(to|from)\s+(.+)$/is))) {
          if (signatureDe(r[3]) !== norm(sig)) continue;
          const accorde = r[1].toLowerCase() === 'grant';
          for (const role of r[5].split(',').map(x => x.trim().toLowerCase())) e.droits[role] = accorde;
        } else if (/^\s*select\b|^\s*perform\b|:=|\bfrom\s+public\.fdj_corriger_caisse_employe\s*\(/i.test(instr) && !/execute\s+format/i.test(instr)) {
          continue; // un appel, pas un changement de droits
        } else {
          throw new Error(`${nom} : mention de ${nomFn} intraduisible par le modèle — à relire à la main :\n  ${instr.slice(0, 200)}`);
        }
      }
    }
  }
  return etat;
}

function ouvertes(etat) {
  const r = [];
  for (const sig of REMPLACEES) {
    const e = etat[sig];
    if (!e.existe) continue;
    for (const role of ROLES_NAVIGATEUR) if (e.droits[role]) r.push(`${sig} → ${role}`);
  }
  return r;
}

const reelles = fs.readdirSync(M).filter(f => f.endsWith('.sql')).sort()
  .map(nom => ({ nom, sql: fs.readFileSync(path.join(M, nom), 'utf8') }));
assert.ok(reelles.some(m => m.nom === FERMETURE), `${FERMETURE} doit exister`);

// 1. Étalonnage : sans la fermeture, le modèle rend la mesure du 03/10.
{
  const avant = rejouer(reelles.filter(m => m.nom !== FERMETURE));
  assert.deepStrictEqual(ouvertes(avant).sort(), REMPLACEES.flatMap(s => ROLES_NAVIGATEUR.map(r => `${s} → ${r}`)).sort(),
    'sans la fermeture, le modèle doit rendre anon et authenticated ouverts, comme nexus-test le 03/10');
  ok('étalonnage — sans la fermeture, anon et authenticated sont ouverts (mesure Test du 03/10)');
}

// 2. Le dépôt réel : plus aucun rôle du navigateur n'atteint l'ancienne porte.
{
  const o = ouvertes(rejouer(reelles));
  assert.deepStrictEqual(o, [], `fonction(s) remplacée(s) encore exécutable(s) :\n  ${o.join('\n  ')}`);
  ok('dépôt réel — fdj_corriger_caisse_employe fermée à anon et authenticated');
}

// 3. Mutation : un grant ultérieur rouvre la porte, la garde doit le voir.
{
  const mut = reelles.concat([{ nom: '29991231000000_mutation.sql',
    sql: 'grant execute on function public.fdj_corriger_caisse_employe(uuid, numeric, text, text) to authenticated;' }]);
  assert.deepStrictEqual(ouvertes(rejouer(mut)), [`${REMPLACEES[0]} → authenticated`]);
  ok('mutation « ré-accorder à authenticated » — rouge');
}

// 4. Mutation : la fermeture réduite au seul revoke from public ne ferme rien.
{
  const mut = reelles.map(m => m.nom !== FERMETURE ? m : { nom: m.nom,
    sql: 'revoke all on function public.fdj_corriger_caisse_employe(uuid, numeric, text, text) from public;' });
  assert.deepStrictEqual(ouvertes(rejouer(mut)).sort(), [`${REMPLACEES[0]} → anon`, `${REMPLACEES[0]} → authenticated`]);
  ok('mutation « revoke from public seulement » — rouge (Supabase accorde par grants nommés)');
}

// 5. Mutation : une mention que le modèle ne sait pas lire fait échouer.
{
  const mut = reelles.concat([{ nom: '29991231000000_mutation.sql',
    sql: "do $$ begin execute format('grant execute on function %s to authenticated', 'public.fdj_corriger_caisse_employe(uuid,numeric,text,text)'); end $$;" }]);
  assert.throws(() => rejouer(mut), /intraduisible/);
  ok('mutation « grant dynamique » — refusée comme intraduisible, jamais ignorée');
}

console.log(`\n${n}/5 contrôles passent.`);
