import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BLEU, ROUGE, THEMES, type FlashProps, type Mot, type Segment, type Theme } from "./types";
import { Pastille, POLICE, Widget } from "./widgets";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const doux = Easing.bezier(0.16, 1, 0.3, 1);
const sinT = (f: number, periode: number, phase = 0) => Math.sin((f / periode) * Math.PI * 2 + phase);
const ORDRE: (keyof typeof THEMES)[] = ["nuit", "bleu", "clair"];
const CENTRE_WIDGET = 1240; // y du centre du widget
const TRANSITION = 14; // images

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
  if (f < fm) return null;
  return (
    <span style={{ display: "inline-block", maxWidth: place * 900, marginRight: `${0.26 * place}em`, whiteSpace: "nowrap" }}>
      <span style={{ position: "relative", display: "inline-block", opacity: a, filter: `blur(${(1 - a) * 16}px)`,
        transform: `translateY(${(1 - a) * 26}px)`, color: m.cle ? th.cle : th.texte }}>
        {m.w}
        {m.cle && (
          <span style={{ position: "absolute", left: 0, bottom: "0.02em", height: "0.075em", width: `${trait}%`,
            background: th.cle, borderRadius: 4 }} />
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
            filter: age === 2 ? `blur(${k * 8}px)` : undefined, display: "flex", flexWrap: "wrap", justifyContent: "center", marginRight: "-0.26em" }}>
            {ph[i].mots.map((m, j) => <MotAnime key={j} m={m} t0={t0} th={th} />)}
          </div>
        );
      })}
    </div>
  );
};

// ---------- une scène = un segment du script ----------
const Scene: React.FC<{ seg: Segment; index: number; mots: Mot[]; th: Theme; fin: number; transition: "disque" | "flou" | "aucune" }> = ({ seg, index, mots, th, fin, transition }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duree = fin - seg.start;
  const entree = spring({ frame: f - 3, fps, config: { damping: 16, stiffness: 120 } });
  const zoom = interpolate(f, [0, duree * fps], [1, 1.07], clamp);
  const derive = `translate(${sinT(f, 210) * 10}px, ${sinT(f, 260, 1) * 12}px) rotate(${sinT(f, 340) * 0.5}deg) scale(${zoom})`;
  const tilt = `perspective(1800px) rotateX(${sinT(f, 150) * 5}deg) rotateY(${sinT(f, 190, 1) * 7}deg)`;
  const R = interpolate(f, [0, TRANSITION], [0, 2300], { ...clamp, easing: Easing.bezier(0.7, 0, 0.3, 1) });
  const fl = interpolate(f, [0, 12], [1, 0], { ...clamp, easing: doux });
  const style: React.CSSProperties =
    transition === "disque" ? { clipPath: `circle(${R}px at 540px ${CENTRE_WIDGET}px)` }
    : transition === "flou" ? { opacity: 1 - fl, filter: `blur(${fl * 30}px)`, transform: `scale(${1 + fl * 0.12})` }
    : {};
  const etiq = (seg.etiquette || "").toUpperCase();
  const visuel = seg.visuel || { type: "carte" as const, titre: seg.titre || "" };
  return (
    <AbsoluteFill style={style}>
      <AbsoluteFill style={{ background: th.fond, transform: derive }}>
        <Decor th={th} graine={index} />
        <TexteCinetique mots={mots} t0={seg.start} th={th} />
        <div style={{ position: "absolute", left: 0, right: 0, top: CENTRE_WIDGET - 380, height: 760, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 34 }}>
          {etiq && <Pastille etiquette={etiq} delai={8} />}
          <div style={{ transform: `${tilt} translateY(${(1 - entree) * 140 + sinT(f, 90) * 10}px) scale(${0.82 + 0.18 * entree})`,
            opacity: entree, filter: `blur(${(1 - entree) * 18}px)` }}>
            <Widget v={visuel} th={th} duree={duree} />
          </div>
        </div>
      </AbsoluteFill>
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
        <Decor th={th} graine={9} />
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
        const th = THEMES[ORDRE[i % 3]];
        return (
          <Sequence key={i} from={debut} durationInFrames={Math.max(1, finF - debut)}>
            <Scene seg={{ ...s, start: debut / fps }} index={i} th={th} fin={fin}
              mots={p.mots.filter((m) => m.seg === i)} transition={i === 0 ? "aucune" : i % 2 ? "disque" : "flou"} />
          </Sequence>
        );
      })}
      <Sequence from={Math.round(finVoix * fps)}>
        <Outro />
      </Sequence>
      <Sequence durationInFrames={Math.round(finVoix * fps) + 4}>
        <EnTete hook={p.hook} />
      </Sequence>
      {/* bruitages discrets : souffle à chaque transition, petit pop à l'arrivée du widget */}
      {segs.map((s, i) => {
        const debut = Math.round(s.start * fps);
        return (
          <React.Fragment key={`sfx${i}`}>
            {i > 0 && <Sequence from={Math.max(0, debut - 8)} durationInFrames={24}><Audio src={staticFile("sfx/whoosh.wav")} volume={0.3} /></Sequence>}
            <Sequence from={debut + 8} durationInFrames={8}><Audio src={staticFile("sfx/pop.wav")} volume={0.18} /></Sequence>
          </React.Fragment>
        );
      })}
      <Sequence from={Math.max(0, Math.round(finVoix * fps) - 6)} durationInFrames={24}><Audio src={staticFile("sfx/whoosh.wav")} volume={0.3} /></Sequence>
      <Sequence from={Math.round(finVoix * fps) + 40} durationInFrames={4}><Audio src={staticFile("sfx/clic.wav")} volume={0.35} /></Sequence>
      {p.voix && <Audio src={staticFile(p.voix)} />}
      {p.musique && <Audio src={staticFile(p.musique)} volume={(fr) => (p.volumeMusique ?? 0.1) * interpolate(fr, [durationInFrames - 20, durationInFrames], [1, 0], clamp)} />}
    </AbsoluteFill>
  );
};
