// NEXUS — lecteur OCR Apple Vision (JAUGEAGE-OCR-2-20261022, étape A).
//
// Remplace Paddle pour les photos (écran Veeder-Root et bons scannés) ;
// ocrmypdf reste seul responsable des PDF, inchangé (option C, decision-1
// de ce lot). Compilation réservée à l'iMac (étape B — commandes fournies
// à Frédéric une à une, binaire non versionné). Point d'entrée @main : pas de
// main.swift à nommer.
//
//   swiftc -O vision_ocr_core.swift vision_ocr.swift -o vision_ocr
//
// Contrat de sortie, repère et regroupement en lignes : voir
// vision_ocr_core.swift (en-tête de `Fragment`). Chaque fragment reconnu
// garde son texte, sa confiance propre et sa boîte normalisée x/y/w/h
// (origine en bas à gauche, valeurs 0...1).
//
// Langues : ["fr-FR", "en-US"], correction linguistique désactivée
// (usesLanguageCorrection=false) pour ne pas « corriger » des chiffres.
//
// Codes de sortie :
//   0  — réussite (JSON de résultat sur stdout) ; mode résident : toujours 0 à la fin.
//   1  — image illisible ou reconnaissance en échec (JSON {"error":"…"}).
//   2  — usage incorrect.
//
// Deux modes, pour amortir le coût de lancement de Vision :
//   vision_ocr <chemin-image>   — un seul appel, un seul JSON en sortie.
//   vision_ocr --resident       — mode résident : lit un chemin par ligne sur
//                                  stdin, écrit un JSON par ligne sur stdout
//                                  (une erreur est un JSON {"error":"…"} sans
//                                  arrêter la boucle), jusqu'à EOF ou la ligne
//                                  "EXIT". Le worker garde ce processus vivant
//                                  pour ne pas repayer le lancement de Vision ;
//                                  piste à vérifier en étape B face aux 4 min 30
//                                  de latence non expliqués.

import Vision
import ImageIO
import Foundation

struct ErreurOCR: Error { let message: String }

func reconnaitreTexte(cheminImage: String) -> Result<OCRResult, ErreurOCR> {
    guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: cheminImage) as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        return .failure(ErreurOCR(message: "image illisible : \(cheminImage)"))
    }

    let requete = VNRecognizeTextRequest()
    requete.recognitionLevel = .accurate
    requete.usesLanguageCorrection = false
    requete.recognitionLanguages = ["fr-FR", "en-US"]

    let gestionnaire = VNImageRequestHandler(cgImage: image, options: [:])
    do {
        try gestionnaire.perform([requete])
    } catch {
        return .failure(ErreurOCR(message: "échec reconnaissance : \(error.localizedDescription)"))
    }

    let fragments = (requete.results ?? []).compactMap { observation -> Fragment? in
        guard let candidat = observation.topCandidates(1).first else { return nil }
        let boite = observation.boundingBox
        return Fragment(
            t: candidat.string,
            c: Double(candidat.confidence),
            x: Double(boite.origin.x),
            y: Double(boite.origin.y),
            w: Double(boite.size.width),
            h: Double(boite.size.height)
        )
    }

    return .success(assemblerResultat(fragments))
}

func traiterChemin(_ chemin: String) -> Int32 {
    switch reconnaitreTexte(cheminImage: chemin) {
    case .success(let resultat):
        print(encoderJSON(resultat))
        fflush(stdout)
        return 0
    case .failure(let erreur):
        print(encoderJSON(OCRError(error: erreur.message)))
        fflush(stdout)
        return 1
    }
}

@main
struct VisionOCR {
    static func main() {
        let arguments = CommandLine.arguments

        if arguments.count >= 2 && arguments[1] == "--resident" {
            while let ligne = readLine(strippingNewline: true) {
                let chemin = ligne.trimmingCharacters(in: .whitespaces)
                if chemin.isEmpty { continue }
                if chemin == "EXIT" { break }
                _ = traiterChemin(chemin)
            }
            exit(0)
        } else if arguments.count == 2 {
            exit(traiterChemin(arguments[1]))
        } else {
            print(encoderJSON(OCRError(error: "usage : vision_ocr <chemin-image> | vision_ocr --resident")))
            exit(2)
        }
    }
}
