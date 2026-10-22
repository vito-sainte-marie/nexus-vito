// NEXUS — tests synthétiques du lecteur Vision (JAUGEAGE-OCR-2-20261022,
// étape A). N'importe pas Vision et n'utilise aucune image réelle : ils
// exercent uniquement la logique d'assemblage (vision_ocr_core.swift), pure
// et donc testable sans l'iMac. Les observations sont fabriquées à la main
// pour représenter les deux usages visés par ce lot : une lecture directe de
// l'écran Veeder-Root, et un bon scanné.
//
// Compilation et exécution réservées à l'iMac (étape B, aucun Vision requis
// pour ce fichier) :
//   swiftc vision_ocr_core.swift test_vision_ocr.swift -o test_vision_ocr
//   ./test_vision_ocr

import Foundation

var verifications = 0
var echecs = 0

func verifier(_ condition: Bool, _ message: String) {
    verifications += 1
    if condition {
        print("OK — \(message)")
    } else {
        echecs += 1
        print("ÉCHEC — \(message)")
    }
}

// --- Usage 1 : écran Veeder-Root, quatre blocs, données hors ordre ---
// (Vision ne garantit pas l'ordre de lecture ; sans tri, les quatre volumes
// sortiraient mélangés.)
let veederRoot = [
    ObservationTexte(y: 0.20, texte: "V4 000000", confiance: 0.97),
    ObservationTexte(y: 0.80, texte: "V1 123456", confiance: 0.95),
    ObservationTexte(y: 0.60, texte: "V2 234567", confiance: 0.91),
    ObservationTexte(y: 0.40, texte: "V3 000123", confiance: 0.88),
]
let resultatVeederRoot = assemblerResultat(veederRoot)
verifier(
    resultatVeederRoot.text == "V1 123456\nV2 234567\nV3 000123\nV4 000000",
    "Veeder-Root : lignes remises dans l'ordre haut→bas malgré un ordre d'entrée mélangé"
)
verifier(
    abs(resultatVeederRoot.confidence - 0.9275) < 0.0001,
    "Veeder-Root : confiance moyenne des quatre blocs"
)

// --- Usage 2 : bon scanné, texte plus irrégulier, confiance plus basse ---
let bonScanne = [
    ObservationTexte(y: 0.90, texte: "BON DE LIVRAISON N° 4521", confiance: 0.62),
    ObservationTexte(y: 0.55, texte: "Gazole : 12 450 L", confiance: 0.71),
    ObservationTexte(y: 0.10, texte: "Signature chauffeur", confiance: 0.40),
]
let resultatBon = assemblerResultat(bonScanne)
verifier(
    resultatBon.text == "BON DE LIVRAISON N° 4521\nGazole : 12 450 L\nSignature chauffeur",
    "Bon scanné : lignes remises dans l'ordre haut→bas"
)
verifier(
    abs(resultatBon.confidence - 0.5766666666666667) < 0.0001,
    "Bon scanné : confiance moyenne, plus basse et plus irrégulière que Veeder-Root"
)

// --- Cas limite : aucune observation (image illisible ou vide pour Vision) ---
let resultatVide = assemblerResultat([])
verifier(resultatVide.text == "", "Aucune observation : texte vide")
verifier(resultatVide.confidence == 0, "Aucune observation : confiance à zéro, jamais négative ni NaN")

// --- Contrat JSON lu côté Python par _ocr_image (hors périmètre de ce lot,
// mais le contrat de sortie est fixé ici) ---
let jsonResultat = encoderJSON(OCRResult(text: "V1 123456", confidence: 0.95))
verifier(jsonResultat.contains("\"text\":\"V1 123456\""), "JSON du résultat contient le champ text")
verifier(jsonResultat.contains("\"confidence\":0.95"), "JSON du résultat contient la confiance")

let jsonErreur = encoderJSON(OCRError(error: "image illisible : /tmp/x.jpg"))
verifier(jsonErreur.contains("image illisible"), "JSON d'erreur contient le message")

if echecs == 0 {
    print("Tous les tests synthétiques sont verts (\(verifications) vérifications).")
    exit(0)
} else {
    print("\(echecs)/\(verifications) échec(s) sur les tests synthétiques.")
    exit(1)
}
