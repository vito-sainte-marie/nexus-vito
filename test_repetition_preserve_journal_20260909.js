// La répétition PREPROD-équivalente détruit-elle une décision humaine ?
//
// `outils/repeter-lot-production-readiness-test.sh` reconstruit nexus-test en
// faisant `drop schema public cascade`. Tout ce que le schéma `public`
// contient disparaît, y compris `public.nexus_live_events`, recréée VIDE par
// sa migration.
//
// La CI republiera ses propres événements au run suivant. Elle ne republiera
// JAMAIS les autorisations accordées par Frédéric en personne : ce sont les
// seules traces qu'un humain a décidé quelque chose, à cette heure-là, en
// réponse à cette question-là. Les perdre ne serait pas une remise à zéro,
// ce serait effacer une décision — exactement ce que le registre Handoff
// interdit en étant append-only, et ce que la Bible refuse en interdisant de
// fabriquer un passé plausible.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const CAPTURE = fs.readFileSync(path.join(__dirname, 'outils', 'capturer-baseline-recette-test.sql'), 'utf8');
const SCRIPT = fs.readFileSync(path.join(__dirname, 'outils', 'repeter-lot-production-readiness-test.sh'), 'utf8');
const RECONSTRUIRE = fs.readFileSync(path.join(__dirname, 'outils', 'reconstruire-base-test.sh'), 'utf8');

let n = 0;
function t(nom, fn) { fn(); n++; console.log('OK — ' + nom); }

t('la reconstruction détruit bien le schéma — c’est la prémisse', () => {
  // Si un jour elle cessait de le faire, la capture deviendrait inutile et
  // cette épreuve devrait être revue plutôt que laissée à tourner à vide.
  assert.ok(/drop schema if exists public cascade/.test(RECONSTRUIRE),
    'la prémisse de cette épreuve n’est plus vraie : vérifier ce que la reconstruction détruit');
});

t('la capture couvre les QUATRE tables irremplaçables', () => {
  for (const table of ['public.sites', 'public.station_config', 'public.employees', 'public.nexus_live_events']) {
    assert.ok(CAPTURE.includes(`insert into ${table} (`),
      `la capture ne préserve pas ${table} — elle serait perdue à la reconstruction`);
  }
});

t('le journal Live est capturé ENTIER, sans filtre', () => {
  // Un filtre — « seulement les événements humains », « seulement les 30
  // derniers » — ferait dépendre l'histoire conservée d'un réglage arbitraire.
  const i = CAPTURE.indexOf('insert into public.nexus_live_events');
  const bloc = CAPTURE.slice(CAPTURE.lastIndexOf('-- 4)', i), CAPTURE.length);
  assert.ok(/from public\.nexus_live_events v/.test(bloc), 'la source doit être la table entière');
  assert.ok(!/where\s+v\./i.test(bloc), 'aucun filtre de ligne ne doit restreindre le journal capturé');
});

t('le rejeu est IDEMPOTENT et ne réinvente pas les identifiants', () => {
  // Restreint à LA SECTION 4. Ma première version cherchait dans tout le
  // fichier : la section employees porte le même motif `kv.cle <> 'id'`, et la
  // mutation qui le retirait du journal survivait donc à l'épreuve.
  const bloc = CAPTURE.slice(CAPTURE.indexOf('-- 4)'));
  assert.ok(/on conflict \(event_id\) do nothing/.test(bloc),
    'rejouer deux fois la capture ne doit pas dupliquer le journal');
  assert.ok(/kv\.cle <> 'id'/.test(bloc),
    '`id` est IDENTITY ALWAYS : le rejouer échouerait, et ce n’est qu’un numéro de séquence');
  assert.ok(!/do update set/.test(bloc),
    'un journal append-only ne se met pas à jour : il s’ajoute ou il est déjà là');
});

t('les instants sont repris tels quels, jamais recalculés', () => {
  // `created_at` a un DEFAULT now(). L'omettre daterait toute l'histoire du
  // jour où on l'a restaurée — un passé plausible, donc faux.
  const i = CAPTURE.indexOf('-- 4)');
  const bloc = CAPTURE.slice(i);
  assert.ok(!/kv\.cle <> 'created_at'/.test(bloc), 'created_at ne doit pas être exclu du rejeu');
  assert.ok(!/kv\.cle <> 'occurred_at'/.test(bloc), 'occurred_at non plus');
});

t('le script CAPTURE avant de détruire, jamais l’inverse', () => {
  const iCapture = SCRIPT.indexOf('[1/4] Capture');
  const iDetruit = SCRIPT.indexOf('reconstruire-base-test.sh" "$REF"');
  const iRejeu = SCRIPT.indexOf('[3/4]');
  assert.ok(iCapture > 0 && iDetruit > iCapture, 'la capture doit précéder la reconstruction');
  assert.ok(iRejeu > iDetruit, 'le réensemencement doit suivre la reconstruction');
  assert.ok(/ÉCHEC de la capture — arrêt AVANT toute écriture/.test(SCRIPT),
    'une capture ratée doit arrêter le script avant de détruire quoi que ce soit');
});

t('le script décrit ce qu’il fait RÉELLEMENT', () => {
  // Son en-tête annonçait « sites/station_config/employees » alors qu'il
  // préserve aussi le journal. Une documentation en retard sur le code est
  // une documentation qui ment.
  assert.ok(/nexus_live_events/.test(SCRIPT),
    'l’en-tête doit mentionner le journal Live désormais préservé');
});

t('PRODUCTION reste refusée par construction', () => {
  assert.ok(/PROD_REF="uzhjpqpctpvxytxpxoqz"/.test(SCRIPT));
  assert.ok(/REFUS : .* projet de PRODUCTION/.test(SCRIPT),
    'le refus doit être explicite, comparé avant toute opération');
});

console.log(`\n${n}/${n} vérifications passées — une remise à zéro n’efface pas une décision humaine.`);
