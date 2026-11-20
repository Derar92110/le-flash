import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BLEU, ROUGE, THEMES, type FlashProps, type Fond, type Mot, type Segment, type Theme } from "./types";
import { Pastille, POLICE, Widget } from "./widgets";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const doux = Easing.bezier(0.16, 1, 0.3, 1);
const sinT = (f: number, periode: number, phase = 0) => Math.sin((f / periode) * Math.PI * 2 + phase);
const ORDRE: (keyof typeof THEMES)[] = ["nuit", "bleu", "clair"];
const CENTRE_WIDGET = 1240; // y du centre du widget
const TRANSITION = 14; // images
const TRANSITIONS = ["disque", "zoom", "glisse", "flou"] as const;
type TypeTransition = (typeof TRANSITIONS)[number] | "aucune";

// pseudo-aléatoire stable (même rendu à chaque image)
const hasard = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------- décor : sphères et cubes flous qui dérivent (profondeur) ----------
const Decor: React.FC<{ th: Theme; graine: number }> = ({ th, graine }) => {
  const f = useCurrentFrame();
  const objets = [
    { x: 150, y: 520, d: 120, flou: 10, forme: "sphere" },
    { x: 930, y: 760, d: 90, flou: 2, forme: "cube" },
    { x: 110, y: 1560, d: 70, flou: 3, forme: "cube" },
    { x: 950, y: 1600, d: 150, flou: 16, forme: "sphere" },
    { x: 560, y: 300, d: 46, flou: 6, forme: "sphere" },
  ];
  return (
    <AbsoluteFill>
      {objets.map((o, i) => {
        const dx = sinT(f + graine * 40, 180 + i * 37, i) * 30;
        const dy = sinT(f + graine * 40, 220 + i * 29, i * 2) * 36;
        const rot = f * (i % 2 ? 0.6 : -0.4) + i * 30;
        const commun: React.CSSProperties = { position: "absolute", left: o.x + dx - o.d / 2, top: o.y + dy - o.d / 2, width: o.d, height: o.d,
          filter: `blur(${o.flou}px)`, opacity: 0.9 };
        return o.forme === "sphere" ? (
          <div key={i} style={{ ...commun, borderRadius: "50%",
            background: `radial-gradient(circle at 32% 28%, #ffffff 0%, ${th.deco} 38%, #0a1660 100%)`,
            boxShadow: `0 0 60px ${th.deco}66` }} />
        ) : (
          <div key={i} style={{ ...commun, borderRadius: o.d * 0.26, transform: `rotate(${rot}deg)`,
            background: `linear-gradient(140deg, #8fb0ff 0%, ${BLEU} 50%, #1534b8 100%)`, boxShadow: `0 20px 40px rgba(10,30,120,0.35)` }} />
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- VFX : particules lumineuses qui montent ----------
const Particules: React.FC<{ couleur: string; n?: number }> = ({ couleur, n = 26 }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: n }).map((_, i) => {
        const vit = 0.6 + hasard(i) * 1.8;
        const y = 1980 - ((f * vit + hasard(i + 50) * 2000) % 2100);
        const x = hasard(i + 100) * 1080 + sinT(f, 90 + i * 7, i) * 24;
        const t = 3 + hasard(i + 200) * 7;
        const scint = 0.35 + 0.65 * Math.abs(Math.sin(f / (6 + hasard(i) * 10) + i));
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: t, height: t, borderRadius: t,
          background: i % 5 === 0 ? "#ffd9a8" : couleur, opacity: scint * 0.8,
          boxShadow: `0 0 ${t * 3}px ${i % 5 === 0 ? "#ffb36b" : couleur}`, filter: i % 3 === 0 ? "blur(2px)" : undefined }} />;
      })}
    </AbsoluteFill>
  );
};

// ---------- VFX : fuites de lumière (light leaks) ----------
const FuitesLumiere: React.FC<{ graine: number; force?: number }> = ({ graine, force = 1 }) => {
  const f = useCurrentFrame();
  const a = sinT(f + graine * 60, 160);
  const b = sinT(f + graine * 60, 210, 2);
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", pointerEvents: "none", opacity: 0.55 * force }}>
      <div style={{ position: "absolute", left: -300 + a * 200, top: -200 + b * 150, width: 1100, height: 1100, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,140,60,0.55) 0%, rgba(255,80,60,0.15) 40%, transparent 70%)" }} />
      <div style={{ position: "absolute", right: -400 + b * 220, bottom: -300 + a * 180, width: 1300, height: 1300, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(60,140,255,0.5) 0%, rgba(60,100,255,0.12) 45%, transparent 70%)" }} />
    </AbsoluteFill>
  );
};

// ---------- VFX : grain de pellicule ----------
const Grain: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundImage: `url(${staticFile("grain.png")})`, backgroundSize: "512px 512px",
      backgroundPosition: `${Math.floor(hasard(Math.floor(f / 2)) * 512)}px ${Math.floor(hasard(Math.floor(f / 2) + 7) * 512)}px`,
      mixBlendMode: "overlay", opacity: 0.06, pointerEvents: "none" }} />
  );
};

// ---------- fond : image ou extrait du jeu, flouté et teinté derrière le contenu ----------
const FondMedia: React.FC<{ fond: Fond; th: Theme; duree: number; clair: boolean }> = ({ fond, th, duree, clair }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const z = interpolate(f, [0, duree * fps], [1.25, 1.4], clamp);
  const style: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z})`,
    filter: `blur(${clair ? 26 : 14}px) saturate(1.3) brightness(${clair ? 1.1 : 0.75})` };
  return (
    <AbsoluteFill>
      {fond.type === "video" ? <OffthreadVideo src={staticFile(fond.src)} muted style={style} /> : <Img src={staticFile(fond.src)} style={style} />}
      <AbsoluteFill style={{ background: th.fond, opacity: clair ? 0.82 : 0.7 }} />
    </AbsoluteFill>
  );
};

// ---------- texte cinétique : mots qui apparaissent flous puis nets ----------
type Phrase = { mots: Mot[]; start: number };
function phrases(mots: Mot[]): Phrase[] {
  const res: Phrase[] = [];
  let cur: Mot[] = [];
  const pousse = () => { if (cur.length) res.push({ mots: cur, start: cur[0].start }); cur = []; };
  mots.forEach((m) => {
    cur.push(m);
    if (/[.!?:;,]$/.test(m.w) || cur.length >= 6) pousse();
  });
  pousse();
  return res;
}

const MotAnime: React.FC<{ m: Mot; t0: number; th: Theme }> = ({ m, t0, th }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fm = (m.start - t0) * fps;
  const a = interpolate(f - fm, [0, 7], [0, 1], { ...clamp, easing: doux });
  const place = interpolate(f - fm, [0, 5], [0, 1], { ...clamp, easing: doux }); // la ligne s'écarte en douceur
  const trait = interpolate(f - fm, [4, 14], [0, 100], { ...clamp, easing: doux });
  const lueur = m.cle ? interpolate(f - fm, [0, 6, 30], [0, 1, 0.35], clamp) : 0;
  if (f < fm) return null;
  return (
    <span style={{ display: "inline-block", maxWidth: place * 900, marginRight: `${0.26 * place}em`, whiteSpace: "nowrap" }}>
      <span style={{ position: "relative", display: "inline-block", opacity: a, filter: `blur(${(1 - a) * 16}px)`,
        transform: `perspective(600px) rotateX(${(1 - a) * -75}deg) translateY(${(1 - a) * 26}px) scale(${m.cle ? 1 + 0.18 * (1 - a) : 1})`,
        transformOrigin: "50% 100%", color: m.cle ? th.cle : th.texte,
        textShadow: lueur && !m.cle ? `0 0 ${30 * lueur}px ${th.cle}` : undefined }}>
        {m.cle ? (
          <span style={{ backgroundImage: `linear-gradient(100deg, ${th.cle} 0%, ${th.cle} 35%, #ffffff 50%, ${th.cle} 65%, ${th.cle} 100%)`,
            backgroundSize: "300% 100%", backgroundPosition: `${100 - ((f - fm) * 3) % 200}% 0`,
            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
            filter: `drop-shadow(0 0 ${8 + 22 * lueur}px ${th.cle})` }}>{m.w}</span>
        ) : m.w}
        {m.cle && (
          <span style={{ position: "absolute", left: 0, bottom: "0.02em", height: "0.075em", width: `${trait}%`,
            background: th.cle, borderRadius: 4, boxShadow: `0 0 16px ${th.cle}` }} />
        )}
      </span>
    </span>
  );
};

const TexteCinetique: React.FC<{ mots: Mot[]; t0: number; th: Theme }> = ({ mots, t0, th }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = t0 + f / fps;
  const ph = useMemo(() => phrases(mots), [mots]);
  if (!ph.length) return null;
  let p = ph.findIndex((x, i) => t >= x.start - 0.05 && (!ph[i + 1] || t < ph[i + 1].start - 0.05));
  if (p < 0) p = 0;
  const k = interpolate(t - ph[p].start, [0, 0.3], [0, 1], { ...clamp, easing: doux });
  const rendu = [p - 2, p - 1, p].filter((i) => i >= 0);
  return (
    <div style={{ position: "absolute", left: 70, right: 70, top: 220, height: 560, display: "flex", flexDirection: "column",
      justifyContent: "flex-end", alignItems: "center", gap: 10, fontFamily: POLICE, fontWeight: 800, textAlign: "center" }}>
      {rendu.map((i) => {
        const age = p - i; // 0 = phrase en cours
        const taille = age === 0 ? 78 : age === 1 ? interpolate(k, [0, 1], [78, 50]) : interpolate(k, [0, 1], [50, 40]);
        const op = age === 0 ? 1 : age === 1 ? interpolate(k, [0, 1], [1, 0.5]) : interpolate(k, [0, 1], [0.5, 0]);
        return (
          <div key={i} style={{ fontSize: taille, lineHeight: 1.18, opacity: op, letterSpacing: -1,
            filter: age === 2 ? `blur(${k * 8}px)` : undefined, display: "flex", flexWrap: "wrap", justifyContent: "center", marginRight: "-0.26em",
            textShadow: th.texte === "#ffffff" ? "0 6px 30px rgba(0,0,20,0.45)" : undefined }}>
            {ph[i].mots.map((m, j) => <MotAnime key={j} m={m} t0={t0} th={th} />)}
          </div>
        );
      })}
    </div>
  );
};

// ---------- VFX : écho géant du mot-clé derrière la scène ----------
const EchoMots: React.FC<{ mots: Mot[]; t0: number; th: Theme }> = ({ mots, t0, th }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = t0 + f / fps;
  const m = [...mots].reverse().find((x) => x.cle && t >= x.start && t < x.start + 1.1);
  if (!m) return null;
  const d = (t - m.start) / 1.1;
  const mot = m.w.replace(/[.,!?:;]/g, "").toUpperCase();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ fontFamily: POLICE, fontWeight: 800, fontSize: mot.length > 8 ? 190 : 280, color: "transparent", whiteSpace: "nowrap",
        WebkitTextStroke: `3px ${th.cle}`, opacity: interpolate(d, [0, 0.1, 1], [0, 0.55, 0]),
        transform: `translateY(-120px) scale(${interpolate(d, [0, 1], [0.85, 1.45])})`, filter: `blur(${d * 6}px)` }}>{mot}</div>
    </AbsoluteFill>
  );
};

// ---------- ouverture : mur 3D d'images du jeu survolé par la caméra ----------
const MurImages: React.FC<{ mur: string[]; duree: number }> = ({ mur, duree }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(f, [0, duree * fps], [0, 1], clamp);
  const arrivee = interpolate(f, [0, 40], [0, 1], { ...clamp, easing: doux });
  const COLS = 7, LIGNES = 12, W = 330, H = 186, G = 22;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#03051a" }}>
      <div style={{ position: "absolute", left: 540 - (COLS * (W + G)) / 2, top: 960 - (LIGNES * (H + G)) / 2,
        width: COLS * (W + G), height: LIGNES * (H + G), transformStyle: "preserve-3d",
        transform: `perspective(1100px) rotateX(${interpolate(arrivee, [0, 1], [8, 48]) - p * 8}deg) rotateZ(${-18 + p * 6}deg) ` +
          `translateY(${-p * 420}px) translateZ(${interpolate(arrivee, [0, 1], [500, 0])}px) scale(${1.15 + p * 0.15})` }}>
        {Array.from({ length: COLS * LIGNES }).map((_, k) => {
          const c = k % COLS, l = Math.floor(k / COLS);
          const src = mur[(k * 5 + l) % mur.length];
          const lum = 0.35 + hasard(k) * 0.5 + 0.25 * Math.max(0, Math.sin(f / 9 + k));
          const pop = interpolate(f - hasard(k + 9) * 18, [0, 10], [0, 1], { ...clamp, easing: doux });
          return (
            <div key={k} style={{ position: "absolute", left: c * (W + G), top: l * (H + G), width: W, height: H, borderRadius: 18,
              overflow: "hidden", opacity: pop, transform: `translateZ(${(1 - pop) * 200 + hasard(k + 3) * 40}px)`,
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)", border: "2px solid rgba(140,170,255,0.25)" }}>
              <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", filter: `brightness(${lum}) saturate(1.2)` }} />
            </div>
          );
        })}
      </div>
      <AbsoluteFill style={{ background: "radial-gradient(70% 45% at 50% 42%, rgba(8,14,60,0.55), rgba(3,5,26,0.92) 100%)" }} />
    </AbsoluteFill>
  );
};

// ---------- fond vivant : nappes de couleur qui se déplacent ----------
const NappesCouleur: React.FC<{ clair: boolean; graine: number }> = ({ clair, graine }) => {
  const f = useCurrentFrame();
  const nappes = clair ? ["#9db4ff", "#c7b8ff", "#8fe3ff"] : ["#2b5cff", "#7a3cff", "#12c8ff"];
  return (
    <AbsoluteFill style={{ mixBlendMode: clair ? "multiply" : "screen", opacity: clair ? 0.35 : 0.4, pointerEvents: "none" }}>
      {nappes.map((c, i) => (
        <div key={i} style={{ position: "absolute", width: 1100, height: 1100, borderRadius: "50%",
          left: 540 - 550 + sinT(f + graine * 50, 200 + i * 60, i * 2) * 380, top: 960 - 550 + sinT(f + graine * 50, 260 + i * 40, i) * 620,
          background: `radial-gradient(circle, ${c} 0%, transparent 65%)` }} />
      ))}
    </AbsoluteFill>
  );
};

// ---------- VFX : explosion de particules + onde de choc ----------
const Eclat: React.FC<{ x: number; y: number; couleur: string; n?: number; taille?: number }> = ({ x, y, couleur, n = 18, taille = 1 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, 22], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  if (f > 26) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, pointerEvents: "none" }}>
      {[0, 1].map((r) => {
        const q = interpolate(f - r * 4, [0, 18], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
        const d = 120 + q * 520 * taille;
        return <div key={r} style={{ position: "absolute", left: -d / 2, top: -d / 2, width: d, height: d, borderRadius: "50%",
          border: `${6 - r * 3}px solid ${couleur}`, opacity: (1 - q) * 0.8, boxShadow: `0 0 30px ${couleur}` }} />;
      })}
      {Array.from({ length: n }).map((_, i) => {
        const ang = (i / n) * Math.PI * 2 + hasard(i) * 0.4;
        const dist = (160 + hasard(i + 4) * 260) * taille * p;
        const t = 6 + hasard(i + 8) * 10;
        return <div key={i} style={{ position: "absolute", left: Math.cos(ang) * dist - t / 2, top: Math.sin(ang) * dist - t / 2,
          width: t, height: t, borderRadius: t, background: i % 3 ? "#ffffff" : couleur, opacity: 1 - p,
          boxShadow: `0 0 ${t * 2}px ${couleur}` }} />;
      })}
    </div>
  );
};

// ---------- une scène = un segment du script ----------
const Scene: React.FC<{ seg: Segment; index: number; mots: Mot[]; th: Theme; clair: boolean; fin: number; transition: TypeTransition; mur?: string[] }> = ({ seg, index, mots, th, clair, fin, transition, mur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = seg.start + f / fps;
  const duree = fin - seg.start;
  const entree = spring({ frame: f - 3, fps, config: { damping: 16, stiffness: 120 } });
  // coup de caméra + petite secousse sur chaque mot-clé
  const choc = mots.filter((m) => m.cle).reduce((acc, m) => {
    const d = t - m.start;
    return d >= 0 && d < 0.6 ? Math.max(acc, Math.exp(-d * 8)) : acc;
  }, 0);
  const secX = Math.sin(f * 2.7) * 7 * choc, secY = Math.cos(f * 3.1) * 5 * choc;
  const zoom = interpolate(f, [0, duree * fps], [1, 1.07], clamp) + choc * 0.04;
  const derive = `translate(${secX}px, ${secY}px) rotate(${sinT(f, 340) * 0.5}deg) scale(${zoom})`;
  // caméra virtuelle : chaque couche glisse à sa vitesse (profondeur)
  const camX = sinT(f + index * 37, 230) * 1, camY = sinT(f + index * 37, 300, 1) * 1;
  const couche = (k: number): React.CSSProperties => ({ transform: `translate(${camX * k}px, ${camY * k * 0.8}px)` });
  const tilt = `perspective(1800px) rotateX(${sinT(f, 150) * 5}deg) rotateY(${sinT(f, 190, 1) * 7}deg)`;
  const R = interpolate(f, [0, TRANSITION], [0, 2300], { ...clamp, easing: Easing.bezier(0.7, 0, 0.3, 1) });
  const fl = interpolate(f, [0, 12], [1, 0], { ...clamp, easing: doux });
  const style: React.CSSProperties =
    transition === "disque" ? { clipPath: `circle(${R}px at 540px ${CENTRE_WIDGET}px)` }
    : transition === "flou" ? { opacity: 1 - fl, filter: `blur(${fl * 30}px)`, transform: `scale(${1 + fl * 0.12})` }
    : transition === "zoom" ? { opacity: Math.min(1, (1 - fl) * 2), filter: `blur(${fl * 22}px)`, transform: `scale(${1 + fl * 0.6}) rotate(${fl * -4}deg)` }
    : transition === "glisse" ? { transform: `translateY(${fl * 1920}px) rotate(${fl * 6}deg)`, filter: `blur(${fl * 16}px)` }
    : {};
  const etiq = (seg.etiquette || "").toUpperCase();
  const visuel = seg.visuel || { type: "carte" as const, titre: seg.titre || "" };
  const ouverture = index === 0 && mur && mur.length > 0;
  const atterrissage = Math.round(0.45 * fps); // moment où le widget se pose
  const clesDebut = mots.filter((m, k) => m.cle && !mots[k - 1]?.cle);
  return (
    <AbsoluteFill style={style}>
      <AbsoluteFill style={{ background: th.fond, transform: derive }}>
        <AbsoluteFill style={couche(-14)}>
          {ouverture ? <MurImages mur={mur!} duree={duree} />
            : seg.fond && <FondMedia fond={seg.fond} th={th} duree={duree} clair={clair} />}
        </AbsoluteFill>
        <NappesCouleur clair={clair} graine={index} />
        <FuitesLumiere graine={index} force={clair ? 0.5 : 1} />
        <AbsoluteFill style={couche(-6)}><EchoMots mots={mots} t0={seg.start} th={th} /></AbsoluteFill>
        <AbsoluteFill style={couche(-24)}><Decor th={th} graine={index} /></AbsoluteFill>
        <AbsoluteFill style={couche(-34)}><Particules couleur={clair ? "#7f9cff" : "#cfe0ff"} /></AbsoluteFill>
        <AbsoluteFill style={couche(8)}><TexteCinetique mots={mots} t0={seg.start} th={th} /></AbsoluteFill>
        <AbsoluteFill style={couche(16)}>
          <div style={{ position: "absolute", left: 0, right: 0, top: CENTRE_WIDGET - 380, height: 760, display: "flex",
            flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 34 }}>
            {etiq && <Pastille etiquette={etiq} delai={8} />}
            <div style={{ transform: `${tilt} translateY(${(1 - entree) * 140 + sinT(f, 90) * 10}px) scale(${0.82 + 0.18 * entree})`,
              opacity: entree, filter: `blur(${(1 - entree) * 18}px)` }}>
              <Widget v={visuel} th={th} duree={duree} />
            </div>
          </div>
          <Sequence from={atterrissage} durationInFrames={28} layout="none">
            <Eclat x={540} y={CENTRE_WIDGET} couleur={clair ? BLEU : "#8fb0ff"} />
          </Sequence>
        </AbsoluteFill>
        {clesDebut.map((m, k) => (
          <Sequence key={k} from={Math.max(0, Math.round((m.start - seg.start) * fps))} durationInFrames={28} layout="none">
            <Eclat x={540} y={700} couleur={th.cle} n={12} taille={0.7} />
          </Sequence>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- VFX de transition : flash, traînées lumineuses, décalage RVB ----------
const FlashTransition: React.FC<{ variante: number }> = ({ variante }) => {
  const f = useCurrentFrame();
  const flash = interpolate(f, [4, 7, 14], [0, 0.45, 0], clamp);
  const x = interpolate(f, [0, 16], [-1400, 1400], { ...clamp, easing: Easing.bezier(0.5, 0, 0.2, 1) });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{ position: "absolute", top: 260 + hasard(i + variante * 9) * 1400, left: x * (0.8 + hasard(i) * 0.6) - 300,
          width: 900 + hasard(i + 3) * 600, height: 4 + hasard(i + 5) * 10, borderRadius: 10, mixBlendMode: "screen",
          background: `linear-gradient(90deg, transparent, ${i % 2 ? "#ff3d5a" : "#4fd2ff"}, #ffffff, transparent)`,
          opacity: interpolate(f, [0, 4, 14, 18], [0, 0.9, 0.9, 0], clamp), filter: "blur(1px)" }} />
      ))}
      <AbsoluteFill style={{ background: "#ffffff", opacity: flash, mixBlendMode: "screen" }} />
    </AbsoluteFill>
  );
};

// ---------- en-tête permanent : direct + édition ----------
const EnTete: React.FC<{ hook: string }> = ({ hook }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 2, fps, config: { damping: 15 } });
  return (
    <div style={{ position: "absolute", top: 150, left: 0, right: 0, display: "flex", justifyContent: "center",
      transform: `translateY(${(1 - s) * -80}px)`, opacity: s }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, background: "rgba(8,12,40,0.72)", border: "2px solid rgba(160,185,255,0.25)",
        borderRadius: 999, padding: "14px 30px 14px 22px", fontFamily: POLICE, fontWeight: 800, fontSize: 32, color: "#fff",
        backdropFilter: "blur(10px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: ROUGE, borderRadius: 999, padding: "6px 16px", fontSize: 26, letterSpacing: 2 }}>
          <div style={{ width: 12, height: 12, borderRadius: 6, background: "#fff", opacity: 0.35 + 0.65 * Math.abs(Math.sin(f / 9)) }} />
          LE FLASH
        </div>
        <span style={{ letterSpacing: 1 }}>{hook.replace(/^FLASH\s+DU\s+/i, "ÉDITION DU ").replace(/^FLASH\s*/i, "")}</span>
      </div>
    </div>
  );
};

// ---------- fin : logo + slogan + abonnement ----------
const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const th = THEMES.clair;
  const s = spring({ frame: f - 4, fps, config: { damping: 14 } });
  const R = interpolate(f, [0, TRANSITION], [0, 2300], { ...clamp, easing: Easing.bezier(0.7, 0, 0.3, 1) });
  const mots = ["Toute", "l'actu", "GTA 6,", "chaque", "jour."];
  const clic = f > 40;
  const pulse = spring({ frame: f - 40, fps, config: { damping: 8, stiffness: 300 } });
  return (
    <AbsoluteFill style={{ clipPath: `circle(${R}px at 540px 960px)` }}>
      <AbsoluteFill style={{ background: th.fond, transform: `scale(${interpolate(f, [0, 90], [1.04, 1], clamp)})` }}>
        <FuitesLumiere graine={9} force={0.5} />
        <Decor th={th} graine={9} />
        <Particules couleur="#7f9cff" />
        <div style={{ position: "absolute", top: 560, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
          <Img src={staticFile("logo.png")} style={{ width: 700, transform: `scale(${0.7 + 0.3 * s})`, opacity: s, filter: `blur(${(1 - s) * 20}px)` }} />
          <div style={{ display: "flex", gap: "0 0.26em", fontFamily: POLICE, fontWeight: 800, fontSize: 64, color: th.texte }}>
            {mots.map((m, i) => {
              const a = interpolate(f - 14 - i * 3, [0, 7], [0, 1], { ...clamp, easing: doux });
              return <span key={i} style={{ opacity: a, filter: `blur(${(1 - a) * 14}px)`, color: i === 2 ? th.cle : th.texte }}>{m}</span>;
            })}
          </div>
          <div style={{ display: "flex", gap: 20, alignItems: "center", marginTop: 30, opacity: interpolate(f, [26, 34], [0, 1], clamp) }}>
            <div style={{ fontFamily: POLICE, fontWeight: 800, fontSize: 38, color: th.texte, background: "#fff", borderRadius: 999,
              padding: "14px 30px", boxShadow: th.ombre }}>@leflashfr</div>
            <div style={{ fontFamily: POLICE, fontWeight: 800, fontSize: 38, color: "#fff", background: clic ? "#0b1440" : ROUGE, borderRadius: 999,
              padding: "14px 34px", transform: `scale(${1 - 0.1 * Math.sin(Math.min(1, pulse) * Math.PI)})` }}>{clic ? "✓ Abonné" : "S'abonner"}</div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- composition ----------
export const Flash: React.FC<FlashProps> = (p) => {
  const { fps, durationInFrames } = useVideoConfig();
  const segs = p.segments;
  const finVoix = p.finVoix ?? p.duree;
  return (
    <AbsoluteFill style={{ background: "#04061a" }}>
      {segs.map((s, i) => {
        const fin = i === segs.length - 1 ? finVoix : segs[i + 1].start;
        const debut = Math.max(0, Math.round(s.start * fps) - (i ? 4 : 0));
        const finF = Math.round(fin * fps) + TRANSITION + 2;
        const nomTheme = ORDRE[i % 3];
        return (
          <Sequence key={i} from={debut} durationInFrames={Math.max(1, finF - debut)}>
            <Scene seg={{ ...s, start: debut / fps }} index={i} th={THEMES[nomTheme]} clair={nomTheme === "clair"} fin={fin}
              mots={p.mots.filter((m) => m.seg === i)} transition={i === 0 ? "aucune" : TRANSITIONS[(i - 1) % TRANSITIONS.length]} mur={p.mur} />
          </Sequence>
        );
      })}
      <Sequence from={Math.round(finVoix * fps)}>
        <Outro />
      </Sequence>
      {segs.slice(1).map((s, i) => (
        <Sequence key={`fx${i}`} from={Math.max(0, Math.round(s.start * fps) - 8)} durationInFrames={20}>
          <FlashTransition variante={i} />
        </Sequence>
      ))}
      <Sequence durationInFrames={Math.round(finVoix * fps) + 4}>
        <EnTete hook={p.hook} />
      </Sequence>
      <Grain />
      {/* bruitages : souffle à chaque transition, petit pop à l'arrivée du widget */}
      {segs.map((s, i) => {
        const debut = Math.round(s.start * fps);
        return (
          <React.Fragment key={`sfx${i}`}>
            {i > 0 && <Sequence from={Math.max(0, debut - 8)} durationInFrames={24}><Audio src={staticFile("sfx/whoosh.wav")} volume={0.16} /></Sequence>}
            <Sequence from={debut + 8} durationInFrames={8}><Audio src={staticFile("sfx/pop.wav")} volume={0.18} /></Sequence>
          </React.Fragment>
        );
      })}
      <Sequence from={Math.max(0, Math.round(finVoix * fps) - 6)} durationInFrames={24}><Audio src={staticFile("sfx/whoosh.wav")} volume={0.16} /></Sequence>
      <Sequence from={Math.round(finVoix * fps) + 40} durationInFrames={4}><Audio src={staticFile("sfx/clic.wav")} volume={0.35} /></Sequence>
      {p.voix && <Audio src={staticFile(p.voix)} />}
      {p.musique && <Audio src={staticFile(p.musique)} volume={(fr) => (p.volumeMusique ?? 0.1) * interpolate(fr, [durationInFrames - 20, durationInFrames], [1, 0], clamp)} />}
    </AbsoluteFill>
  );
};
