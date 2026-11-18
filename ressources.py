#!/usr/bin/env python3
"""Télécharge (avec cache) les ressources de fond, pendant le run GitHub Actions :
  - clips/gta6/ : captures officielles GTA 6 publiées par Rockstar sur rockstargames.com/VI
  - musique/    : musiques libres de droits de Kevin MacLeod (incompetech.com, licence CC BY 4.0)
  - videos/trailers/ : trailers officiels Rockstar (YouTube), IMAGE SEULE, sans la bande-son
                      (la musique des trailers déclencherait Content ID)
Rien n'est versionné dans le dépôt (voir .gitignore)."""
import os, re, urllib.request

ICI = os.path.dirname(os.path.abspath(__file__))
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}
PAGES = ["https://www.rockstargames.com/VI/media", "https://www.rockstargames.com/VI/launch-gallery",
         "https://www.rockstargames.com/VI/only-in-leonida", "https://www.rockstargames.com/VI/"]
# captures nommées « Lieu_ou_Perso_NN » (pas les affiches, logos ni éditions)
MOTIF = re.compile(r"/VI/_next/static/media/((?:[A-Z][A-Za-z]+_)+\d{2})\.[A-Za-z0-9_\-~.]+?\.jpg")
EXCLURE = re.compile(r"EDITION|PACK|Cover|Pre_Load|poster|FOB", re.I)
MUSIQUES = ["Hitman", "Volatile Reaction", "Movement Proposition", "Neon Laser Horizon",
            "Raving Energy", "Ouroboros"]


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r:
        return r.read()


def images(dossier, maxi=80):
    os.makedirs(dossier, exist_ok=True)
    vus = {}
    for p in PAGES:
        try:
            html = get(p).decode("utf-8", "ignore")
        except Exception as e:
            print("page ignorée", p, e); continue
        for m in MOTIF.finditer(html):
            if not EXCLURE.search(m.group(1)):
                vus.setdefault(m.group(1), "https://www.rockstargames.com" + m.group(0))
    n = 0
    for nom, url in sorted(vus.items())[:maxi]:
        f = os.path.join(dossier, nom + ".jpg")
        if not os.path.exists(f):
            try:
                open(f, "wb").write(get(url)); n += 1
            except Exception as e:
                print("image ignorée", nom, e)
    print(f"Captures GTA 6 : {len(os.listdir(dossier))} en cache ({n} nouvelles)")


TRAILERS = {"trailer1": "QdBZY2fkU-0", "trailer2": "VQRLujxTm3c", "lancement": "rz1B4B2yBZY"}


def trailers(dossier):
    """Trailers officiels en vidéo seule (yt-dlp). Un échec n'arrête pas la production."""
    import subprocess
    os.makedirs(dossier, exist_ok=True)
    for nom, vid in TRAILERS.items():
        f = os.path.join(dossier, nom + ".mp4")
        if os.path.exists(f):
            continue
        try:  # 1) copie déposée par le PC de Medley dans la release « ressources » du dépôt
            open(f, "wb").write(get(f"https://github.com/Derar92110/le-flash/releases/download/ressources/{nom}.mp4"))
            continue
        except Exception as e:
            if os.path.exists(f): os.remove(f)
            print("release : pas de", nom, e)
        try:  # 2) YouTube (souvent refusé depuis les serveurs GitHub)
            subprocess.run(["yt-dlp", "-q", "--no-warnings", "-f",
                            "bv*[height<=1080][ext=mp4]/bv*[height<=1080]", "--remux-video", "mp4",
                            "-o", f, "https://www.youtube.com/watch?v=" + vid], check=True, timeout=900)
        except Exception as e:
            print("trailer ignoré", nom, e)
    print("Trailers :", len([x for x in os.listdir(dossier) if x.endswith(".mp4")]))


def musiques(dossier):
    os.makedirs(dossier, exist_ok=True)
    for t in MUSIQUES:
        f = os.path.join(dossier, t + ".mp3")
        if not os.path.exists(f):
            try:
                open(f, "wb").write(get("https://incompetech.com/music/royalty-free/mp3-royaltyfree/"
                                        + urllib.request.quote(t) + ".mp3"))
            except Exception as e:
                print("musique ignorée", t, e)
    print("Musiques :", len(os.listdir(dossier)))


if __name__ == "__main__":
    images(os.path.join(ICI, "clips", "gta6"))
    musiques(os.path.join(ICI, "musique"))
    trailers(os.path.join(ICI, "videos", "trailers"))
