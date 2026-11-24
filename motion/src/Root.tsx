import React from "react";
import { Composition, staticFile } from "remotion";
import { loadFont } from "@remotion/fonts";
import { Flash } from "./Flash";
import { Dhikr, type DhikrProps } from "./Dhikr";
import type { FlashProps } from "./types";
import demo from "./demo.json";

const FPS = 30;

loadFont({ family: "Amiri", url: staticFile("fonts/Amiri-arabe.woff2"), weight: "400" });
loadFont({ family: "Cormorant", url: staticFile("fonts/Cormorant.woff2"), weight: "600" });
loadFont({ family: "Cormorant Italique", url: staticFile("fonts/Cormorant-italique.woff2"), weight: "500" });
loadFont({ family: "Plus Jakarta Sans", url: staticFile("fonts/PlusJakartaSans.ttf"), weight: "200 800" });

const DHIKR_DEMO: DhikrProps = {
  marque: "Dhikr du jour", source: "Sahîh Muslim 2702", introHaut: "AVANT DE SCROLLER", introTitre: "Astaghfirullah", introSous: "10 FOIS",
  appel: "Dis-le avec nous.", recompense: "Le Prophète ﷺ se repentait à Allah cent fois par jour.", finHaut: "QU'ALLAH L'ACCEPTE",
  finBas: "Enregistre-la pour après ta prière.", introDuree: 3.2, outroDuree: 5.5, duree: 3.2 + 10 + 5.5, son: true,
  etapes: [{ arabe: "أَسْتَغْفِرُ اللَّهَ", phonetique: "ASTAGHFIRULLÂH", traduction: "Je demande pardon à Allah", repetitions: 10, secondes: 1, debut: 3.2 }],
};

export const Root: React.FC = () => (
  <>
  <Composition
    id="Dhikr"
    component={Dhikr}
    fps={FPS}
    width={1080}
    height={1920}
    durationInFrames={Math.ceil(DHIKR_DEMO.duree * FPS)}
    defaultProps={DHIKR_DEMO}
    calculateMetadata={({ props }) => ({ durationInFrames: Math.max(30, Math.ceil(props.duree * FPS)) })}
  />
  <Composition
    id="Flash"
    component={Flash}
    fps={FPS}
    width={1080}
    height={1920}
    durationInFrames={Math.ceil((demo as unknown as FlashProps).duree * FPS)}
    defaultProps={demo as unknown as FlashProps}
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.max(30, Math.ceil(props.duree * FPS)),
    })}
  />
  </>
);
