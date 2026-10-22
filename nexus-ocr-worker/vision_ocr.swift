// NEXUS — lecteur OCR Apple Vision (JAUGEAGE-OCR-2-20261022, étape A).
//
// Remplace Paddle pour les photos (écran Veeder-Root et bons scannés) ;
// ocrmypdf reste seul responsable des PDF, inchangé (option C, decision-1
// de ce lot). Compilation réservée à l'iMac (étape B — commandes fournies
// à Frédéric une à une, binaire non versionné) : cette source est versionnée
// sans qu'aucune compilation n'ait eu lieu dans cette session, qui n'a ni
// macOS ni le framework Vision.
//
//   swiftc -O vision_ocr_core.swift vision_ocr.swift -o vision_ocr
//
// Deux modes, pour amortir le coût de lancement de Vision :
//   vision_ocr <chemin-image>   — un seul appel, un seul JSON en sortie.
//   vision_ocr --resident       — lit un chemin par ligne sur stdin, écrit
//                                  un JSON par ligne sur stdout, jusqu'à EOF
//                                  ou la ligne "EXIT". Le worker Python garde
//                                  ce processus vivant pour ne pas repayer le
//                                  lancement de Vision à chaque photo —
//                                  piste à vérifier en étape B face aux
//                                  4 min 30 de latence non expliqués.

import Vision
import ImageIO
import Foundation

func reconnaitreTexte(cheminImage: String) -> Result<OCRResult, String> {
    guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: cheminImage) as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        return .failure("image illisible : \(cheminImage)")
    }

    let requete = VNRecognizeTextRequest()
    requete.recognitionLevel = .accurate
    requete.usesLanguageCorrection = false

    let gestionnaire = VNImageRequestHandler(cgImage: image, options: [:])
    do {
        try gestionnaire.perform([requete])
    } catch {
        return .failure("échec reconnaissance : \(error.localizedDescription)")
    }

    let observations = (requete.results ?? []).compactMap { observation -> ObservationTexte? in
        guard let candidat = observation.topCandidates(1).first else { return nil }
        return ObservationTexte(
            y: Double(observation.boundingBox.origin.y),
            texte: candidat.string,
            confiance: Double(candidat.confidence)
        )
    }

    return .success(assemblerResultat(observations))
}

func traiterChemin(_ chemin: String) -> Int32 {
    switch reconnaitreTexte(cheminImage: chemin) {
    case .success(let resultat):
        print(encoderJSON(resultat))
        fflush(stdout)
        return 0
    case .failure(let message):
        print(encoderJSON(OCRError(error: message)))
        fflush(stdout)
        return 1
    }
}

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
