'use strict';

/**
 * DÉSIGNATION-RAIL — retrouver, sans jamais la deviner, la branche que
 * l'humain a désignée pour un travail donné.
 *
 * LE PROBLÈME.
 * Une branche `claude/issue-28-20260930-1349` ne dit pas vers quel rail son
 * résultat doit revenir. On l'a mesuré le 30/09/2026 sur `61562d8` : le commit
 * porte « Ref issue #28 » et un `Co-authored-by`, et rien d'autre. Aucun
 * `NEXUS_BASE_BRANCH`. La désignation n'est pas sur la branche ; elle est dans
 * le commentaire qui a déclenché le run, et nulle part ailleurs.
 *
 * CE QUE CE MODULE NE FAIT PAS.
 * Il ne *recalcule* pas la désignation. La mémoire de ce dépôt garde la trace
 * de quatre défauts de septembre nés du même geste : dériver du contexte
 * ambiant ce qu'un humain avait désigné ailleurs. Repli sur « le rail courant »,
 * repli sur « la branche de départ », repli sur `config-par-environnement` —
 * chaque repli a produit un transport silencieusement faux.
 * Ici il n'y a aucun repli. On retrouve la phrase écrite par l'humain, ou on
 * refuse.
 *
 * COMMENT ON RETROUVE LA PHRASE.
 * Le nom de la branche porte l'instant de démarrage du run, à la minute :
 * `claude/issue-<N>-<AAAAMMJJ>-<HHMM>`. Le déclencheur est donc, par
 * construction, le dernier commentaire `@claude` de l'auteur autorisé créé
 * avant ce démarrage. La troncature à la minute et le délai d'amorçage font
 * que le commentaire peut être daté de quelques secondes *après* la minute
 * nommée : d'où une tolérance vers l'avant, et vers l'avant seulement — un
 * commentaire postérieur au run ne peut pas l'avoir déclenché.
 *
 * MESURE DU 30/09/2026 (137 branches `claude/issue-28-*`, 191 commentaires) :
 * 137 branches sur 137 s'épinglent à un déclencheur, écart maximal observé
 * 41 secondes. 88 de ces déclencheurs portent une désignation, toutes
 * `handoff-continuite-20260920` ; les 49 autres sont antérieurs au 21/09,
 * c'est-à-dire à la discipline de désignation elle-même. Depuis le
 * 21/09/2026 10:43:42Z, tout déclencheur qui lance un run en porte une —
 * `claude.yml` refuse désormais ceux qui n'en portent pas.
 * La tolérance est fixée à 120 s : le triple de l'écart maximal mesuré, et
 * assez court pour qu'un déclencheur d'une autre minute ne s'y glisse pas.
 *
 * LA GRAMMAIRE EST CELLE DE `claude.yml`.
 * L'étape « Résoudre le rail NEXUS désigné » de `.github/workflows/claude.yml`
 * lit `NEXUS_BASE_BRANCH` avec `=` ou `:`, espaces optionnels, valeur
 * éventuellement entourée de guillemets ou de backticks. Ce module reproduit
 * exactement cette grammaire, et `test_designation_rail_20260930.js` le
 * vérifie sur un corpus de formes réelles. C'est une duplication assumée et
 * mesurée, pas un oubli : `claude.yml` vit sur `main`, qui n'est pas ouvert à
 * ce lot. Le jour où `main` s'ouvre, l'étape doit appeler ce module.
 */

// La grammaire canonique. Le `g` impose de recréer l'objet à chaque usage :
// un RegExp global porte un `lastIndex` qui survit à l'appel précédent.
const GRAMMAIRE = () =>
  /NEXUS_BASE_BRANCH[ \t]*[:=][ \t]*[`"']?([A-Za-z0-9._/-]+)/g;

// Un rail ne peut pas être une ref protégée. Ce n'est pas une politique de ce
// module, c'est la même règle que celle du workflow : on ne travaille jamais
// directement sur `main` ni sur `production`.
const RAILS_INTERDITS = Object.freeze(['main', 'production']);

// Les seules formes de rail acceptées, reprises de `claude.yml`.
const RAIL_NOMME = /^handoff-[A-Za-z0-9._/-]+$/;
const RAIL_LITTERAL = 'config-par-environnement';

const BRANCHE_DE_RUN = /^claude\/issue-(\d+)-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})$/;

const TOLERANCE_SECONDES = 120;

const MAILLON = 'designation-rail';

/** Toutes les désignations distinctes portées par un texte, dans l'ordre. */
function designations(texte) {
  if (typeof texte !== 'string') return [];
  const vues = [];
  for (const m of texte.matchAll(GRAMMAIRE())) {
    if (!vues.includes(m[1])) vues.push(m[1]);
  }
  return vues;
}

/**
 * Un nom de rail est-il recevable ? Retourne `null` si oui, un code de refus
 * sinon. On sépare « interdit » de « malformé » : ce n'est pas la même
 * conversation avec l'humain.
 */
function refusDeForme(nom) {
  if (RAILS_INTERDITS.includes(nom)) return 'RAIL_INTERDIT';
  if (nom.includes('..') || nom.startsWith('/') || nom.endsWith('/')) return 'RAIL_MALFORME';
  if (nom !== RAIL_LITTERAL && !RAIL_NOMME.test(nom)) return 'RAIL_MALFORME';
  return null;
}

/** L'instant de démarrage que porte le nom d'une branche de run, ou `null`. */
function instantDeLaBranche(branche) {
  const m = BRANCHE_DE_RUN.exec(String(branche || ''));
  if (!m) return null;
  return {
    issue: Number(m[1]),
    instant: Date.UTC(Number(m[2]), Number(m[3]) - 1, Number(m[4]), Number(m[5]), Number(m[6])),
  };
}

function versInstant(v) {
  const t = v instanceof Date ? v.getTime() : Date.parse(String(v));
  return Number.isFinite(t) ? t : null;
}

/**
 * Épingle une branche de run au commentaire qui l'a déclenchée.
 *
 * `commentaires` : `[{ date, auteur, corps }]`, dans n'importe quel ordre.
 * Retourne `{ declencheur, ecart_secondes }` ou `{ code, motif }`.
 */
function epingler({ branche, commentaires, auteurAutorise, tolerance } = {}) {
  const tol = (typeof tolerance === 'number' ? tolerance : TOLERANCE_SECONDES) * 1000;

  const nom = instantDeLaBranche(branche);
  if (!nom) {
    return {
      code: 'BRANCHE_NON_EPINGLABLE',
      motif: `« ${branche} » ne porte pas la forme claude/issue-<n°>-<AAAAMMJJ>-<HHMM> : `
        + `rien dans son nom ne dit quel déclencheur elle répond.`,
    };
  }

  const recevables = (Array.isArray(commentaires) ? commentaires : [])
    .map((c) => ({ ...c, t: versInstant(c && c.date) }))
    .filter((c) => c.t !== null)
    .filter((c) => !auteurAutorise || c.auteur === auteurAutorise)
    .filter((c) => typeof c.corps === 'string' && c.corps.includes('@claude'))
    // Vers l'avant seulement : un commentaire postérieur au run ne peut pas
    // l'avoir déclenché. La tolérance n'absorbe que la troncature à la minute.
    .filter((c) => c.t <= nom.instant + tol)
    .sort((a, b) => a.t - b.t);

  if (recevables.length === 0) {
    return {
      code: 'DECLENCHEUR_INTROUVABLE',
      motif: `aucun commentaire « @claude »${auteurAutorise ? ` de ${auteurAutorise}` : ''} `
        + `ne précède le démarrage de « ${branche} ».`,
    };
  }

  const declencheur = recevables[recevables.length - 1];
  const ecart = Math.round(Math.abs(nom.instant - declencheur.t) / 1000);
  if (ecart * 1000 > tol) {
    return {
      code: 'DECLENCHEUR_INTROUVABLE',
      motif: `le commentaire « @claude » le plus proche du démarrage de « ${branche} » `
        + `en est distant de ${ecart} s, au-delà de la tolérance de ${tol / 1000} s. `
        + `Épingler au-delà serait deviner.`,
    };
  }

  // L'ambiguïté ne compte que si elle change la réponse. Deux déclencheurs dans
  // la même fenêtre qui nomment le même rail ne posent aucune question.
  const fenetre = recevables.filter((c) => Math.abs(nom.instant - c.t) <= tol);
  const nommes = [...new Set(fenetre.flatMap((c) => designations(c.corps)))];
  if (nommes.length > 1) {
    return {
      code: 'DESIGNATION_AMBIGUE',
      motif: `${fenetre.length} déclencheurs possibles dans les ${tol / 1000} s autour du `
        + `démarrage de « ${branche} », et ils ne nomment pas le même rail : ${nommes.join(', ')}.`,
    };
  }

  return { declencheur, ecart_secondes: ecart };
}

/**
 * Résout le rail de destination d'une branche de run.
 *
 * `override` court-circuite la lecture des commentaires — c'est ce qui permet
 * à l'épreuve de continuité de viser un rail de preuve. Ce n'est pas un repli :
 * un repli s'applique quand on n'a rien trouvé, un override est une désignation
 * explicite de plus, et il est tracé comme tel dans `origine`.
 *
 * Retourne `{ rail, origine, declencheur?, ecart_secondes? }`
 * ou `{ rail: null, code, motif }`.
 */
function resoudre({ branche, commentaires, auteurAutorise, override, tolerance } = {}) {
  if (override) {
    const refus = refusDeForme(override);
    if (refus) {
      return {
        rail: null,
        code: refus,
        motif: `le rail imposé « ${override} » n'est pas un rail recevable.`,
      };
    }
    return { rail: override, origine: 'IMPOSE' };
  }

  const pin = epingler({ branche, commentaires, auteurAutorise, tolerance });
  if (pin.code) return { rail: null, code: pin.code, motif: pin.motif };

  const nommes = designations(pin.declencheur.corps);
  if (nommes.length === 0) {
    return {
      rail: null,
      code: 'DESIGNATION_ABSENTE',
      motif: `le déclencheur de « ${branche} » (${pin.declencheur.date}) ne porte aucun `
        + `NEXUS_BASE_BRANCH. Sans désignation il n'y a pas de destination, et une `
        + `destination ne se devine pas.`,
    };
  }
  if (nommes.length > 1) {
    return {
      rail: null,
      code: 'DESIGNATION_AMBIGUE',
      motif: `le déclencheur de « ${branche} » nomme plusieurs rails : ${nommes.join(', ')}.`,
    };
  }

  const rail = nommes[0];
  const refus = refusDeForme(rail);
  if (refus) {
    return {
      rail: null,
      code: refus,
      motif: `le déclencheur de « ${branche} » désigne « ${rail} », qui n'est pas un rail `
        + `recevable.`,
    };
  }

  return {
    rail,
    origine: 'DECLENCHEUR',
    declencheur: pin.declencheur,
    ecart_secondes: pin.ecart_secondes,
  };
}

module.exports = {
  MAILLON,
  GRAMMAIRE,
  RAILS_INTERDITS,
  RAIL_NOMME,
  RAIL_LITTERAL,
  BRANCHE_DE_RUN,
  TOLERANCE_SECONDES,
  designations,
  refusDeForme,
  instantDeLaBranche,
  epingler,
  resoudre,
};
