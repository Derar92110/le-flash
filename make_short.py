#!/usr/bin/env python3
"""Le Flash : assemble un Short vertical (1080x1920) à partir d'une voix off,
d'un script et de clips de gameplay.

Usage :
  python3 make_short.py scripts/001.json voix.mp3 clips/ sortie.mp4

- scripts/001.json : {"format": "short"|"long", "titre": "...", "hook": "...", "texte": "..."}
                    short = vertical 1080x1920, long = horizontal 1920x1080
- voix.mp3        : la voix off ElevenLabs
- clips/          : dossier de captures de gameplay (.mp4/.mov) faites par toi.
                    Vide ou absent -> fond néon animé (pour tester).
Le script découpe le texte en sous-titres de 3 à 5 mots, synchronisés au
prorata de la durée de la voix, et les incruste en gros au centre.
Dépendances : ffmpeg, Python 3 (aucune lib externe).
"""
import json, os, random, re, subprocess, sys, tempfile

import platform
W, H = 1080, 1920  # Short vertical ; "long" -> 1920x1080
POLICE = "Arial Black" if platform.system() == "Windows" else "DejaVu Sans"
MARQUE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "marque")


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
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=nw=1:nk=1", path]).decode().strip()
    return float(out)


def morceaux(texte, n=4):
    # un mot clé *entre étoiles* reste groupé dans le même sous-titre
    texte = re.sub(r"\*([^*]+)\*", lambda m: "*" + m.group(1).replace(" ", "§") + "*", texte)
    mots = texte.split()
    blocs, cur = [], []
    for m in mots:
        cur.append(m)
        if len(cur) >= n or re.search(r"[.!?:,]$", m) and len(cur) >= 2:
            blocs.append(" ".join(cur)); cur = []
    if cur:
        blocs.append(" ".join(cur))
    return blocs


def ts(t):
    h, r = divmod(t, 3600); m, s = divmod(r, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def ass(blocs, total, path, long_format=False, c=None):
    c = c or {}
    police = c.get("police", POLICE)
    blanc = ass_col(c.get("couleur_texte", "#ffffff"))
    contour = ass_col(c.get("couleur_contour", "#000000"))
    cle = ass_col(c.get("couleur_mot_cle", "#ffd400"))
    hook_fond = ass_col(c.get("couleur_hook_fond", "#ff2d3d"))
    hook_txt = ass_col(c.get("couleur_hook_texte", "#ffffff"))
    bandeau = c.get("police_bandeau", police)
    poids = [max(len(b), 1) for b in blocs]
    somme = sum(poids)
    t = 0.0
    lignes = []
    for b, p in zip(blocs, poids):
        d = total * p / somme
        txt = b.upper().replace("\\", "").replace("{", "(").replace("}", ")")
        txt = re.sub(r"\*([^*]+)\*", lambda m: "{\\1c" + cle + "&}" + m.group(1) + "{\\r}", txt)
        txt = txt.replace("*", "").replace("§", " ")
        lignes.append(f"Dialogue: 0,{ts(t)},{ts(t + d)},Main,,0,0,0,,{txt}")
        t += d
    entete = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Main,{police},{72 if long_format else 100},{blanc},{blanc},{contour},{cle},1,0,0,0,100,100,0,0,1,7,4,{2 if long_format else 5},60,60,{90 if long_format else 0},1
Style: Hook,{bandeau},{80 if long_format else 96},{hook_txt},{hook_txt},{hook_fond},&H00000000,0,0,0,0,100,100,2,0,3,16,0,8,60,60,{80 if long_format else 180},1
Style: Etiquette,{bandeau},{60 if long_format else 76},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,3,0,3,12,0,7,60,60,0,1
Style: Compteur,{bandeau},{60 if long_format else 76},&H00FFFFFF,&H00FFFFFF,{hook_fond},&H00000000,0,0,0,0,100,100,2,0,3,12,0,9,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(entete + "\n".join(lignes) + "\n")


def fond(clips_dir, total, tmp):
    clips = []
    if clips_dir and os.path.isdir(clips_dir):
        clips = [os.path.join(clips_dir, c) for c in sorted(os.listdir(clips_dir))
                 if c.lower().endswith((".mp4", ".mov", ".mkv", ".webm"))]
    out = os.path.join(tmp, "fond.mp4")
    vf = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1,fps=30"
    if not clips:
        # Fond néon de test (dégradé animé rose/cyan)
        subprocess.check_call([
            "ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i",
            f"color=c={charte().get('couleur_fond', '#0e0e12').replace('#', '0x')}:s={W}x{H}:d={total}:r=30",
            "-vf", "noise=alls=8:allf=t,vignette=PI/5",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", out])
        return out
    # Enchaîne des extraits de 2,5 s pris au hasard dans tes clips
    random.seed(42)
    parts, t, i = [], 0.0, 0
    while t < total:
        c = clips[i % len(clips)]; i += 1
        d = duree(c)
        seg = min(2.5, total - t)
        start = random.uniform(0, max(d - seg, 0))
        p = os.path.join(tmp, f"p{i:03d}.mp4")
        subprocess.check_call([
            "ffmpeg", "-y", "-v", "error", "-ss", f"{start:.2f}", "-t", f"{seg:.2f}",
            "-i", c, "-an", "-vf", vf, "-c:v", "libx264", "-pix_fmt", "yuv420p", p])
        parts.append(p); t += seg
    lst = os.path.join(tmp, "liste.txt")
    with open(lst, "w") as f:
        f.writelines(f"file '{p}'\n" for p in parts)
    subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0",
                           "-i", lst, "-c", "copy", out])
    return out


def rendre(script_path, voix, clips_dir, sortie):
    s = json.load(open(script_path, encoding="utf-8"))
    long_format = s.get("format") == "long"
    regler_format("long" if long_format else "short")
    voix, sortie = os.path.abspath(voix), os.path.abspath(sortie)
    clips_dir = os.path.abspath(clips_dir) if clips_dir else None
    total = duree(voix)
    with tempfile.TemporaryDirectory() as tmp:
        sub = os.path.join(tmp, "subs.ass")
        c = charte()
        if s.get("segments") and not s.get("texte"):
            s["texte"] = " ".join(g["texte"] for g in s["segments"])
        ass(morceaux(s["texte"], 6 if long_format else 4), total, sub, long_format, c)
        etiqs = c.get("etiquettes", {})
        y_etiq = int(H * (0.20 if long_format else 0.24))
        with open(sub, "a", encoding="utf-8") as f:
            segs = s.get("segments") or []
            if segs:
                # "Le Flash du jour" : infos numérotées 1/3, 2/3... avec étiquette de source
                poids = [max(len(g["texte"]), 1) for g in segs]
                somme, t0 = sum(poids), 0.0
                for k, (g, pd) in enumerate(zip(segs, poids)):
                    t1 = t0 + total * pd / somme
                    f.write(f"Dialogue: 2,{ts(t0)},{ts(t1)},Compteur,,0,0,0,,"
                            f"{{\\pos({W - 60},{y_etiq})\\fad(80,0)}}{k + 1}/{len(segs)}\n")
                    e = (g.get("etiquette") or "").upper()
                    if e in etiqs:
                        f.write(f"Dialogue: 2,{ts(t0)},{ts(t1)},Etiquette,,0,0,0,,"
                                f"{{\\pos(60,{y_etiq})\\3c{ass_col(etiqs[e]['fond'])}&"
                                f"\\1c{ass_col(etiqs[e]['texte'])}&\\fad(80,0)}}{e}\n")
                    t0 = t1
            else:
                e = (s.get("etiquette") or "").upper()
                if e in etiqs:
                    f.write(f"Dialogue: 2,{ts(0)},{ts(total)},Etiquette,,0,0,0,,"
                            f"{{\\pos(60,{y_etiq})\\3c{ass_col(etiqs[e]['fond'])}&"
                            f"\\1c{ass_col(etiqs[e]['texte'])}&}}{e}\n")
        fonts_src = os.path.join(MARQUE, "fonts")
        if os.path.isdir(fonts_src):
            import shutil
            shutil.copytree(fonts_src, os.path.join(tmp, "fonts"))
        hook = s.get("hook", "").upper().replace("\\", "")
        if hook:
            with open(sub, "a", encoding="utf-8") as f:
                f.write(f"Dialogue: 1,{ts(0)},{ts(min(3.0, total))},Hook,,0,0,0,,{hook}\n")
        bg = fond(clips_dir, total, tmp)
        fd = ":fontsdir=fonts" if os.path.isdir(os.path.join(tmp, "fonts")) else ""
        logo = os.path.join(MARQUE, c.get("logo", "logo.png"))
        if os.path.exists(logo):
            lw = c.get("logo_largeur", 180)
            logo_in = ["-i", logo]
            filtre = (f"[2:v]scale={lw}:-1,format=rgba,colorchannelmixer=aa=0.85[lg];"
                      f"[0:v][lg]overlay=W-w-40:40[b];[b]ass=subs.ass{fd}[v]")
        else:
            logo_in = []
            filtre = f"[0:v]ass=subs.ass{fd}[v]"
        subprocess.check_call([
            "ffmpeg", "-y", "-v", "error", "-i", bg, "-i", voix, *logo_in,
            "-filter_complex", filtre, "-map", "[v]", "-map", "1:a",
            "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", sortie], cwd=tmp)
    print("OK ->", sortie)


def main():
    if len(sys.argv) != 5:
        print(__doc__); sys.exit(1)
    rendre(*sys.argv[1:])


if __name__ == "__main__":
    main()
