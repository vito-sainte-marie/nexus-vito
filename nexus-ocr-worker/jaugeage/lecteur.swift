// NEXUS : lecteur de jaugeage par Apple Vision (iMac, macOS)
// Usage : ./lecteur-vision <chemin de la photo>
// Lit le texte de la photo en local (aucun envoi réseau) et affiche
// chaque ligne lue en JSON : texte, confiance, position dans l'image.
// L'interprétation des volumes se fait ensuite côté Python, et toute
// valeur reste à valider par un humain avant enregistrement dans NEXUS.

import Foundation
import ImageIO
import Vision

func echouer(_ message: String, _ code: Int32) -> Never {
    FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
    exit(code)
}

let args = CommandLine.arguments
guard args.count == 2 else { echouer("usage : lecteur-vision <photo>", 2) }

let url = URL(fileURLWithPath: args[1])
guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    echouer("image illisible : \(args[1])", 3)
}

// Respecte l'orientation enregistrée par le téléphone (photo prise de travers).
var orientation = CGImagePropertyOrientation.up
if let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
   let brute = props[kCGImagePropertyOrientation] as? UInt32,
   let o = CGImagePropertyOrientation(rawValue: brute) {
    orientation = o
}

let requete = VNRecognizeTextRequest()
requete.recognitionLevel = .accurate
requete.usesLanguageCorrection = false   // des chiffres, pas des mots
requete.recognitionLanguages = ["fr-FR", "en-US"]

let gestionnaire = VNImageRequestHandler(cgImage: image, orientation: orientation, options: [:])
do {
    try gestionnaire.perform([requete])
} catch {
    echouer("lecture impossible : \(error)", 4)
}

var lignes: [[String: Any]] = []
for obs in requete.results ?? [] {
    guard let candidat = obs.topCandidates(1).first else { continue }
    let b = obs.boundingBox
    lignes.append([
        "texte": candidat.string,
        "confiance": (Double(candidat.confidence) * 100).rounded() / 100,
        "x": (Double(b.origin.x) * 1000).rounded() / 1000,
        "y": (Double(b.origin.y) * 1000).rounded() / 1000,
        "largeur": (Double(b.size.width) * 1000).rounded() / 1000,
        "hauteur": (Double(b.size.height) * 1000).rounded() / 1000,
    ])
}

let sortie: [String: Any] = ["moteur": "apple-vision", "nb_lignes": lignes.count, "lignes": lignes]
guard let data = try? JSONSerialization.data(withJSONObject: sortie, options: [.prettyPrinted, .sortedKeys]) else {
    echouer("sortie JSON impossible", 5)
}
FileHandle.standardOutput.write(data)
print()
