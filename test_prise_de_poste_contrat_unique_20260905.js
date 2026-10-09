// B1 — la prise de poste ne dépend plus de l'ordre alphabétique de deux triggers.
//
// S-3 n'a jamais fonctionné depuis l'application. L'écran insère `site` et
// jamais `site_id` ; c'est un second trigger qui remplissait `site_id`, et il
// se déclenchait APRÈS S-3 parce que les triggers BEFORE d'un même événement
// partent par ordre alphabétique de nom. S-3 cherchait donc le service actif
// avec un site NULL, n'en trouvait aucun, et l'index de S-1 refusait
// l'insertion avec un 23505 incompréhensible.
//
// Mes essais initiaux fournissaient `site_id` explicitement — une forme de
// données que le parcours réel n'envoie jamais. Ce test garde les propriétés
// STRUCTURELLES qui rendent la régression impossible ; la preuve de
// comportement, elle, est faite en base réelle et consignée dans la fiche de
// rejeu, parce que la suite tourne sans réseau.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const RACINE = __dirname;
const MIGRATION = path.join(RACINE, 'supabase', 'migrations',
  '20260905213000_prise_de_poste_contrat_unique.sql');
const sql = fs.readFileSync(MIGRATION, 'utf8');

// Le corps de la fonction de prise de poste, isolé : sans cette borne, une
// assertion sur « l'ordre des instructions » pourrait être satisfaite par du
// texte appartenant à une autre fonction du même fichier.
function corpsDe(nom) {
  const i = sql.indexOf(`function public.${nom}()`);
  assert.ok(i !== -1, `${nom} introuvable`);
  const j = sql.indexOf('$$;', i);
  return sql.slice(i, j);
}

let passes = 0;
function verifier(nom, fn) { fn(); passes++; console.log('OK — ' + nom); }

verifier('un seul trigger BEFORE INSERT sur shifts', () => {
  // C'est LA propriété qui supprime la dépendance d'ordre. Deux triggers
  // BEFORE INSERT, et la question « lequel passe en premier ? » se repose.
  const declares = sql.match(/create trigger \w+\s+before insert on public\.shifts/gi) || [];
  assert.strictEqual(declares.length, 1,
    'plus d’un trigger BEFORE INSERT réintroduirait la dépendance d’ordre');
  assert.ok(/drop trigger if exists nexus_cloturer_shift_precedent on public\.shifts/i.test(sql),
    'l’ancien trigger de clôture doit être retiré');
  assert.ok(/drop trigger if exists shifts_site_unique on public\.shifts/i.test(sql),
    'l’ancien trigger de normalisation doit être retiré de l’INSERT');
  assert.ok(/create trigger shifts_site_unique\s+before update on public\.shifts/i.test(sql),
    'la normalisation reste nécessaire à l’UPDATE');
});

verifier('le site est normalisé AVANT la recherche du service actif', () => {
  // L'inversion exacte qui manquait. Un test qui vérifierait seulement la
  // présence des deux instructions passerait sur le code défectueux.
  const corps = corpsDe('nexus_shifts_avant_insertion');
  const normalisation = corps.indexOf('NEW.site_id := v_reference');
  const recherche = corps.indexOf('sh.site_id     = NEW.site_id');
  assert.ok(normalisation !== -1, 'la normalisation doit avoir lieu dans ce trigger');
  assert.ok(recherche !== -1, 'la recherche doit porter sur le site normalisé');
  assert.ok(normalisation < recherche,
    'chercher le service actif avant de connaître le site est précisément le défaut B1');
});

verifier('la règle de site n’est pas dupliquée', () => {
  // Deux copies de la règle divergeraient un jour, et A3-1/A3-2 ne tiendraient
  // plus que par la ressemblance de deux textes.
  assert.ok(/create or replace function public\.nexus_site_de_reference/i.test(sql),
    'la règle doit être extraite dans une fonction unique');
  assert.ok(/nexus_site_de_reference\(NEW\.site, NEW\.site_id\)/.test(corpsDe('nexus_forcer_site_unique')),
    'le trigger historique doit déléguer, pour que mission_catalog garde le même comportement');
  assert.ok(/nexus_site_de_reference\(NEW\.site, NEW\.site_id\)/.test(corpsDe('nexus_shifts_avant_insertion')),
    'le nouveau contrat doit appeler la même règle');
  assert.ok(/current_employee_site_id\(\)/.test(sql), 'la règle interroge toujours le site du compte');
});

verifier('site_id reste la source de vérité, site sa copie', () => {
  const corps = corpsDe('nexus_shifts_avant_insertion');
  assert.ok(/NEW\.site\s*:=\s*v_reference/.test(corps) && /NEW\.site_id := v_reference/.test(corps),
    'les deux colonnes doivent recevoir la référence unique — invariants A3-1/A3-2');
});

verifier('la garde temporelle de S-3 est conservée', () => {
  const corps = corpsDe('nexus_shifts_avant_insertion');
  assert.ok(/NEW\.heure_debut <= v_ancien\.heure_debut/.test(corps),
    'une insertion antérieure au service actif n’est pas une prise de poste suivante');
});

verifier('le refus silencieux d’un UPDATE reste détecté', () => {
  const corps = corpsDe('nexus_shifts_avant_insertion');
  assert.ok(/get diagnostics v_lignes = row_count/.test(corps), 'ROW_COUNT doit être relevé');
  assert.ok(/if v_lignes <> 1 then\s*raise exception/.test(corps),
    'zéro ligne modifiée doit lever, sinon la clôture manquerait en silence');
});

verifier('la clôture reste bornée au même employé et au même site', () => {
  const corps = corpsDe('nexus_shifts_avant_insertion');
  assert.ok(/sh\.employee_id = NEW\.employee_id/.test(corps), 'même employé');
  assert.ok(/sh\.site_id     = NEW\.site_id/.test(corps), 'même site');
  assert.ok(/sh\.statut      = 'en_cours'/.test(corps), 'seul un service actif est clôturé');
  assert.ok(/for update/.test(corps), 'le verrou sérialise deux prises de poste concurrentes');
});

verifier('la migration s’arrête si la dépendance d’ordre revient', () => {
  assert.ok(/BEFORE INSERT/.test(sql) && /v_insert <> 1 then\s*raise exception/.test(sql),
    'un contrôle fail-closed doit refuser plus d’un trigger BEFORE INSERT');
});

verifier('aucun trigger de clôture ne survit en double', () => {
  assert.ok(/drop function if exists public\.nexus_cloturer_shift_precedent\(\)/i.test(sql),
    'laisser la fonction sans trigger créerait un second chemin de clôture, mort mais réactivable');
});

// L'écran est l'autre moitié du contrat : c'est parce qu'il n'envoie que
// `site` que la normalisation doit précéder. Si cela change un jour, ce test
// le dira plutôt que de laisser la migration raisonner sur une hypothèse
// périmée.
verifier('l’écran de prise de poste envoie toujours site sans site_id', () => {
  const ecran = fs.readFileSync(path.join(RACINE, 'NEXUS-Prise-De-Poste-v1.html'), 'utf8');
  const i = ecran.indexOf(".from('shifts').insert({");
  assert.ok(i !== -1, 'insertion du service introuvable');
  const bloc = ecran.slice(i, ecran.indexOf('});', i));
  assert.ok(/site:\s*employeeCourant\.site_id/.test(bloc), 'l’écran envoie site');
  assert.ok(!/\bsite_id:/.test(bloc),
    'l’écran n’envoie pas site_id — c’est l’hypothèse dont dépend l’ordre de normalisation');
});

console.log(`\n${passes} vérifications passées — la prise de poste ne dépend plus d’un ordre alphabétique.`);
