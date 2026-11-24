#!/usr/bin/env python3
"""Dhikr du jour : produit (et publie) le Short « compte avec moi » du jour.

  1. choisit l'invocation suivante dans dhikr/invocations.json (rotation : nombre de lignes de dhikr/publies.txt)
     ou celle donnée par DHIKR_ID=<id>
  2. calcule le minutage (intro, une perle par répétition, fin) et écrit motion/public/props-dhikr.json
  3. rend la vidéo avec Remotion (composition « Dhikr ») : sorties/dhikr-AAAA-MM-JJ.mp4
  4. écrit les métadonnées YouTube (titre, description avec le hadith complet et la source, tags)
  5. si AUTO_UPLOAD=1 : envoie sur YouTube (upload_youtube.py --charte dhikr/charte.json)
     et ajoute une ligne « date id_invocation id_youtube » à dhikr/publies.txt

Aucune voix, aucune musique : seulement un petit clic de perle par compte (motion/public/sfx/perle.wav).
Test rapide sans envoi : DHIKR_ID=alhamdulillah REMOTION_FRAMES=0-150 python dhikr.py
"""
import datetime, json, os, subprocess, sys

ICI = os.path.dirname(os.path.abspath(__file__))
MOTION = os.path.join(ICI, "motion")
DOSSIER = os.path.join(ICI, "dhikr")
PUBLIES = os.path.join(DOSSIER, "publies.txt")
INTRO, OUTRO = 3.2, 5.5


def charger():
    inv = json.load(open(os.path.join(DOSSIER, "invocations.json"), encoding="utf-8"))["invocations"]
    charte = json.load(open(os.path.join(DOSSIER, "charte.json"), encoding="utf-8"))
    return inv, charte


def lignes_publiees():
    if not os.path.exists(PUBLIES):
        return []
    return [l.split() for l in open(PUBLIES, encoding="utf-8") if l.strip() and not l.startswith("#")]


def choisir(inv):
    voulu = os.environ.get("DHIKR_ID", "").strip()
    if voulu:
        return next(x for x in inv if x["id"] == voulu)
    return inv[len(lignes_publiees()) % len(inv)]


def props(x, charte):
    t, etapes = INTRO, []
    for e in x["etapes"]:
        etapes.append({**e, "debut": round(t, 3)})
        t += e["repetitions"] * e["secondes"]
    if len(etapes) == 1:
        sous = f"{etapes[0]['repetitions']} FOIS"
    else:
        sous = " · ".join(str(e["repetitions"]) for e in etapes if e["repetitions"] > 1)
        sous += "".join(f" + {e['repetitions']}" for e in etapes if e["repetitions"] == 1)
    return {
        "marque": charte["nom_chaine"], "source": x["source"],
        "introHaut": "AVANT DE SCROLLER", "introTitre": x["nom"], "introSous": sous,
        "appel": x.get("appel", "Dis-le avec nous."), "recompense": x["recompense"],
        "finHaut": "QU'ALLAH L'ACCEPTE", "finBas": "Enregistre la vidéo pour après ta prière,\net partage-la à un proche.",
        "etapes": etapes, "introDuree": INTRO, "outroDuree": OUTRO, "duree": round(t + OUTRO, 3), "son": True,
    }


def meta(x):
    lignes = [x["hadith"], "", "Compte avec nous : " + " · ".join(
        f"{e['phonetique'].title()} ({e['traduction']}) × {e['repetitions']}" for e in x["etapes"]),
        "", "Dis-le en commentaire quand tu as fini 🤍"]
    return {"titre": x["titre"], "description": "\n".join(lignes), "sources": [x["source"]],
            "tags": ["dhikr", "islam", "tasbih", "rappel", "invocation", "hadith", "sunna", "dua",
                     x["etapes"][0]["phonetique"].lower(), "compte avec moi", "dhikr en français"],
            "hashtags": ["#rappel"]}


def rendre(p, sortie):
    chemin = os.path.join(MOTION, "public", "props-dhikr.json")
    json.dump(p, open(chemin, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    if not os.path.isdir(os.path.join(MOTION, "node_modules")):
        subprocess.check_call(["npm", "ci", "--no-audit", "--no-fund"], cwd=MOTION)
    cmd = ["npx", "remotion", "render", "src/index.ts", "Dhikr", os.path.abspath(sortie), f"--props={chemin}",
           "--codec=h264", f"--crf={os.environ.get('REMOTION_CRF', '20')}", "--audio-bitrate=192k"]
    for var, opt in (("REMOTION_CONCURRENCY", "--concurrency"), ("CHROME_PATH", "--browser-executable"),
                     ("REMOTION_FRAMES", "--frames")):
        if os.environ.get(var):
            cmd.append(f"{opt}={os.environ[var]}")
    subprocess.check_call(cmd, cwd=MOTION)


def main():
    inv, charte = charger()
    x = choisir(inv)
    jour = datetime.date.today().isoformat()
    os.makedirs(os.path.join(ICI, "sorties"), exist_ok=True)
    video = os.path.join(ICI, "sorties", f"dhikr-{jour}.mp4")
    script = os.path.join(ICI, "sorties", f"dhikr-{jour}.json")
    print("Dhikr du jour :", x["id"], "-", x["nom"])
    json.dump(meta(x), open(script, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    rendre(props(x, charte), video)
    if os.environ.get("AUTO_UPLOAD") == "1":
        idf = video + ".id"
        subprocess.check_call([sys.executable, os.path.join(ICI, "upload_youtube.py"), video, script,
                               "--charte", os.path.join(DOSSIER, "charte.json"), "--id-file", idf])
        yid = open(idf).read().strip()
        with open(PUBLIES, "a", encoding="utf-8") as fh:
            fh.write(f"{jour} {x['id']} {yid}\n")
        print("Noté dans dhikr/publies.txt")


if __name__ == "__main__":
    main()
