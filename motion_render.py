#!/usr/bin/env python3
"""Le Flash, style « motion » : Shorts en motion design rendus avec Remotion (dossier motion/).

rendre(script_json, voix_mp3, sortie_mp4)
  - lit le script (hook, segments avec titre/texte/etiquette, *mots-clés*, visuel optionnel)
  - cale chaque mot sur la voix grâce à l'horodatage ElevenLabs (voix/NNN.json à côté du mp3)
  - choisit un widget par segment (compteur, calendrier, jauge, prix, image du jeu, carte)
    sauf si le script en impose un via "visuel"
  - écrit motion/public/props.json, copie voix, musique et images dans motion/public/
  - lance `npx remotion render` (Chrome headless, aucun PC nécessaire)

Test sans voix : python motion_render.py essais/brut5.json sortie.mp4 --demo   (timings simulés, muet)

Champ "visuel" possible dans un segment du script (sinon déduit du texte) :
  {"type":"compteur","valeur":475000000,"unite":"vues en 24 h"}
  {"type":"calendrier","jour":19,"mois":"nov.","legende":"Sortie mondiale"}
  {"type":"classement","titre":"Précommandes","cible":"GTA 6","de":4,"a":1,"note":"PS Store"}
  {"type":"jauge","valeur":98,"legende":"Note moyenne"}
  {"type":"liste","titre":"Au lancement","items":["Mode photo","Online","Vice City"]}
  {"type":"post","auteur":"NateTheHate","texte":"Les tests tombent à midi."}
  {"type":"prix","montant":"79,99 €","legende":"Édition standard"}
  {"type":"image","cherche":"lucia","legende":"Lucia"}        (capture officielle dont le nom contient « lucia »)
  {"type":"carte","titre":"Les tests","sous":"Aujourd'hui, vers midi"}
"""
import glob, hashlib, json, os, random, re, shutil, subprocess, sys

ICI = os.path.dirname(os.path.abspath(__file__))
MOTION = os.path.join(ICI, "motion")
PUBLIC = os.path.join(MOTION, "public")
OUTRO = 2.8  # secondes de fin (logo + abonnement) après la voix

MOIS = {"janvier": "janv.", "février": "févr.", "fevrier": "févr.", "mars": "mars", "avril": "avr.", "mai": "mai",
        "juin": "juin", "juillet": "juil.", "août": "août", "aout": "août", "septembre": "sept.",
        "octobre": "oct.", "novembre": "nov.", "décembre": "déc.", "decembre": "déc."}
NOMBRES = {"deux": 2, "trois": 3, "quatre": 4, "cinq": 5, "six": 6, "sept": 7, "huit": 8, "neuf": 9, "dix": 10,
           "onze": 11, "douze": 12, "quinze": 15, "vingt": 20, "trente": 30, "cinquante": 50, "cent": 100}
ORDINAUX = re.compile(r"^\s*(un|deux|trois|quatre|cinq|premi[eè]re?|deuxi[eè]me|troisi[eè]me)\s*:", re.I)


def duree_audio(p):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                   "-of", "default=nw=1:nk=1", p], text=True)
    return float(out.strip())


# ---------------------------------------------------------------- mots et horodatage
def mots_du_script(segs):
    """Liste (mot_affiché, est_mot_clé, index_segment) dans l'ordre de lecture."""
    res = []
    for i, g in enumerate(segs):
        dans = False
        for brut in g["texte"].split():
            cle = dans or "*" in brut
            if brut.count("*") % 2 == 1:
                dans = not dans
            res.append((brut.replace("*", ""), cle, i))
    return res


def caler(mots, alignement, total):
    """Début/fin (s) de chaque mot : horodatage ElevenLabs si dispo, sinon au prorata des lettres."""
    if alignement:
        chars = alignement["characters"]
        st, en = alignement["character_start_times_seconds"], alignement["character_end_times_seconds"]
        texte = "".join(chars)
        pos, res = 0, []
        for w, _, _ in mots:
            j = texte.find(w, pos)
            if j < 0 or j - pos > 40:  # mot normalisé par ElevenLabs : on reste où on en est
                j = min(pos, len(st) - 1); k = j
            else:
                k = min(j + len(w) - 1, len(en) - 1); pos = j + len(w)
            res.append((st[min(j, len(st) - 1)], en[k]))
        return res
    poids = [len(w) + 3 for w, _, _ in mots]
    somme, t, res = sum(poids), 0.2, []
    for p in poids:
        d = (total - 0.4) * p / somme
        res.append((t, t + d * 0.9)); t += d
    return res


# ---------------------------------------------------------------- choix des widgets
def images_dispo():
    return sorted(glob.glob(os.path.join(ICI, "clips", "gta6", "*.jpg")))


def choisir_image(cherche, graine, deja):
    imgs = images_dispo()
    if not imgs:
        return None
    if cherche:
        mots = [m for m in re.split(r"\W+", cherche.lower()) if len(m) > 2]
        bons = [p for p in imgs if any(m in os.path.basename(p).lower() for m in mots)]
        if bons:
            imgs = bons
    libres = [p for p in imgs if p not in deja] or imgs
    return libres[int(hashlib.md5(graine.encode()).hexdigest(), 16) % len(libres)]


def deduire_visuel(g, i, hook):
    """Widget déduit du texte du segment (date, %, prix, nombre) ou None."""
    txt = g["texte"].replace("*", "")
    corps = ORDINAUX.sub("", txt)
    corps = re.sub(r"\b(GTA\s*(6|VI|5|V)|PS\s*[45]|PlayStation\s*[45]|Xbox(\s+Series\s+[XS])?|Switch\s*2)\b", "", corps, flags=re.I)
    m = re.search(r"\b(\d{1,2})\s+(" + "|".join(MOIS) + r")\b", corps, re.I)
    if m:
        return {"type": "calendrier", "jour": int(m.group(1)), "mois": MOIS[m.group(2).lower()], "legende": g.get("titre") or None}
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:%|pour ?cent)", corps, re.I)
    if m:
        return {"type": "jauge", "valeur": float(m.group(1).replace(",", ".")), "legende": g.get("titre") or None}
    m = re.search(r"(\d+(?:[.,]\d{1,2})?)\s*(€|euros?|\$|dollars?)", corps, re.I)
    if m:
        dev = "€" if m.group(2).lower().startswith(("€", "euro")) else "$"
        return {"type": "prix", "montant": f"{m.group(1)} {dev}" if dev == "€" else f"{dev}{m.group(1)}", "legende": g.get("titre") or None}
    m = re.search(r"\b(\d[\d\s.]*\d|\d)\s*(millions?|milliards?)?\s+(?:de\s+|d')?([a-zàâçéèêëîïôûùüÿœ'-]{3,})", corps, re.I)
    if not m:
        m2 = re.search(r"\b(" + "|".join(NOMBRES) + r")\s+([a-zàâçéèêëîïôûùüÿœ'-]{4,})", corps, re.I)
        if m2:
            return {"type": "compteur", "valeur": NOMBRES[m2.group(1).lower()], "unite": m2.group(2)}
        return None
    n = float(re.sub(r"[\s.]", "", m.group(1)))
    if m.group(2):
        n *= 1e9 if m.group(2).lower().startswith("milliard") else 1e6
    if 1900 <= n <= 2100 and not m.group(2):  # une année n'est pas un compteur
        return None
    return {"type": "compteur", "valeur": n, "unite": m.group(3)}


def preparer_visuels(segs, hook, graine):
    deja, rang_libre = [], 0
    for i, g in enumerate(segs):
        v = g.get("visuel") or deduire_visuel(g, i, hook)
        if v is None:
            # alternance image du jeu / carte titre pour les segments sans chiffre
            veut_image = g.get("suite") or (rang_libre % 2 == 0)
            rang_libre += 1
            v = {"type": "image", "legende": g.get("titre") or None} if veut_image else \
                {"type": "carte", "titre": g.get("titre") or (hook if i == 0 else "")}
        if v.get("type") == "image":
            src = choisir_image(v.get("cherche") or g.get("titre", ""), f"{graine}-{i}", deja)
            if src:
                deja.append(src)
                os.makedirs(os.path.join(PUBLIC, "images"), exist_ok=True)
                nom = f"images/{i:02d}{os.path.splitext(src)[1]}"
                shutil.copy(src, os.path.join(PUBLIC, nom))
                v = {**v, "src": nom}
            else:
                v = {"type": "carte", "titre": g.get("titre") or (hook if i == 0 else "")}
        if v.get("type") == "carte" and not v.get("titre"):
            v["titre"] = g.get("titre") or hook
        g["visuel"] = {k: x for k, x in v.items() if x is not None}
    return segs


# ---------------------------------------------------------------- découpage en scènes
APPEL = re.compile(r"^(et toi|et vous|dis[- ]moi|abonne)|\?$", re.I)


def decouper_scenes(segs, max_lettres=95):
    """Une scène ne doit pas durer trop longtemps sur le même visuel (style motion : ça bouge tout le temps).
    - la question au public + « Abonne-toi » passent dans une scène « question » à part
    - un segment trop long est coupé en deux à la fin d'une phrase (2e moitié : nouveau visuel)"""
    res = []
    for g in segs:
        phrases = [p for p in re.split(r"(?<=[.!?])\s+", g["texte"].strip()) if p]
        k = next((i for i, p in enumerate(phrases) if APPEL.search(p.replace("*", "").strip())), None)
        if k is not None and k > 0:
            corps, appel = phrases[:k], phrases[k:]
        else:
            corps, appel = phrases, []
        if k == 0 and not g.get("visuel"):
            g = {**g, "visuel": {"type": "question"}}
        morceaux = [corps]
        if len(" ".join(corps)) > max_lettres and len(corps) >= 2:
            total, acc, cut = len(" ".join(corps)), 0, 1
            for i, p in enumerate(corps[:-1]):
                acc += len(p) + 1
                if acc >= total / 2:
                    cut = i + 1; break
                cut = i + 1
            morceaux = [corps[:cut], corps[cut:]]
        for j, m in enumerate(morceaux):
            if not m:
                continue
            if j == 0:
                res.append({**g, "texte": " ".join(m)})
            else:
                res.append({"texte": " ".join(m), "etiquette": g.get("etiquette", ""), "suite": True})
        if appel:
            res.append({"texte": " ".join(appel), "etiquette": "", "visuel": {"type": "question"}})
    return res


# ---------------------------------------------------------------- props + rendu
def construire_props(script_path, voix=None, total=None):
    s = json.load(open(script_path, encoding="utf-8"))
    segs = decouper_scenes([dict(g) for g in (s.get("segments") or [{"texte": s.get("texte", ""), "titre": s.get("titre_ecran", "")}])])
    mots = mots_du_script(segs)
    al = None
    if voix:
        js = os.path.splitext(voix)[0] + ".json"
        if os.path.exists(js):
            al = json.load(open(js, encoding="utf-8"))
        total = duree_audio(voix)
    temps = caler(mots, al, total)
    liste = [{"w": w, "start": round(a, 3), "end": round(b, 3), "cle": c, "seg": i}
             for (w, c, i), (a, b) in zip(mots, temps)]
    fin_voix = max(total, liste[-1]["end"] + 0.3) if liste else total
    preparer_visuels(segs, s.get("hook", ""), os.path.basename(script_path))
    segments = []
    for i, g in enumerate(segs):
        ms = [m for m in liste if m["seg"] == i]
        segments.append({"titre": g.get("titre", ""), "texte": g["texte"], "etiquette": g.get("etiquette", ""),
                         "visuel": g["visuel"],
                         "start": 0 if i == 0 else round(max(0, ms[0]["start"] - 0.12), 3) if ms else 0,
                         "end": ms[-1]["end"] if ms else fin_voix})
    return {"hook": s.get("hook", "LE FLASH"), "segments": segments, "mots": liste,
            "finVoix": round(fin_voix + 0.25, 3), "duree": round(fin_voix + 0.25 + OUTRO, 3)}


def choisir_musique():
    m = sorted(glob.glob(os.path.join(ICI, "musique", "*.mp3")))
    return random.choice(m) if m else None


def rendre(script_path, voix, sortie, demo=False):
    os.makedirs(PUBLIC, exist_ok=True)
    shutil.rmtree(os.path.join(PUBLIC, "images"), ignore_errors=True)
    props = construire_props(script_path, None if demo else voix, total=26 if demo else None)
    if not demo:
        shutil.copy(voix, os.path.join(PUBLIC, "voix.mp3"))
        props["voix"] = "voix.mp3"
        mus = choisir_musique()
        if mus:
            shutil.copy(mus, os.path.join(PUBLIC, "musique.mp3"))
            props["musique"] = "musique.mp3"
            props["volumeMusique"] = float(os.environ.get("VOLUME_MUSIQUE", "0.10"))
    chemin_props = os.path.join(PUBLIC, "props.json")
    json.dump(props, open(chemin_props, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    if not os.path.isdir(os.path.join(MOTION, "node_modules")):
        subprocess.check_call(["npm", "ci", "--no-audit", "--no-fund"], cwd=MOTION)
    cmd = ["npx", "remotion", "render", "src/index.ts", "Flash", os.path.abspath(sortie),
           f"--props={chemin_props}", "--codec=h264", "--crf=18", "--audio-bitrate=192k"]
    if os.environ.get("REMOTION_CONCURRENCY"):
        cmd.append(f"--concurrency={os.environ['REMOTION_CONCURRENCY']}")
    if os.environ.get("CHROME_PATH"):
        cmd.append(f"--browser-executable={os.environ['CHROME_PATH']}")
    if os.environ.get("REMOTION_FRAMES"):  # ex. 0-90 pour un test rapide
        cmd.append(f"--frames={os.environ['REMOTION_FRAMES']}")
    subprocess.check_call(cmd, cwd=MOTION)
    return sortie


if __name__ == "__main__":
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    if "--demo" in sys.argv:
        rendre(a[0], None, a[1], demo=True)
    else:
        rendre(a[0], a[1], a[2])
