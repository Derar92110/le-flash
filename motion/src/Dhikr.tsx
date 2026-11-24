// Short de dhikr « compte avec moi » : chapelet doré, compteur, arabe + phonétique + traduction, source.
// Aucun visage, aucune personne, aucune musique : seulement un petit clic de perle à chaque compte.
import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export type Etape = {
  arabe: string;
  phonetique: string;
  traduction: string;
  repetitions: number;
  secondes: number;
  debut: number; // s, calculé par dhikr.py
};

export type DhikrProps = {
  marque: string;
  source: string;
  introHaut: string;
  introTitre: string;
  introSous: string;
  appel: string;
  recompense: string;
  finHaut: string;
  finBas: string;
  etapes: Etape[];
  introDuree: number;
  outroDuree: number;
  duree: number;
  son: boolean;
};

const OR = "#e7c77a";
const OR_FONCE = "#a8863f";
const OR_CLAIR = "#fff1c9";
const CREME = "#efe6d2";
const GRIS = "#bdb3a0";
const LATIN = "'Plus Jakarta Sans', sans-serif";
const SERIF = "'Cormorant', 'Amiri', serif";
const ITAL = "'Cormorant Italique', 'Amiri', serif";
const ARABE = "'Amiri', serif";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const doux = Easing.bezier(0.16, 1, 0.3, 1);
const hasard = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------- fond : nuit chaude, motif géométrique discret, poussière dorée ----------
const Fond: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 36%, #2a200e 0%, #120e07 42%, #050403 100%)" }}>
      <svg width={width} height={height} style={{ position: "absolute", opacity: 0.07 }}>
        <defs>
          <pattern id="etoile" width="180" height="180" patternUnits="userSpaceOnUse"
            patternTransform={`translate(0 ${(f * 0.25) % 180})`}>
            <g fill="none" stroke={OR} strokeWidth="2" transform="translate(90 90)">
              <rect x="-46" y="-46" width="92" height="92" />
              <rect x="-46" y="-46" width="92" height="92" transform="rotate(45)" />
              <circle r="20" />
            </g>
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#etoile)" />
      </svg>
      {Array.from({ length: 34 }).map((_, i) => {
        const x = hasard(i) * width;
        const vitesse = 0.25 + hasard(i + 50) * 0.6;
        const y = (hasard(i + 99) * height - f * vitesse * 2 + height * 4) % (height + 80) - 40;
        const d = 4 + hasard(i + 7) * 14;
        const o = 0.15 + 0.35 * (0.5 + 0.5 * Math.sin(f / (25 + i) + i));
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: d, height: d, borderRadius: "50%",
          background: OR, opacity: o, filter: `blur(${d > 12 ? 4 : 1.5}px)` }} />;
      })}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.65) 100%)" }} />
    </AbsoluteFill>
  );
};

// ---------- chapelet ----------
const Chapelet: React.FC<{ n: number; faites: number; pulse: number; fini: number }> = ({ n, faites, pulse, fini }) => {
  const R = 300;
  const cx = 540, cy = 700;
  const perles = [];
  for (let k = 0; k < n; k++) {
    // on laisse un espace en bas pour la perle de tête
    const a = Math.PI / 2 + ((k + 0.5) / n) * (Math.PI * 2 - 0.5) + 0.25;
    const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
    const faite = k < faites;
    const courante = k === faites - 1;
    const d = 30 * (courante ? 1 + 0.45 * pulse : 1);
    const lumiere = faite || fini > 0;
    perles.push(
      <div key={k} style={{ position: "absolute", left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: "50%",
        background: lumiere
          ? `radial-gradient(circle at 35% 30%, ${OR_CLAIR} 0%, ${OR} 40%, ${OR_FONCE} 100%)`
          : "radial-gradient(circle at 35% 30%, #5a4a2c 0%, #2e2516 70%, #1b150c 100%)",
        boxShadow: courante ? `0 0 ${30 + 40 * pulse}px ${OR}` : lumiere ? `0 0 12px ${OR}66` : "inset 0 0 6px #000" }} />,
    );
  }
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute" }}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={OR_FONCE} strokeOpacity={0.35} strokeWidth={2} />
        <line x1={cx} y1={cy + R + 10} x2={cx} y2={cy + R + 100} stroke={OR_FONCE} strokeWidth={3} strokeOpacity={0.6} />
        {[-14, -7, 0, 7, 14].map((dx) => (
          <line key={dx} x1={cx} y1={cy + R + 95} x2={cx + dx} y2={cy + R + 145} stroke={OR} strokeOpacity={0.55} strokeWidth={2} />
        ))}
      </svg>
      {perles}
      <div style={{ position: "absolute", left: cx - 24, top: cy + R + 18, width: 48, height: 70, borderRadius: 24,
        background: `linear-gradient(180deg, ${OR_CLAIR}, ${OR} 45%, ${OR_FONCE})`, boxShadow: `0 0 ${20 + 40 * fini}px ${OR}88` }} />
    </AbsoluteFill>
  );
};

const tailleArabe = (t: string) => (t.length <= 18 ? 132 : t.length <= 30 ? 104 : t.length <= 50 ? 80 : 66);
const taillePhon = (t: string) => (t.length <= 30 ? 36 : t.length <= 60 ? 30 : 25);

export const Dhikr: React.FC<DhikrProps> = (p) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const finCompte = p.duree - p.outroDuree;
  const total = p.etapes.reduce((s, e) => s + e.repetitions, 0);

  // étape et compte en cours
  let ie = 0;
  for (let i = 0; i < p.etapes.length; i++) if (t >= p.etapes[i].debut) ie = i;
  const e = p.etapes[ie];
  const dansEtape = Math.max(0, t - e.debut);
  const compteEtape = t < p.introDuree ? 0 : Math.min(e.repetitions, Math.floor(dansEtape / e.secondes) + 1);
  const avant = p.etapes.slice(0, ie).reduce((s, x) => s + x.repetitions, 0);
  const compteTotal = t >= finCompte ? total : avant + compteEtape;
  const phase = t < p.introDuree ? 1 : (dansEtape % e.secondes) / e.secondes;
  const pulse = Math.exp(-phase * 6);
  const nPerles = Math.min(e.repetitions, 33);
  const faites = compteEtape === 0 ? 0 : ((compteEtape - 1) % nPerles) + 1;

  const intro = interpolate(t, [p.introDuree - 0.5, p.introDuree], [1, 0], clamp);
  const corps = interpolate(t, [p.introDuree - 0.4, p.introDuree + 0.2, finCompte, finCompte + 0.6], [0, 1, 1, 0], clamp);
  const fin = interpolate(t, [finCompte + 0.2, finCompte + 1], [0, 1], clamp);
  const changement = interpolate(dansEtape, [0, 0.35], [0, 1], clamp);
  const montee = (d: number) => interpolate(f, [d * fps, d * fps + 18], [40, 0], { ...clamp, easing: doux });
  const apparait = (d: number) => interpolate(f, [d * fps, d * fps + 14], [0, 1], clamp);

  // clics : une perle par compte
  const clics: number[] = [];
  if (p.son) p.etapes.forEach((x) => { for (let k = 0; k < x.repetitions; k++) clics.push(x.debut + k * x.secondes); });

  return (
    <AbsoluteFill style={{ fontFamily: LATIN, color: CREME, fontVariantNumeric: "lining-nums" }}>
      <Fond />

      {/* --- source en haut, toujours visible --- */}
      <div style={{ position: "absolute", top: 150, width: "100%", textAlign: "center" }}>
        <span style={{ display: "inline-block", padding: "14px 34px", border: `2px solid ${OR}88`, borderRadius: 40,
          color: OR, fontSize: 30, fontWeight: 700, letterSpacing: 5, textTransform: "uppercase", background: "#0008" }}>
          {p.source}
        </span>
      </div>

      {/* --- corps : chapelet + compteur + texte --- */}
      <AbsoluteFill style={{ opacity: corps }}>
        <Chapelet n={nPerles} faites={t >= finCompte ? nPerles : faites} pulse={t >= finCompte ? 0 : pulse} fini={fin} />
        <div style={{ position: "absolute", top: 560, width: "100%", textAlign: "center" }}>
          <div style={{ fontFamily: SERIF, fontSize: 210, lineHeight: 1, color: OR_CLAIR, fontWeight: 600,
            transform: `scale(${1 + 0.06 * pulse})`, textShadow: `0 0 ${20 + 30 * pulse}px ${OR}aa` }}>{compteTotal}</div>
          <div style={{ fontFamily: SERIF, fontSize: 56, color: GRIS, marginTop: 4 }}>/ {total}</div>
        </div>

        <div style={{ position: "absolute", top: 1205, left: 60, right: 60, textAlign: "center", opacity: changement }}>
          <div dir="rtl" lang="ar" style={{ fontFamily: ARABE, fontSize: tailleArabe(e.arabe), lineHeight: 1.55, color: OR,
            textShadow: `0 0 26px ${OR}55`, transform: `scale(${1 + 0.025 * pulse})` }}>{e.arabe}</div>
          <div style={{ marginTop: 26, fontSize: taillePhon(e.phonetique), fontWeight: 800, letterSpacing: 4, color: "#ffffff", lineHeight: 1.35 }}>
            {e.phonetique}
          </div>
          <div style={{ marginTop: 18, fontFamily: ITAL, fontSize: 46, color: GRIS, lineHeight: 1.25 }}>{e.traduction}</div>
        </div>

        {/* barre de progression (un tronçon par étape) */}
        <div style={{ position: "absolute", top: 1712, left: 140, right: 140, display: "flex", gap: 12 }}>
          {p.etapes.map((x, i) => {
            const fait = i < ie ? 1 : i > ie ? 0 : compteEtape / x.repetitions;
            return (
              <div key={i} style={{ flex: x.repetitions, height: 12, borderRadius: 6, background: "#ffffff1f", overflow: "hidden" }}>
                <div style={{ width: `${(t >= finCompte ? 1 : fait) * 100}%`, height: "100%", borderRadius: 6,
                  background: `linear-gradient(90deg, ${OR_FONCE}, ${OR_CLAIR})`, boxShadow: `0 0 14px ${OR}` }} />
              </div>
            );
          })}
        </div>
        <div style={{ position: "absolute", top: 1750, width: "100%", textAlign: "center", fontSize: 28, letterSpacing: 6,
          fontWeight: 700, color: OR }}>DIS-LE AVEC NOUS</div>
      </AbsoluteFill>

      {/* --- marque en bas --- */}
      <div style={{ position: "absolute", top: 1820, width: "100%", textAlign: "center", fontFamily: SERIF, fontSize: 34,
        color: GRIS, letterSpacing: 3 }}>{p.marque}</div>

      {/* --- intro : la promesse avant de scroller --- */}
      {t < p.introDuree + 0.1 && (
        <AbsoluteFill style={{ opacity: intro, background: "#050403cc", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 80 }}>
          <div style={{ opacity: apparait(0), transform: `translateY(${montee(0)}px)`, fontSize: 36, letterSpacing: 8, fontWeight: 700, color: OR }}>{p.introHaut}</div>
          <div style={{ opacity: apparait(0.25), transform: `translateY(${montee(0.25)}px)`, marginTop: 40, fontFamily: SERIF, fontSize: 104,
            lineHeight: 1.05, color: OR_CLAIR, fontWeight: 600, textShadow: `0 0 30px ${OR}66` }}>{p.introTitre}</div>
          <div style={{ opacity: apparait(0.6), transform: `translateY(${montee(0.6)}px)`, marginTop: 36, fontSize: 44, fontWeight: 700, letterSpacing: 4, color: "#fff" }}>{p.introSous}</div>
          <div style={{ opacity: apparait(1.0), transform: `translateY(${montee(1.0)}px)`, marginTop: 60, fontFamily: ITAL, fontSize: 56, color: CREME }}>{p.appel}</div>
        </AbsoluteFill>
      )}

      {/* --- fin : la récompense, la source, l'appel --- */}
      {t >= finCompte && (
        <AbsoluteFill style={{ opacity: fin, alignItems: "center", justifyContent: "center", textAlign: "center", padding: 90 }}>
          <div style={{ fontSize: 34, letterSpacing: 8, fontWeight: 700, color: OR }}>{p.finHaut}</div>
          <div style={{ marginTop: 44, fontFamily: SERIF, fontSize: p.recompense.length > 110 ? 58 : 70, lineHeight: 1.18, color: OR_CLAIR,
            textShadow: `0 0 26px ${OR}55` }}>« {p.recompense} »</div>
          <div style={{ marginTop: 34, fontSize: 30, letterSpacing: 4, fontWeight: 700, color: GRIS, textTransform: "uppercase" }}>{p.source}</div>
          <div style={{ marginTop: 80, fontFamily: ITAL, fontSize: 50, color: CREME, lineHeight: 1.3 }}>{p.finBas}</div>
        </AbsoluteFill>
      )}

      {/* --- son --- */}
      {clics.map((s, k) => (
        <Sequence key={k} from={Math.round(s * fps)} durationInFrames={8}>
          <Audio src={staticFile("sfx/perle.wav")} volume={0.55} />
        </Sequence>
      ))}
      {p.son && (
        <Sequence from={Math.round(finCompte * fps)} durationInFrames={Math.round(1.6 * fps)}>
          <Audio src={staticFile("sfx/fin.wav")} volume={0.35} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
