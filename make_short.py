#!/usr/bin/env python3
"""Le Flash : monte un Short vertical (1080x1920) ou une vidéo longue (1920x1080)
à partir d'une voix off, d'un script et d'images/clips de fond.

Usage :
  python3 make_short.py scripts/001.json voix/001.mp3 clips/ sorties/001.mp4

- scripts/001.json : {"format": "short"|"long", "titre", "hook", "segments"|"texte", ...}
- voix/001.mp3     : voix off ElevenLabs. Si voix/001.json existe (horodatage mot par
                     mot renvoyé par l'API), les sous-titres sont calés au mot près.
- clips/           : images (.jpg .png .webp) et/ou vidéos (.mp4 .mov ...) de fond.
                     Vide -> fond animé aux couleurs de la chaîne.

Montage « rétention » :
  - plans de 1,3 à 2,2 s avec zoom lent (Ken Burns) et changement de cadrage
  - sous-titres 1 à 3 mots, mot prononcé en couleur, apparition en « pop »
  - flash blanc + « whoosh » à chaque nouvelle info, compteur 1/3, étiquette de source
  - barre de progression en bas, musique libre de droits (dossier musique/) baissée sous la voix
Dépendances : ffmpeg (avec libass), Python 3.
"""
import json, math, os, random, re, shutil, subprocess, sys, tempfile

W, H = 1080, 1920
ICI = os.path.dirname(os.path.abspath(__file__))
MARQUE = os.path.join(ICI, "marque")
IMG = (".jpg", ".jpeg", ".png", ".webp")
VID = (".mp4", ".mov", ".mkv", ".webm")


def charte():
    p = os.path.join(MARQUE, "charte.json")
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}


def ass_col(hexa):
    h = hexa.lstrip("#")
    return f"&H00{h[4:6]}{h[2:4]}{h[0:2]}".upper()


def regler_format(fmt):
    global W, H
    W, H = (1920, 1080) if fmt == "long" else (1080, 1920)


def duree(path):
    return float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=nw=1:nk=1", path]).decode().strip())


def ff(*args, cwd=None):
    subprocess.check_call(["ffmpeg", "-y", "-v", "error", *args], cwd=cwd)


def ts(t):
    t = max(t, 0)
    h, r = divmod(t, 3600); m, s = divmod(r, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


# ---------------------------------------------------------------- mots et timing
def mots_du_script(texte):
    """Liste de (mot, est_mot_cle) dans l'ordre, à partir du texte avec *mots clés*."""
    out, cle = [], False
    for brut in texte.split():
        debut, fin = brut.startswith("*"), brut.rstrip(".,!?:;»\"'").endswith("*")
        if debut:
            cle = True
        out.append((brut.replace("*", ""), cle or debut))
        if fin:
            cle = False
    return out


def timings(mots, total, alignement=None):
    """[(debut, fin)] par mot : depuis l'horodatage ElevenLabs si dispo, sinon au prorata."""
    if alignement:
        ch = alignement["characters"]; d0 = alignement["character_start_times_seconds"]
        d1 = alignement["character_end_times_seconds"]
        res, cur = [], None
        for c, a, b in zip(ch, d0, d1):
            if c.isspace():
                if cur: res.append(cur); cur = None
            else:
                cur = [a, b] if cur is None else [cur[0], b]
        if cur: res.append(cur)
        if len(res) == len(mots):
            return [tuple(r) for r in res]
        print(f"(alignement ignoré : {len(res)} mots audio pour {len(mots)} mots texte)")
    poids = [len(m) + 2 for m, _ in mots]; s = sum(poids); t = 0.0; res = []
    for p in poids:
        d = total * p / s; res.append((t, t + d)); t += d
    return res


def groupes(mots, n=5, maxi=24):
    """Regroupe les mots en sous-titres lisibles : une idée courte, coupure sur la ponctuation."""
    g, cur = [], []
    for i, (m, cle) in enumerate(mots):
        meme_cle = cur and cle and mots[cur[-1]][1]
        if cur and not meme_cle and len(" ".join(mots[j][0] for j in cur + [i])) > maxi:
            g.append(cur); cur = []
        cur.append(i)
        suivant_cle = i + 1 < len(mots) and cle and mots[i + 1][1]
        if (len(cur) >= n and not suivant_cle) or re.search(r"[.!?:;]$", m):
            g.append(cur); cur = []
    if cur: g.append(cur)
    return g


def propre(t):
    return t.upper().replace("\\", "").replace("{", "(").replace("}", ")")


# ---------------------------------------------------------------- sous-titres ASS
def ecrire_ass(path, s, mots, tms, bornes_segments, total, c, long_format):
    police = c.get("police", "Anton"); bandeau = c.get("police_bandeau", police)
    blanc = ass_col(c.get("couleur_texte", "#ffffff")); noir = ass_col(c.get("couleur_contour", "#000000"))
    bleu = ass_col(c.get("couleur_mot_cle", "#1f6bff")); rouge = ass_col(c.get("couleur_hook_fond", "#ff2d3d"))
    fs = 80 if long_format else 112
    y_sub = int(H * (0.78 if long_format else 0.62))
    y_etiq = int(H * (0.10 if long_format else 0.12))
    L = []
    # sous-titres : 1 ou 2 lignes, mot prononcé surligné en bleu, mot clé en rouge
    for ng, g in enumerate(groupes(mots, 6 if long_format else 5, 30 if long_format else 24)):
        g_debut = tms[g[0]][0]
        g_fin = tms[g[-1]][1]
        suiv = [tms[i][0] for i in range(g[-1] + 1, len(mots))]
        g_fin = max(g_fin, min(suiv[0], g_fin + 0.5) if suiv else total)
        # coupure en 2 lignes équilibrées si le groupe est long
        lg = [len(mots[j][0]) for j in g]
        coupe = None
        if sum(lg) + len(g) > 14 and len(g) > 1:
            cumul, moitie = 0, (sum(lg) + len(g)) / 2
            for k, x in enumerate(lg[:-1]):
                cumul += x + 1
                if cumul >= moitie:
                    coupe = k; break
            coupe = len(g) // 2 - 1 if coupe is None else coupe
        rot = ("\\frz1.5" if ng % 2 else "\\frz-1.5")
        for k, i in enumerate(g):
            a = tms[i][0] if k else g_debut
            b = tms[g[k + 1]][0] if k + 1 < len(g) else g_fin
            if b - a < 0.02:
                continue
            txt_l = []
            for kk, j in enumerate(g):
                m, cle = mots[j]
                t = propre(m)
                if j == i:
                    t = "{\\3c" + bleu + "&\\bord16\\shad0}" + t + "{\\r}"
                elif cle:
                    t = "{\\1c" + rouge + "&}" + t + "{\\r}"
                txt_l.append(t + ("\\N" if kk == coupe else " "))
            pop = "\\fscx75\\fscy75\\t(0,110,\\fscx105\\fscy105)\\t(110,190,\\fscx100\\fscy100)" if k == 0 else ""
            L.append(f"Dialogue: 5,{ts(a)},{ts(b)},Main,,0,0,0,,{{\\an5\\pos({W // 2},{y_sub}){rot}{pop}}}" + "".join(txt_l).strip())
    # titre de chaque info : bandeau qui glisse depuis la gauche
    y_titre = int(H * (0.20 if long_format else 0.19))
    for g, (t0, t1) in zip(s.get("segments") or [], bornes_segments):
        if g.get("titre"):
            tt = propre(g["titre"])
            L.append(f"Dialogue: 4,{ts(t0)},{ts(t1)},Titre,,0,0,0,,"
                     f"{{\\an5\\move({-W // 2},{y_titre},{W // 2},{y_titre},0,220)\\fad(0,150)}}{tt}")
    # hook : bandeau rouge qui claque sur les 2 premières secondes
    hook = propre(s.get("hook", ""))
    if hook:
        L.append(f"Dialogue: 6,{ts(0)},{ts(min(2.2, total))},Hook,,0,0,0,,"
                 f"{{\\an5\\pos({W // 2},{int(H * (0.30 if long_format else 0.33))})"
                 f"\\fscx160\\fscy160\\t(0,150,\\fscx100\\fscy100)\\fad(0,150)}}{hook}")
    # étiquettes, compteur, flashs blancs
    etiqs = c.get("etiquettes", {})
    segs = s.get("segments") or []
    numeros = [g for g in segs if not g.get("sans_numero")]
    n_info = 0
    for k, (g, (t0, t1)) in enumerate(zip(segs or [s], bornes_segments)):
        e = (g.get("etiquette") or "").upper()
        if e in etiqs:
            L.append(f"Dialogue: 4,{ts(t0)},{ts(t1)},Etiquette,,0,0,0,,{{\\an7\\pos(50,{y_etiq})"
                     f"\\3c{ass_col(etiqs[e]['fond'])}&\\1c{ass_col(etiqs[e]['texte'])}&"
                     f"\\fscx60\\fscy60\\t(0,120,\\fscx100\\fscy100)}}{e}")
        if segs and len(segs) > 2 and 0 < k and re.match(r"^\s*(un|deux|trois|quatre|cinq|1|2|3|4|5)\b", g["texte"], re.I):
            n_info += 1
            nb = sum(1 for x in segs if re.match(r"^\s*(un|deux|trois|quatre|cinq|1|2|3|4|5)\b", x["texte"], re.I))
            L.append(f"Dialogue: 4,{ts(t0)},{ts(t1)},Compteur,,0,0,0,,{{\\an9\\pos({W - 50},{y_etiq})"
                     f"\\fscx60\\fscy60\\t(0,120,\\fscx100\\fscy100)}}{n_info}/{nb}")
        if k > 0:  # flash blanc au changement d'info
            L.append(f"Dialogue: 3,{ts(t0)},{ts(t0 + 0.25)},Dessin,,0,0,0,,{{\\an7\\pos(0,0)\\1c&HFFFFFF&"
                     f"\\alpha&H60&\\t(0,250,\\alpha&HFF&)\\p1}}m 0 0 l {W} 0 {W} {H} 0 {H}")
    # barre de progression
    L.append(f"Dialogue: 7,{ts(0)},{ts(total)},Dessin,,0,0,0,,{{\\an7\\pos(0,{H - 16})\\1c{bleu}&"
             f"\\fscx0\\t(0,{int(total * 1000)},\\fscx100)\\p1}}m 0 0 l {W} 0 {W} 16 0 16")
    entete = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 1

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Main,{police},{fs},{blanc},{blanc},{noir},&H90000000,0,0,0,0,100,100,2,0,1,10,5,5,50,50,0,1
Style: Titre,{bandeau},{70 if long_format else 92},&H00FFFFFF,&H00FFFFFF,{bleu},&H00000000,0,0,0,0,100,100,4,0,3,18,0,5,0,0,0,1
Style: Hook,{bandeau},{fs},&H00FFFFFF,&H00FFFFFF,{rouge},&H00000000,0,0,0,0,100,100,3,0,3,22,0,5,40,40,0,1
Style: Etiquette,{bandeau},{60 if long_format else 78},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,3,0,3,14,0,7,0,0,0,1
Style: Compteur,{bandeau},{60 if long_format else 78},&H00FFFFFF,&H00FFFFFF,{rouge},&H00000000,0,0,0,0,100,100,3,0,3,14,0,9,0,0,0,1
Style: Dessin,Arial,10,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(entete + "\n".join(L) + "\n")


# ---------------------------------------------------------------- fond animé
def fond(clips_dir, total, tmp, coupes, c, graine=0):
    medias = []
    if clips_dir and os.path.isdir(clips_dir):
        for racine, _, fichiers in os.walk(clips_dir):
            medias += [os.path.join(racine, x) for x in sorted(fichiers) if x.lower().endswith(IMG + VID)]
    out = os.path.join(tmp, "fond.mp4")
    if not medias:
        c1 = c.get("couleur_fond", "#070b1a").lstrip("#"); c2 = c.get("couleur_mot_cle", "#1f6bff").lstrip("#")
        ff("-f", "lavfi", "-i", f"gradients=s={W}x{H}:c0=0x{c1}:c1=0x{c2}:c2=0x{c1}:c3=0x{c.get('couleur_hook_fond', '#ff2d3d').lstrip('#')}"
           f":nb_colors=4:speed=0.015:d={total}:r=30",
           "-vf", "eq=brightness=-0.25:saturation=1.2,noise=alls=10:allf=t,vignette=PI/4",
           "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", out)
        return out
    rnd = random.Random(graine)
    rnd.shuffle(medias)
    # durées de plans : coupe obligatoire à chaque nouvelle info, sinon toutes les 1,3 à 2,2 s
    bornes, t = [0.0], 0.0
    coupes = sorted(x for x in coupes if 0.5 < x < total - 0.5)
    while t < total:
        nxt = t + rnd.uniform(2.4, 3.2)
        prochaines = [x for x in coupes if t + 1.0 < x <= nxt + 0.8]
        t = prochaines[0] if prochaines else nxt
        bornes.append(min(t, total))
    bornes = [x for k, x in enumerate(bornes) if k == 0 or x - bornes[k - 1] > 0.4 or k == len(bornes) - 1]
    T = 0.3  # durée des transitions
    parts, debuts = [], []
    plans = list(zip(bornes, bornes[1:]))
    for i, (a, b) in enumerate(plans):
        d = (b - a) + (T if i < len(plans) - 1 else 0)  # chaque plan déborde sous la transition
        debuts.append(a)
        m = medias[i % len(medias)]
        p = os.path.join(tmp, f"p{i:03d}.mp4")
        n = max(int(round(d * 30)), 2)
        est_img = m.lower().endswith(IMG)
        z0, z1 = (1.0, 1.07) if rnd.random() < 0.6 else (1.07, 1.0)
        px = rnd.choice([0.3, 0.5, 0.7])
        zoom = f"{z0}+({z1}-{z0})*on/{n}"
        teinte = "eq=contrast=1.06:saturation=1.12"
        try:
            iw, ih = map(int, subprocess.check_output([
                "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                "-of", "csv=p=0", m]).decode().split(",")[:2])
        except Exception:
            iw, ih = 16, 9
        if H > W and iw > ih:
            # image paysage dans un Short : image entière en largeur, fond flouté derrière
            fh = int(W * ih / iw) // 2 * 2
            yc = int(H * 0.40 - fh / 2)
            filtre = (f"[0:v]split[a][b];"
                      f"[a]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1,"
                      f"boxblur=28:2,eq=brightness=-0.22:saturation=1.15[bg];"
                      f"[b]scale={W * 2}:{fh * 2},setsar=1,zoompan=z='{zoom}':x='(iw-iw/zoom)*{px}':"
                      f"y='(ih-ih/zoom)/2':d={n if est_img else 1}:s={W}x{fh}:fps=30,{teinte}[fg];"
                      f"[bg][fg]overlay=0:{yc}:shortest=1,fps=30,format=yuv420p[v]")
        else:
            filtre = (f"[0:v]scale={W * 2}:{H * 2}:force_original_aspect_ratio=increase,crop={W * 2}:{H * 2},"
                      f"setsar=1,zoompan=z='{zoom}':x='(iw-iw/zoom)*{px}':y='(ih-ih/zoom)/2':"
                      f"d={n if est_img else 1}:s={W}x{H}:fps=30,{teinte},vignette=PI/5,format=yuv420p[v]")
        if est_img:
            ff("-loop", "1", "-i", m, "-filter_complex", filtre, "-map", "[v]",
               "-frames:v", str(n), "-c:v", "libx264", "-preset", "veryfast", "-r", "30", p)
        else:
            dm = duree(m); debut = rnd.uniform(0, max(dm - d - 0.1, 0))
            ff("-ss", f"{debut:.2f}", "-i", m, "-t", f"{d:.3f}", "-an", "-filter_complex",
               filtre.replace("[0:v]", "[0:v]fps=30,", 1), "-map", "[v]",
               "-frames:v", str(n), "-c:v", "libx264", "-preset", "veryfast", "-r", "30", p)
        parts.append(p)
    if len(parts) == 1:
        shutil.copy(parts[0], out); return out
    # transitions : glissement à chaque nouvelle info, fondu rapide sinon
    entrees, chaine, prec = [], [], "[0:v]"
    for x in parts:
        entrees += ["-i", x]
    for j in range(1, len(parts)):
        nouvelle_info = any(abs(debuts[j] - x) < 0.05 for x in coupes)
        tr = "slideleft" if nouvelle_info else rnd.choice(["fade", "fade", "smoothup", "circleopen"])
        sortie_j = "[v]" if j == len(parts) - 1 else f"[x{j}]"
        chaine.append(f"{prec}[{j}:v]xfade=transition={tr}:duration={T}:offset={debuts[j]:.3f}{sortie_j}")
        prec = sortie_j
    ff(*entrees, "-filter_complex", ";".join(chaine), "-map", "[v]", "-c:v", "libx264",
       "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", "30", out)
    return out



# ---------------------------------------------------------------- style « brut » (16/11/2026, demande de Medley)
# Extraits vidéo des trailers Rockstar plein écran, coupes franches, sous-titres blancs
# sans bloc de couleur, petites mentions (édition, étiquette, crédit des images).
VIDEOS = os.path.join(ICI, "videos")
ROUGE_POINT = {"OFFICIEL": "&H00FFFFFF", "RUMEUR": "&H003D2DFF", "LEAK": "&H0000C8FF"}


def style_actif(s, c):
    return (s.get("style") or os.environ.get("STYLE") or c.get("style") or "v5").lower()


def ecrire_ass_brut(path, s, mots, tms, bornes_segments, total, c):
    blanc, noir = "&H00FFFFFF", "&H00000000"
    y_sub = int(H * 0.56)
    L = []
    gs = groupes(mots, 7, 30)
    for k in range(len(gs) - 2, -1, -1):  # « Un : » seul -> collé à la suite
        if len(gs[k]) == 1 and mots[gs[k][0]][0].endswith(":"):
            gs[k:k + 2] = [gs[k] + gs[k + 1]]
    for g in gs:
        a = tms[g[0]][0]; b = tms[g[-1]][1]
        suiv = [tms[i][0] for i in range(g[-1] + 1, len(mots))]
        b = max(b, min(suiv[0], b + 0.4) if suiv else total)
        txt = [mots[j][0].replace("\\", "").replace("{", "(").replace("}", ")") for j in g]
        lg = [len(x) for x in txt]
        coupe = None
        if sum(lg) + len(g) > 22 and len(g) > 1:  # 2 lignes équilibrées
            coupe = min(range(len(g) - 1), key=lambda k: max(sum(lg[:k + 1]) + k, sum(lg[k + 1:]) + len(g) - k - 2))
        ligne = "".join(x + ("\\N" if k == coupe else " ") for k, x in enumerate(txt)).strip()
        L.append(f"Dialogue: 5,{ts(a)},{ts(b)},Sous,,0,0,0,,{{\\an5\\pos({W // 2},{y_sub})\\fad(60,0)}}{ligne}")
    # fait choc en gros dès la 1re image (23/11/2026, demande de Medley : 50 % de swipe au début)
    choc = (s.get("choc") or "").replace("{", "(").replace("}", ")").upper()
    if choc:
        L.append(f"Dialogue: 6,{ts(0)},{ts(min(2.6, total))},Choc,,0,0,0,,"
                 f"{{\\an5\\pos({W // 2},{int(H * 0.30)})\\fscx118\\fscy118\\t(0,140,\\fscx100\\fscy100)\\fad(0,180)}}{choc}")
    # mentions discrètes en haut à gauche : édition (hook) puis étiquette de l'info
    hook = (s.get("hook") or "").replace("{", "(").replace("}", ")")
    if hook:
        L.append(f"Dialogue: 4,{ts(0)},{ts(total)},Mention,,0,0,0,,{{\\an7\\pos(56,118)}}{hook}")
    for g, (t0, t1) in zip(s.get("segments") or [], bornes_segments):
        e = (g.get("etiquette") or "").upper()
        if e in ROUGE_POINT:
            L.append(f"Dialogue: 4,{ts(t0)},{ts(t1)},Mention,,0,0,0,,{{\\an7\\pos(56,178)\\fad(120,0)}}"
                     f"{{\\1c{ROUGE_POINT[e]}}}●{{\\1c{blanc}}} {e}")
    credit = s.get("credit_images") or c.get("credit_images") or "Images : Rockstar Games"
    L.append(f"Dialogue: 4,{ts(0)},{ts(total)},Credit,,0,0,0,,{{\\an1\\pos(56,{int(H * 0.79)})}}{credit}")
    entete = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 1

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sous,Poppins,74,{blanc},{blanc},&H64000000,&H8C000000,1,0,0,0,100,100,0,0,1,2,4,5,70,70,0,1
Style: Mention,Poppins,40,{blanc},{blanc},&H64000000,&H8C000000,1,0,0,0,100,100,1,0,1,1.5,3,7,0,0,0,1
Style: Choc,Poppins,96,{blanc},{blanc},&H00000000,&H00000000,1,0,0,0,100,100,0,0,3,18,0,5,60,60,0,1
Style: Credit,Poppins,30,&H33FFFFFF,&H33FFFFFF,&H64000000,&H8C000000,1,0,0,0,100,100,0,0,1,1,2,1,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(entete + "\n".join(L) + "\n")


def zone_utile(v, dv):
    """Retire les bandes noires « cinéma » des trailers (cropdetect sur 3 passages)."""
    hauteurs = []
    for f in (0.3, 0.5, 0.7):
        try:
            err = subprocess.run(["ffmpeg", "-ss", f"{dv * f:.1f}", "-i", v, "-t", "2", "-vf",
                                  "cropdetect=limit=24:round=2:reset=0", "-f", "null", "-"],
                                 capture_output=True, text=True).stderr
            m = re.findall(r"crop=(\d+):(\d+):(\d+):(\d+)", err)
            if m:
                hauteurs.append(tuple(map(int, m[-1])))
        except Exception:
            pass
    if not hauteurs:
        return ""
    w, h, x, y = max(hauteurs, key=lambda c: c[1] * c[0])  # la zone la plus grande vue
    return f"crop={w}:{h}:{x}:{y},"


def fond_brut(total, tmp, coupes, graine=0):
    """Extraits de trailers (sans leur son) recadrés en vertical, coupes franches de 1,6 à 2,6 s."""
    vids = []
    for racine, _, fichiers in os.walk(VIDEOS):
        vids += [os.path.join(racine, x) for x in sorted(fichiers) if x.lower().endswith(VID)]
    if not vids:
        return None
    rnd = random.Random(graine)
    durees = {v: duree(v) for v in vids}
    cadres = {v: zone_utile(v, durees[v]) for v in vids}
    bornes, t = [0.0], 0.0
    coupes = sorted(x for x in coupes if 0.5 < x < total - 0.5)
    while t < total:
        nxt = t + rnd.uniform(1.6, 2.6)
        prochaines = [x for x in coupes if t + 0.8 < x <= nxt + 0.6]
        t = prochaines[0] if prochaines else nxt
        bornes.append(min(t, total))
    bornes = [x for k, x in enumerate(bornes) if k == 0 or x - bornes[k - 1] > 0.4 or k == len(bornes) - 1]
    liste = os.path.join(tmp, "plans.txt")
    with open(liste, "w") as fl:
        for i, (a, b) in enumerate(zip(bornes, bornes[1:])):
            v = vids[i % len(vids)] if i < len(vids) else rnd.choice(vids)
            dv = durees[v]
            debut = rnd.uniform(min(12, dv * 0.15), max(dv - 15 - (b - a), 13))  # évite logos du début et générique
            p = os.path.join(tmp, f"b{i:03d}.mp4")
            n = max(int(round((b - a) * 30)), 2)
            z = rnd.choice([1.0, 1.0, 1.06])
            ff("-ss", f"{debut:.2f}", "-i", v, "-an", "-vf",
               f"fps=30,{cadres[v]}scale=-2:{int(H * z)},crop={W}:{H},setsar=1,"
               "eq=brightness=-0.06:contrast=1.05:saturation=1.08,vignette=PI/5,format=yuv420p",
               "-frames:v", str(n), "-c:v", "libx264", "-preset", "veryfast", "-r", "30", p)
            fl.write(f"file '{p}'\n")
    out = os.path.join(tmp, "fond.mp4")
    ff("-f", "concat", "-safe", "0", "-i", liste, "-c", "copy", out)
    return out

# ---------------------------------------------------------------- audio
def choisir_musique(graine):
    d = os.path.join(ICI, "musique")
    pistes = sorted(x for x in os.listdir(d) if x.lower().endswith((".mp3", ".wav", ".m4a"))) if os.path.isdir(d) else []
    return os.path.join(d, pistes[graine % len(pistes)]) if pistes else None


def bande_son(voix, total, coupes, tmp, musique=None, graine=0, vol_musique=0.22, gain_voix=1.0):
    """Voix + musique libre de droits discrète (baissée sous la voix) + whoosh aux coupes."""
    whoosh = os.path.join(tmp, "whoosh.wav")
    ff("-f", "lavfi", "-i", "anoisesrc=d=0.45:c=pink:a=0.9",
       "-af", "bandpass=f=1800:width_type=o:w=2,afade=t=in:d=0.25,afade=t=out:st=0.25:d=0.2,volume=0.6", whoosh)
    entrees = ["-i", voix]
    filt = [f"[0:a]aformat=channel_layouts=stereo,volume={gain_voix},asplit=2[v][vsc]"]
    noms = ["[v]"]
    k0 = 1
    if musique:
        debut = 0
        try:
            debut = random.Random(graine).uniform(0, max(duree(musique) - total - 2, 0))
        except Exception:
            pass
        entrees += ["-ss", f"{debut:.1f}", "-i", musique]
        filt.append(f"[1:a]aformat=channel_layouts=stereo,volume={vol_musique},afade=t=in:d=0.6,"
                    f"afade=t=out:st={max(total - 1.2, 0):.2f}:d=1.2[mu0]")
        filt.append("[mu0][vsc]sidechaincompress=threshold=0.04:ratio=6:attack=20:release=300[mu]")
        noms.append("[mu]")
        k0 = 2
    else:
        filt[0] = f"[0:a]aformat=channel_layouts=stereo,volume={gain_voix}[v]"
    for k, tc in enumerate(coupes):
        entrees += ["-i", whoosh]
        ms = max(int((tc - 0.2) * 1000), 0)
        filt.append(f"[{k + k0}:a]aformat=channel_layouts=stereo,adelay={ms}|{ms}[w{k}]")
        noms.append(f"[w{k}]")
    if len(noms) > 1:
        filt.append("".join(noms) + f"amix=inputs={len(noms)}:normalize=0:duration=first,alimiter=limit=0.95[a]")
    else:
        filt.append("[v]anull[a]")
    out = os.path.join(tmp, "audio.m4a")
    ff(*entrees, "-filter_complex", ";".join(filt), "-map", "[a]", "-t", f"{total:.3f}",
       "-c:a", "aac", "-b:a", "192k", out)
    return out


# ---------------------------------------------------------------- assemblage
def rendre(script_path, voix, clips_dir, sortie):
    s = json.load(open(script_path, encoding="utf-8"))
    long_format = s.get("format") == "long"
    regler_format("long" if long_format else "short")
    voix, sortie = os.path.abspath(voix), os.path.abspath(sortie)
    clips_dir = os.path.abspath(clips_dir) if clips_dir else None
    total = duree(voix)
    c = charte()
    segs = s.get("segments") or []
    texte = " ".join(g["texte"] for g in segs) if segs else s["texte"]
    mots = mots_du_script(texte)
    al_path = os.path.splitext(voix)[0] + ".json"
    alignement = json.load(open(al_path, encoding="utf-8")) if os.path.exists(al_path) else None
    tms = timings(mots, total, alignement)
    # bornes temporelles de chaque segment (info)
    bornes, i = [], 0
    for g in (segs or [{"texte": texte}]):
        n = len(g["texte"].split())
        a = tms[i][0] if i < len(tms) else total
        i += n
        bornes.append([a, None])
    for k in range(len(bornes)):
        bornes[k][1] = bornes[k + 1][0] if k + 1 < len(bornes) else total
    if bornes:
        bornes[0][0] = 0.0
    coupes = [b[0] for b in bornes[1:]]
    with tempfile.TemporaryDirectory() as tmp:
        graine = sum(map(ord, s.get("titre", "")))
        brut = style_actif(s, c) == "brut" and not long_format
        bg = fond_brut(total, tmp, coupes, graine) if brut else None
        if brut and not bg:
            print("(style brut : aucune vidéo dans videos/, retour au style v5)"); brut = False
        if brut:
            ecrire_ass_brut(os.path.join(tmp, "subs.ass"), s, mots, tms, bornes, total, c)
        else:
            ecrire_ass(os.path.join(tmp, "subs.ass"), s, mots, tms, bornes, total, c, long_format)
        if os.path.isdir(os.path.join(MARQUE, "fonts")):
            shutil.copytree(os.path.join(MARQUE, "fonts"), os.path.join(tmp, "fonts"))
        if not brut:
            bg = fond(clips_dir, total, tmp, coupes, c, graine=graine)
        musique = choisir_musique(graine)
        audio = (bande_son(voix, total, [], tmp, musique, graine, vol_musique=0.10, gain_voix=2.1) if brut
                 else bande_son(voix, total, coupes, tmp, musique, graine))
        credit = sortie + ".credit.txt"
        if musique:
            titre = os.path.splitext(os.path.basename(musique))[0]
            open(credit, "w", encoding="utf-8").write(
                f"Musique : « {titre} » Kevin MacLeod (incompetech.com), "
                "licence Creative Commons Attribution 4.0 : http://creativecommons.org/licenses/by/4.0/\n")
        elif os.path.exists(credit):
            os.remove(credit)
        fd = ":fontsdir=fonts" if os.path.isdir(os.path.join(tmp, "fonts")) else ""
        logo = os.path.join(MARQUE, c.get("logo", "logo.png"))
        lw = int(c.get("logo_largeur", 220) * (0.6 if brut else 0.75 if not long_format else 0.6))
        if os.path.exists(logo):
            entrees = ["-i", bg, "-i", audio, "-i", logo]
            filtre = (f"[2:v]scale={lw}:-1,format=rgba,colorchannelmixer=aa=0.9[lg];"
                      + (f"[0:v][lg]overlay=W-w-50:80[b];" if brut else f"[0:v][lg]overlay=(W-w)/2:40[b];") + f"[b]ass=subs.ass{fd}[v]")
        else:
            entrees = ["-i", bg, "-i", audio]
            filtre = f"[0:v]ass=subs.ass{fd}[v]"
        ff(*entrees, "-filter_complex", filtre, "-map", "[v]", "-map", "1:a",
           "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
           "-c:a", "copy", "-shortest", "-movflags", "+faststart", sortie, cwd=tmp)
    print("OK ->", sortie)


if __name__ == "__main__":
    if len(sys.argv) != 5:
        print(__doc__); sys.exit(1)
    rendre(*sys.argv[1:])
