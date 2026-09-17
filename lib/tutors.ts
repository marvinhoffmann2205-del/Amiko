// TutorProfile architecture — unchanged from the artifact prototype.
// Adding a tutor means adding an entry here + (later) real voice/LLM
// config. Nothing in AmivoEngine or the UI should ever branch on
// tutor.id directly — everything reads from the profile object.

export type TutorVisual = {
  bgFrom: string; bgTo: string;
  skinFrom: string; skinTo: string;
  hairFrom: string; hairTo: string;
  topFrom: string; topTo: string;
  glow: string; accent: string; gold: string;
  brow: string; eye: string; blush: string; mouth: string;
};

export type TutorProfile = {
  id: string;
  name: string;
  city: string;
  country: string;
  comingSoon?: boolean;
  targetLanguage?: string;
  languagesSpoken?: string[];
  accent?: string;
  personality?: string[];
  interests?: string[];
  teachingStyle?: string;
  conversationStyle?: string;
  voiceProvider?: string | null;   // Phase 3B
  voiceId?: string | null;         // Phase 3B
  avatarProvider?: string;
  avatarId?: string;
  visual: TutorVisual;
  openingLines?: Record<string, string>;
  reactionPools?: Record<string, string[]>;
  boundaryReplies?: string[];
  helpReplies?: { opening: string; closing: string };
};

export const TUTORS: Record<string, TutorProfile> = {
  cami: {
    id: "cami",
    name: "Cami",
    city: "Medellín",
    country: "Colombia",
    targetLanguage: "es",
    languagesSpoken: ["es", "en"],
    accent: "Colombian (Medellín / paisa)",
    personality: ["warm", "playful", "curious", "patient", "encouraging", "relaxed", "light sense of humor"],
    interests: ["music", "coffee", "travel", "weekend plans"],
    teachingStyle: "reacts naturally first, teaches when useful, corrects sparingly",
    conversationStyle: "concise, question-driven, leaves room for the learner to talk",
    voiceProvider: "cartesia",
    voiceId: null, // actual Cartesia voice UUID lives server-side in CARTESIA_VOICE_ID_CAMI, not in source
    avatarProvider: "static-svg",
    avatarId: "cami-v1",
    visual: {
      bgFrom: "#F3C77E", bgTo: "#C1512F",
      skinFrom: "#F3C69C", skinTo: "#C9895A",
      hairFrom: "#4A2E1E", hairTo: "#241209",
      topFrom: "#E2653F", topTo: "#A63B22",
      glow: "#FBD48A", accent: "#E2653F", gold: "#D6A24A",
      brow: "#33200F", eye: "#3A2416", blush: "#C1637A", mouth: "#B5432E"
    },
    openingLines: {
      Beginner: "¡Hola! Soy Cami. Soy de Medellín. Qué gusto conocerte 😊. ¿Cómo te llamas? (You can answer in English or Spanish.)",
      Intermediate: "¡Hola! Soy Cami, de Medellín. Qué gusto conocerte. Cuéntame — ¿cómo te llamas y qué te trae a aprender español?",
      Advanced: "¡Quihubo! Soy Cami, paisa hasta la médula. Antes de arrancar — cuéntame algo random de tu día."
    },
    reactionPools: {
      Beginner: [
        "¡Qué bien! 😄 That means \"{echo}\" — nice. Try telling me one more small thing about it.",
        "Entiendo. ¡Vas bien! ¿Y después qué pasó?",
        "¡Jajaja, me gusta! Let's keep going — ¿qué más?"
      ],
      Intermediate: [
        "¿En serio? 😄 ¿Y qué pasó después?",
        "Jajaja, no te creo. Cuéntame más.",
        "Uy, me identifico con eso. ¿Y eso pasa seguido?"
      ],
      Advanced: [
        "Jajaja, qué berraquera 😂. ¿Y cómo terminó todo eso?",
        "Eso sí que es muy paisa de tu parte, jajaja. Sigue.",
        "Me encanta por dónde va esto. ¿Qué más me cuentas?"
      ]
    },
    boundaryReplies: [
      "Jajaja, qué lindo 😄. Pero recuerda, soy tu tutora de español. ¿Sabes cómo invitar a alguien a salir en español?",
      "Ay, gracias jajaja — pero mi trabajo aquí es ayudarte con tu español 😄. ¿Practicamos vocabulario de citas?"
    ],
    helpReplies: {
      opening: "No te preocupes — I'll explain in English for a second. ",
      closing: " Ahora volvamos al español — ¿lista/o para seguir?"
    }
  },
  mateo: {
    id: "mateo",
    name: "Mateo",
    city: "Bogotá",
    country: "Colombia",
    comingSoon: true,
    personality: ["relaxed", "witty", "curious", "patient", "confident", "encouraging", "easygoing"],
    visual: {
      bgFrom: "#EAD9A8", bgTo: "#5C7A73",
      skinFrom: "#E3B78C", skinTo: "#B57C51",
      hairFrom: "#241914", hairTo: "#140D0A",
      topFrom: "#3F6E63", topTo: "#25453C",
      glow: "#CFE3D8", accent: "#3F6E63", gold: "#B7A15A",
      brow: "#1E140F", eye: "#241914", blush: "#A9765F", mouth: "#8C4A34"
    }
  }
};
