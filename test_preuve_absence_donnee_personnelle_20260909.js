// La preuve d'absence de donnée personnelle cherche-t-elle vraiment partout ?
//
// Un PREPROD est une copie de Production : les noms, pointages, évaluations et
// éléments de paie de l'équipe de Frédéric, dupliqués dans un second
// environnement. La doctrine `DOCTRINE-PROPRIETE-CREATEUR-DONNEES-CLIENTS.md`
// s'y applique pleinement.
//
// La preuve qui autorise l'accès à cet environnement est donc la pièce la plus
// sensible du dispositif : si elle se trompe, elle autorise exactement ce
// qu'elle prétend interdire. Ces épreuves défendent trois propriétés — elle
// cherche PARTOUT, elle refuse de conclure sans matière, et elle ne publie
// jamais ce qu'elle cherche.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const SQL = fs.readFileSync(path.join(__dirname, 'outils', 'verifier-absence-donnee-personnelle.sql'), 'utf8');

let n = 0;
function t(nom, fn) { fn(); n++; console.log('OK — ' + nom); }

t('le parcours est GÉNÉRIQUE — jamais une liste de colonnes écrite à la main', () => {
  // Une liste manuelle vieillit à la première migration qui ajoute une colonne,
  // et elle vieillit en silence : la preuve reste verte sur un périmètre qui a
  // rétréci.
  assert.ok(/from information_schema\.columns/.test(SQL),
    'les colonnes doivent être découvertes à chaque exécution');
  assert.ok(/table_schema = 'public'/.test(SQL));
  assert.ok(/table_type = 'BASE TABLE'/.test(SQL),
    'les vues ne sont pas parcourues : leurs lignes viennent des tables déjà examinées');
});

t('le JSONB est inclus — sinon la preuve passe à côté du texte généré', () => {
  // `advisor_messages` interpole des prénoms, `nexus_live_events.evidence`
  // porte des structures libres. Ne regarder que les colonnes `text`
  // déclarerait « aucune donnée personnelle » sur une base qui en contient.
  assert.ok(/'jsonb'/.test(SQL) && /'json'/.test(SQL), 'json et jsonb doivent être parcourus');
  assert.ok(/::text ilike/.test(SQL),
    'la comparaison doit passer par ::text pour qu’un prénom interpolé redevienne cherchable');
});

t('FAIL CLOSED — sans témoin, elle REFUSE de conclure', () => {
  assert.ok(/to_regclass\('pg_temp\.temoins'\) is null/.test(SQL),
    'l’absence de la table témoin doit être constatée');
  assert.ok(/PREUVE IMPOSSIBLE/.test(SQL), 'et nommée');
  const bloc = SQL.slice(SQL.indexOf('n_temoins = 0'));
  assert.ok(/raise exception/.test(bloc.slice(0, 300)),
    'zéro témoin doit LEVER, jamais rendre « aucune occurrence »');
});

t('une occurrence trouvée BLOQUE, elle n’avertit pas', () => {
  assert.ok(/PREPROD REFUSÉ/.test(SQL));
  const i = SQL.indexOf('if total > 0');
  assert.ok(/raise exception/.test(SQL.slice(i, i + 300)),
    'un avertissement se lit et s’oublie ; une exception arrête');
  assert.ok(/Aucun agent ne doit accéder/.test(SQL),
    'la conséquence doit être dite, pas seulement le constat');
});

t('les TÉMOINS ne sont jamais écrits dans le dépôt', () => {
  // Committer les valeurs cherchées reviendrait à publier ce qu'on protège.
  assert.ok(/create temp table temoins/.test(SQL) || /table temporaire/.test(SQL),
    'les témoins doivent venir d’une table temporaire fournie à l’exécution');
  assert.ok(!/insert into (pg_temp\.)?temoins\s+values/i.test(SQL),
    'aucune valeur témoin ne doit figurer dans ce fichier');
});

t('la preuve ne MODIFIE rien', () => {
  // Un outil de vérification qui écrit peut masquer ce qu'il devait trouver.
  const code = SQL.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
  assert.ok(!/\b(insert into|update |delete from|drop table|truncate)\b/i.test(code),
    'la vérification doit être en lecture seule');
});

t('le résultat ne PROMET que ce qu’il a cherché', () => {
  // « Aucune donnée personnelle » serait faux : la preuve ne couvre que les
  // témoins fournis. Les champs de texte libre restent hors de sa portée.
  assert.ok(/ne couvre QUE ces témoins/.test(SQL),
    'le succès doit énoncer sa propre limite');
});

// ── La transformation ────────────────────────────────────────────────
const ANON = fs.readFileSync(path.join(__dirname, 'outils', 'anonymiser-preprod.sql'), 'utf8');

t('la transformation REFUSE Production par construction', () => {
  assert.ok(/uzhjpqpctpvxytxpxoqz/.test(ANON), 'la référence Production doit être comparée');
  // L'apostrophe est DOUBLÉE dans une chaîne SQL : chercher la forme simple
  // faisait échouer l'épreuve sur un fichier pourtant correct.
  assert.ok(/REFUS : ce fichier ne s''?exécute JAMAIS sur Production/.test(ANON),
    'un fichier qui détruit des identités ne doit pas dépendre de l’attention de qui le lance');
  const iGarde = ANON.indexOf('uzhjpqpctpvxytxpxoqz');
  const iEcriture = ANON.search(/^update |^delete /m);
  assert.ok(iGarde > 0 && iGarde < iEcriture, 'le refus doit précéder toute écriture');
});

t('les pseudonymes sont DÉTERMINISTES et stables', () => {
  // Un pseudonyme tiré au hasard rendrait deux tables incohérentes entre elles
  // et la copie ne ressemblerait plus à Production.
  assert.ok(/row_number\(\) over \(order by id\)/.test(ANON),
    'l’ordre doit être figé pour que deux exécutions donnent le même résultat');
  assert.ok(!/random\(\)|gen_random_uuid\(\)/.test(ANON),
    'aucun tirage aléatoire : il casserait la stabilité entre tables');
});

t('le texte libre est REMPLACÉ, jamais retouché', () => {
  // Retoucher au cas par cas est le geste qui laisse passer un oubli — et
  // l’oubli, ici, est une personne réidentifiable.
  for (const champ of ['commentaires', 'autocritique_forts', 'autocritique_ameliorer', 'commentaire']) {
    assert.ok(new RegExp(`${champ} = case when`).test(ANON), `${champ} doit être remplacé en entier`);
  }
  assert.ok(!/replace\(|regexp_replace\(/.test(ANON),
    'aucune substitution partielle dans du texte libre');
});

t('le texte GÉNÉRÉ est jeté, pas nettoyé', () => {
  assert.ok(/delete from public\.advisor_messages/.test(ANON),
    'les messages interpolant des prénoms se régénèrent, ils ne se retouchent pas');
});

t('`site_id` n’est PAS renommé — ce n’est pas une donnée personnelle', () => {
  // Le renommer casserait chaque table qui le porte, pour un gain nul.
  assert.ok(/set nom_entreprise = /.test(ANON), 'l’identité commerciale est substituée');
  assert.ok(!/set site_id = /.test(ANON), 'la clé technique ne doit pas être touchée');
});

t('la transformation ne se déclare JAMAIS suffisante', () => {
  // Une transformation se croit toujours complète. C’est la vérification qui
  // tranche, et elle doit être nommée ici comme l’étape qui suit.
  assert.ok(/verifier-absence-donnee-personnelle\.sql/.test(ANON),
    'la transformation doit renvoyer à la vérification qui la contrôle');
  assert.ok(/ne garantit rien par lui-même/.test(ANON));
});

console.log(`\n${n}/${n} vérifications passées — une preuve qui ne cherche rien ne prouve rien.`);
