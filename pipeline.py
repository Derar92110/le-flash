#!/usr/bin/env python3
"""Le Flash : traite tous les scripts en attente, de bout en bout.

Pour chaque scripts/NNN.json qui n'a pas encore de sorties/NNN.mp4 :
  1. génère la voix off via l'API ElevenLabs (voix/NNN.mp3)
  2. monte la vidéo (Short vertical ou vidéo longue) avec make_short.py
  3. si AUTO_UPLOAD=1 et client_secret.json présent : envoie sur YouTube en PRIVÉ
     (tu vérifies puis tu passes en public)

Configuration : fichier .env à côté de ce script (créé par installer.bat depuis config-exemple.txt).
Usage : python pipeline.py            (traite tout)
        python pipeline.py 004        (un seul script)
"""
import json, os, re, subprocess, sys, urllib.request

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
import make_short  # noqa: E402



def pause(sec):
    return f' <break time="{sec}s" /> '


def respirer(texte):
    """Pauses naturelles dans un segment (style motion) : après « Un : », entre les phrases, avant l'appel à l'action."""
    t = texte.strip()
    # « Un : », « Deux : », « Dernier point : »… on marque le temps avant l'info
    t = re.sub(r"^((?:Un|Deux|Trois|Quatre|Cinq|Premier point|Dernier point|Bonus)\s*:)\s*", lambda m: m.group(1) + pause(0.45), t, flags=re.I)
    # appel à l'action : une respiration plus longue avant
    t = re.sub(r"([.!?…])\s+(?=(?:Et toi|Et vous|Abonne|Dis-moi|Dites-moi))", lambda m: m.group(1) + pause(0.6), t)
    # entre deux phrases du même point
    t = re.sub(r"([.!?…])\s+(?=[A-ZÀ-ÖØ-Þ*])", lambda m: m.group(1) + pause(0.35), t)
    return t

def charger_env():
    env = dict(os.environ)  # GitHub Actions : secrets passés en variables d environnement
    p = os.path.join(ICI, ".env")
    if os.path.exists(p):
        for l in open(p, encoding="utf-8"):
            l = l.strip()
            if l and not l.startswith("#") and "=" in l:
                k, v = l.split("=", 1)
                env[k.strip()] = v.strip().strip('"')
    return env


def voix_off(texte, sortie, env):
    """Voix ElevenLabs + horodatage mot par mot (voix/NNN.json) pour caler les sous-titres."""
    import base64
    cle = env.get("ELEVENLABS_API_KEY")
    if not cle:
        sys.exit("ELEVENLABS_API_KEY manquante")
    voice = env.get("ELEVENLABS_VOICE_ID", "3Tp5mYhT9wrfnry9pzvV")  # Hugo
    model = env.get("ELEVENLABS_MODEL", "eleven_multilingual_v2")
    corps = json.dumps({"text": texte, "model_id": model,
                        "voice_settings": {"stability": 0.4, "similarity_boost": 0.8,
                                           "style": 0.4, "speed": float(env.get("ELEVENLABS_SPEED", "1.0"))}}).encode()
    entetes = {"xi-api-key": cle, "Content-Type": "application/json"}
    base = f"https://api.elevenlabs.io/v1/text-to-speech/{voice}"
    try:
        req = urllib.request.Request(base + "/with-timestamps?output_format=mp3_44100_128",
                                     data=corps, headers=entetes)
        with urllib.request.urlopen(req, timeout=300) as r:
            rep = json.loads(r.read())
        open(sortie, "wb").write(base64.b64decode(rep["audio_base64"]))
        al = rep.get("alignment") or rep.get("normalized_alignment")
        if al:
            json.dump(al, open(os.path.splitext(sortie)[0] + ".json", "w", encoding="utf-8"))
        return
    except Exception as e:  # repli : voix sans horodatage
        print("Horodatage indisponible, voix simple :", e)
    req = urllib.request.Request(base + "?output_format=mp3_44100_128", data=corps,
                                 headers={**entetes, "Accept": "audio/mpeg"})
    with urllib.request.urlopen(req, timeout=300) as r, open(sortie, "wb") as f:
        f.write(r.read())


def main():
    env = charger_env()
    d = lambda *p: os.path.join(ICI, *p)
    for sous in ("scripts", "voix", "sorties", "clips"):
        os.makedirs(d(sous), exist_ok=True)
    ids = sorted(f[:-5] for f in os.listdir(d("scripts")) if f.endswith(".json"))
    if len(sys.argv) > 1:
        ids = [i for i in ids if i == sys.argv[1]]
    os.makedirs(d("publies"), exist_ok=True)
    for i in ids:
        video = d("sorties", f"{i}.mp4")
        if os.path.exists(video) or os.path.exists(d("publies", f"{i}.txt")):
            continue
        s = json.load(open(d("scripts", f"{i}.json"), encoding="utf-8"))
        if s.get("segments") and not s.get("texte"):
            if (s.get("style") or env.get("STYLE") or "").lower() == "motion":
                # motion : une vraie respiration entre deux infos (voix moins précipitée)
                s["texte"] = f' <break time="{env.get("PAUSE_SEGMENTS", "0.9")}s" /> '.join(respirer(g["texte"]) for g in s["segments"])
            else:
                s["texte"] = " ".join(g["texte"] for g in s["segments"])
        mp3 = d("voix", f"{i}.mp3")
        if not os.path.exists(mp3):
            print(f"[{i}] voix off…"); voix_off(s["texte"].replace("*", ""), mp3, env)
        clips = d("clips", s.get("clips", ""))  # sous-dossier optionnel par script (images + vidéos)
        style = (s.get("style") or env.get("STYLE") or "").lower()
        print(f"[{i}] montage ({s.get('format', 'short')}, style {style or 'défaut'})…")
        if style == "motion" and s.get("format", "short") == "short":
            import motion_render  # motion design Remotion (dossier motion/)
            motion_render.rendre(d("scripts", f"{i}.json"), mp3, video)
        else:
            make_short.rendre(d("scripts", f"{i}.json"), mp3, clips, video)
        if env.get("AUTO_UPLOAD") == "1" and os.path.exists(d("client_secret.json")):
            print(f"[{i}] envoi YouTube…")
            subprocess.check_call([sys.executable, d("upload_youtube.py"), video,
                                   d("scripts", f"{i}.json"), "--id-file", d("publies", f"{i}.txt"),
                                   "--visibilite", env.get("PUBLICATION", "public")])
    print("Terminé.")


if __name__ == "__main__":
    main()
