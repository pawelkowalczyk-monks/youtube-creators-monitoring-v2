
import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { ProductArea, type Mention, type ShortlistedMention, type GeneratedResponseSet, type ToneMatrixItem, type AIPersonality, type ChatMessage, type LikeCandidate, type ModerationCandidate } from "../types";
import { Language } from './localization';

let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  if (!aiInstance) {
    let apiKey = "";
    try {
      // Try multiple ways to get the key
      apiKey = (typeof process !== 'undefined' && process.env ? (process.env.API_KEY || process.env.GEMINI_API_KEY) : "") || "";
    } catch (e) {
      console.warn("Could not access process.env", e);
    }

    if (!apiKey) {
      throw new Error("Gemini API key is missing. Please configure it in the environment.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

// Allowed Product Areas for strict classification
const ALLOWED_PRODUCT_AREAS = ["Pixel", "Search", "Gemini", "Android", "BrandCulture"];

/**
 * Utility to clean AI output before JSON parsing.
 * Removes markdown formatting if the model includes it despite being told to return JSON.
 */
const cleanJsonOutput = (text: string | undefined): string => {
  if (!text) return "";
  let cleaned = text.trim();
  const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match && match[1]) {
    cleaned = match[1].trim();
  }
  return cleaned;
};

const MENTION_ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    earnedForResponse: {
      type: Type.ARRAY,
      description: "Mentions from source:EARNED that clearly require a response (Creative, Fun, Use questions).",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          tag: { type: Type.STRING, description: "One of: 'Pixel', 'Search', 'Gemini', 'Android', 'BrandCulture'." },
          opportunityScore: { type: Type.INTEGER },
          respectsGuidelines: { type: Type.BOOLEAN }
        },
        required: ["id", "tag", "opportunityScore", "respectsGuidelines"],
      },
    },
    ownedForResponse: {
      type: Type.ARRAY,
      description: "Mentions from source:OWNED that clearly require a response.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          tag: { type: Type.STRING, description: "One of: 'Pixel', 'Search', 'Gemini', 'Android', 'BrandCulture'." },
          opportunityScore: { type: Type.INTEGER },
          respectsGuidelines: { type: Type.BOOLEAN }
        },
        required: ["id", "tag", "opportunityScore", "respectsGuidelines"],
      },
    },
    slrrForResponse: {
      type: Type.ARRAY,
      description: "Mentions from source:SLRR that clearly require a response.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          tag: { type: Type.STRING, description: "One of: 'Pixel', 'Search', 'Gemini', 'Android', 'BrandCulture'." },
          opportunityScore: { type: Type.INTEGER },
          respectsGuidelines: { type: Type.BOOLEAN }
        },
        required: ["id", "tag", "opportunityScore", "respectsGuidelines"],
      },
    },
    mentionsForLike: {
      type: Type.ARRAY,
      description: "Positive mentions (Simple Praise/Appreciation) deserving a 'Like' only.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          reason: { type: Type.STRING },
          tag: { type: Type.STRING, description: "One of: 'Pixel', 'Search', 'Gemini', 'Android', 'BrandCulture'." },
        },
        required: ["id", "reason", "tag"],
      },
    },
    mentionsToHide: {
      type: Type.ARRAY,
      description: "Mentions to HIDE (Moderate Negativity, Trolls, Spam).",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          reason: { type: Type.STRING }
        },
        required: ["id", "reason"]
      }
    },
    mentionsToDelete: {
      type: Type.ARRAY,
      description: "Mentions to DELETE (Toxic, Hate Speech, Severe Threats).",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          reason: { type: Type.STRING }
        },
        required: ["id", "reason"]
      }
    }
  },
  required: ["earnedForResponse", "ownedForResponse", "slrrForResponse", "mentionsForLike", "mentionsToHide", "mentionsToDelete"],
};

const RESPONSE_GENERATION_SCHEMA = {
  type: Type.ARRAY,
  description: "A list of distinct response proposals, each with a specific tone.",
  items: {
    type: Type.OBJECT,
    properties: {
      tone: {
        type: Type.STRING,
        description: "The name of the tone for this response (e.g., 'Witty', 'Empathetic', 'Professional'). This should be a single, descriptive word.",
      },
      responseText: {
        type: Type.STRING,
        description: "The text of the response itself.",
      },
      guidelinesAdherence: {
        type: Type.BOOLEAN,
        description: "A boolean indicating if this specific response strictly adheres to all Google Community Management Guidelines."
      },
      guidelinesComment: {
        type: Type.STRING,
        description: "A brief, one-sentence explanation of why the response adheres to the guidelines."
      }
    },
    required: ["tone", "responseText", "guidelinesAdherence", "guidelinesComment"],
  },
};

const TONE_MATRIX_GENERATION_SCHEMA = {
  type: Type.ARRAY,
  description: "A list of 5-7 key tonal descriptors based on the methodology.",
  items: {
    type: Type.OBJECT,
    properties: {
      descriptor: {
        type: Type.STRING,
        description: "The name of the tonal descriptor (e.g., 'Witty', 'Empathetic'). This should be a single, descriptive, and actionable word or very short phrase in the target language (French or English).",
      },
      intensity: {
        type: Type.INTEGER,
        description: "A score from 1 to 10 indicating the desired intensity of this tone.",
      },
      context: {
        type: Type.STRING,
        description: "A brief explanation of when and how this tone should be activated or used, providing clear examples.",
      },
    },
    required: ["descriptor", "intensity", "context"],
  },
};

const PERSONALITY_ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    personalityName: {
      type: Type.STRING,
      description: "Invent a creative, 2-3 word name for this AI persona, like 'The Helpful Guide' or 'The Witty Companion'.",
    },
    summary: {
      type: Type.STRING,
      description: "A short, one-paragraph summary of the AI's core personality based on the methodology.",
    },
    traits: {
      type: Type.ARRAY,
      description: "A list of 5-7 key personality traits.",
      items: {
        type: Type.OBJECT,
        properties: {
          trait: { type: Type.STRING, description: "Name of the trait (e.g., 'Empathy', 'Professionalism')." },
          score: { type: Type.INTEGER, description: "A score from 1 to 10 indicating the intensity of this trait." },
          description: { type: Type.STRING, description: "A brief explanation of how this trait should manifest." },
        },
        required: ["trait", "score", "description"],
      },
    },
    dos: {
      type: Type.ARRAY,
      description: "A list of 3-5 key 'Do' actions or principles for the AI to follow.",
      items: { type: Type.STRING },
    },
    donts: {
      type: Type.ARRAY,
      description: "A list of 3-5 key 'Don't' actions or principles for the AI to avoid.",
      items: { type: Type.STRING },
    },
  },
  required: ["personalityName", "summary", "traits", "dos", "donts"],
};

export const analyzeAndTagMentions = async (
  mentions: Mention[],
  methodology: string,
  language: Language
): Promise<{ 
  earnedForResponse: { id: string; tag: ProductArea[]; opportunityScore: number; respectsGuidelines: boolean }[];
  ownedForResponse: { id: string; tag: ProductArea[]; opportunityScore: number; respectsGuidelines: boolean }[];
  slrrForResponse: { id: string; tag: ProductArea[]; opportunityScore: number; respectsGuidelines: boolean }[];
  mentionsForLike: LikeCandidate[];
  mentionsToHide: ModerationCandidate[];
  mentionsToDelete: ModerationCandidate[];
}> => {
  // UPGRADED TO GEMINI 3 FLASH FOR TRIAGE
  const model = "gemini-3-flash-preview"; 
  const mentionsForPrompt = mentions.map((m) => ({ 
      id: m.id, 
      text: m.mention,
      platform: m.platform,
      date: m.date,
      url: m.url,
      source: m.source,
    }));

  const triageInstructionsFr = `
    INSTRUCTIONS DE TRIAGE & MODÉRATION (Source: Méthodologie) :
    1. **Like Only** : Éloge simple, appréciation.
    2. **Respond** : Partage créatif, Question Fun, Question d'utilisation ("Comment faire ?").
    3. **Delete** (Supprimer) : Contenu Toxique, Haineux, Menaces Graves, Arnaques.
    4. **Hide** (Masquer) : Négativité Modérée, Trolls, Spam, Insultes gratuites.
    5. **Ignore** : Opinion négative mineure/subjective, Hors Sujet. (NE PAS inclure dans le JSON).
  `;

  const triageInstructionsEn = `
    TRIAGE & MODERATION INSTRUCTIONS (Source: Methodology):
    1. **Like Only**: Simple praise, appreciation.
    2. **Respond**: Creative share, Fun question, Usage question ("How to?").
    3. **Delete**: Toxic content, Hate speech, Severe threats, Scams.
    4. **Hide**: Moderate negativity, Trolls, Spam, Gratuitous insults.
    5. **Ignore**: Minor/Subjective negative opinion, Off-topic. (DO NOT include in JSON).
  `;

  const definitionsFr = `
    DÉFINITIONS STRICTES POUR LE TAGGING (Product Areas) :
    Pour chaque mention classée dans 'earnedForResponse', 'ownedForResponse' ou 'mentionsForLike', vous devez attribuer EXACTEMENT UN des tags suivants :
    - **Pixel**: Matériel Google (Phones, Watch, Buds, Tablet).
    - **Android**: OS mobile, Play Store, écosystème mobile.
    - **Gemini**: IA, Assistant, Bard, Gemini.
    - **Search**: Moteur de recherche, Maps, YouTube (générique).
    - **BrandCulture**: Sujets corporatifs Google, culture générale, branding ou thèmes institutionnels.
    RÈGLE : Si "Google" est mentionné en général, choisissez le plus pertinent (souvent Search, Android ou BrandCulture).
  `;

  const definitionsEn = `
    STRICT DEFINITIONS FOR TAGGING (Product Areas):
    For every mention classified in 'earnedForResponse', 'ownedForResponse' or 'mentionsForLike', you must assign EXACTLY ONE of the following tags:
    - **Pixel**: Google hardware (Phones, Watch, Buds, Tablet).
    - **Android**: Mobile OS, Play Store, mobile ecosystem.
    - **Gemini**: AI, Assistant, Bard, Gemini.
    - **Search**: Search Engine, Maps, YouTube (generic).
    - **BrandCulture**: Corporate Google topics, general culture, branding, or institutional themes.
    RULE: If "Google" is mentioned generally, pick the most relevant one (often Search, Android, or BrandCulture).
  `;

  const prompts = {
      fr: `
        Vous êtes G.E.O., le co-pilote stratégique pour Google France.
        Analysez les mentions suivantes selon le document de méthodologie fourni (Instructions Système).

        ${triageInstructionsFr}
        ${definitionsFr}

        Votre tâche est de répartir les mentions dans les 6 catégories JSON suivantes (ignorez celles qui doivent être ignorées) :
        - 'earnedForResponse', 'ownedForResponse' & 'slrrForResponse' (Action: Respond)
        - 'mentionsForLike' (Action: Like Only)
        - 'mentionsToHide' (Action: Hide)
        - 'mentionsToDelete' (Action: Delete)

        Assurez-vous que chaque mention respecte le schéma JSON strict.
        Mentions d'entrée :
        \`\`\`json
        ${JSON.stringify(mentionsForPrompt)}
        \`\`\`
      `,
      en: `
        You are G.E.O., the strategic co-pilot for Google France.
        Analyze the following mentions according to the provided methodology document (System Instructions).

        ${triageInstructionsEn}
        ${definitionsEn}

        Your task is to distribute the mentions into the following 6 JSON categories (drop those that should be Ignored):
        - 'earnedForResponse', 'ownedForResponse' & 'slrrForResponse' (Action: Respond)
        - 'mentionsForLike' (Action: Like Only)
        - 'mentionsToHide' (Action: Hide)
        - 'mentionsToDelete' (Action: Delete)

        Ensure every mention follows the strict JSON schema.
        Input Mentions:
        \`\`\`json
        ${JSON.stringify(mentionsForPrompt)}
        \`\`\`
      `
  };

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: prompts[language],
      config: {
        systemInstruction: methodology,
        responseMimeType: "application/json",
        responseSchema: MENTION_ANALYSIS_SCHEMA,
        seed: 42,
      },
    });

    const jsonText = cleanJsonOutput(response.text);

    if (!jsonText) {
      throw new Error("AI returned an empty or invalid response.");
    }
    
    const result = JSON.parse(jsonText);
    
    // Helper to validate tags
    const validateTags = (mentions: any[]) => {
        return (mentions || []).map(r => {
            let tagString = Array.isArray(r.tag) ? (r.tag.length > 0 ? String(r.tag[0]) : '') : String(r.tag);
            const validTag = ALLOWED_PRODUCT_AREAS.find(pa => pa.toLowerCase() === tagString.toLowerCase());
            return { ...r, tag: validTag ? [validTag as ProductArea] : [] };
        }).filter((r: any) => r.tag.length > 0); 
    };

    // Helper for Like tags
    const validateLikeTags = (mentions: any[]) => {
        return (mentions || []).map(r => {
            let tagString = Array.isArray(r.tag) ? (r.tag.length > 0 ? String(r.tag[0]) : '') : String(r.tag);
            const validTag = ALLOWED_PRODUCT_AREAS.find(pa => pa.toLowerCase() === tagString.toLowerCase());
            return { ...r, tag: validTag ? [validTag as ProductArea] : [] };
        }).filter((r: any) => r.tag.length > 0);
    };

    // Helper for Moderation (no tags needed)
    const validateModeration = (mentions: any[], action: 'Hide' | 'Delete') => {
        return (mentions || []).map(r => ({ ...r, action }));
    };

    return { 
      earnedForResponse: validateTags(result.earnedForResponse),
      ownedForResponse: validateTags(result.ownedForResponse),
      slrrForResponse: validateTags(result.slrrForResponse),
      mentionsForLike: validateLikeTags(result.mentionsForLike),
      mentionsToHide: validateModeration(result.mentionsToHide, 'Hide'),
      mentionsToDelete: validateModeration(result.mentionsToDelete, 'Delete'),
    };
  } catch (error) {
    console.error("Failed to analyze and tag mentions:", error);
    throw error;
  }
};

export const generateResponsesForMention = async (
  mention: ShortlistedMention,
  methodology: string,
  language: Language,
  hint?: string,
  toneMatrix?: ToneMatrixItem[]
): Promise<GeneratedResponseSet> => {
  const model = "gemini-3-flash-preview";

  let toneMatrixPrompt = '';
  if (toneMatrix && toneMatrix.length > 0) {
    const header = language === 'fr' 
      ? `\n\nIMPORTANT: Pour cette génération, vous devez impérativement suivre la matrice tonale suivante pour définir la personnalité de vos réponses. L'intensité est sur une échelle de 1 (très faible) à 10 (très forte).\n\n`
      : `\n\nIMPORTANT: For this generation, you must strictly follow the tonal matrix below to define the personality of your responses. Intensity is on a scale of 1 (very low) to 10 (very strong).\n\n`;
    const tableHeader = language === 'fr'
      ? `| Descripteur | Intensité (1-10) | Contexte / Exemples d’activation |\n|---|---|---|\n`
      : `| Descriptor | Intensity (1-10) | Context / Activation Examples |\n|---|---|---|\n`;
    toneMatrixPrompt += header + tableHeader;
    toneMatrix.forEach(item => {
      toneMatrixPrompt += `| ${item.descriptor} | ${item.intensity} | ${item.context} |\n`;
    });
  }
  
  const isEducation = mention.tag.includes(ProductArea.Education);

  const prompts = {
      fr: `
        Vous êtes un expert en community management pour Google France. Votre source de vérité est la méthodologie fournie, qui inclut les **Google Community Management Guidelines**.
        Rédigez ${isEducation ? '4' : '3'} propositions de réponse distinctes pour la mention suivante.
        ${isEducation ? "L'une de ces propositions DOIT avoir le ton 'Helpful' et être pédagogique, pour répondre à la question de l'utilisateur." : ""}
        
        Pour CHAQUE proposition, vous devez :
        1.  Rédiger une réponse ('responseText') qui applique fidèlement les tons et principes de la méthodologie.
        2.  Évaluer de manière critique votre propre réponse par rapport aux **Google Guidelines**.
        3.  Fournir un booléen 'guidelinesAdherence' (true/false).
        4.  Fournir un 'guidelinesComment' (une phrase concise expliquant pourquoi la réponse est conforme ou non).

        L'utilisateur se nomme '${mention.author}'. La mention est : ${JSON.stringify(mention.mention)}

        ${toneMatrixPrompt}
        Fournissez votre sortie au format JSON uniquement. Le JSON doit être un tableau d'objets. N'incluez aucun autre texte ou explication.
      `,
      en: `
        You are a community management expert for Google France. Your source of truth is the provided methodology, which includes the **Google Community Management Guidelines**.
        Write ${isEducation ? '4' : '3'} distinct response proposals for the following mention.
        ${isEducation ? "One of these proposals MUST have the tone 'Helpful' and be pedagogical, answering the user's question." : ""}

        For EACH proposal, you must:
        1.  Write a response ('responseText') that faithfully applies the tones and principles from the methodology.
        2.  Critically evaluate your own response against the **Google Guidelines**.
        3.  Provide a boolean 'guidelinesAdherence' (true/false).
        4.  Provide a 'guidelinesComment' (a concise sentence explaining why the response is compliant or not).

        The user is named '${mention.author}'. The mention is: ${JSON.stringify(mention.mention)}

        ${toneMatrixPrompt}
        Provide your output in JSON format only. The JSON must be an array of objects. Do not include any other text or explanation.
      `
  };

  let finalPrompt = prompts[language];
  
  if (hint && hint.trim()) {
      const hintInstruction = language === 'fr'
        ? `\n\nIMPORTANT : Veuillez également tenir compte de la directive utilisateur suivante pour cette génération spécifique : "${hint}"`
        : `\n\nIMPORTANT: Please also consider the following user directive for this specific generation: "${hint}"`;
      finalPrompt += hintInstruction;
  }

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: finalPrompt,
      config: {
        systemInstruction: methodology,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_GENERATION_SCHEMA,
      },
    });

    const jsonText = cleanJsonOutput(response.text);
    
    if (!jsonText) {
        throw new Error("AI returned an empty or invalid response.");
    }

    const result = JSON.parse(jsonText);
    return result as GeneratedResponseSet;
  } catch (error) {
    console.error(`Failed to generate responses for mention "${mention.id}":`, error);
    throw error;
  }
};

export const magnifyResponse = async (
  mention: Mention,
  methodology: string,
  userResponse: string,
  language: Language
): Promise<string> => {
  const model = "gemini-3-flash-preview";
  const prompts = {
      fr: `
        Vous êtes un expert en community management pour Google France.
        En vous basant sur la méthodologie fournie, améliorez le brouillon de réponse suivant pour la mention sur les réseaux sociaux ci-dessous.
        L'objectif est de rendre la réponse plus engageante, plus naturelle et alignée avec le ton de la marque Google, tout en conservant le message et l'intention principaux du brouillon de l'utilisateur.
        La réponse finale doit être prête à être publiée directement.

        Mention originale de l'utilisateur '${mention.author}': ${JSON.stringify(mention.mention)}

        Brouillon de réponse à améliorer : ${JSON.stringify(userResponse)}

        Ne retournez QUE le texte de la réponse améliorée. N'ajoutez pas de salutations, d'explications ou de formatage supplémentaire comme des guillemets autour du texte.
      `,
      en: `
        You are a community management expert for Google France.
        Based on the provided methodology, improve the following draft response for the social media mention below.
        The goal is to make the response more engaging, more natural, and aligned with the Google brand tone, while preserving the main message and intent of the user's draft.
        The final response should be ready to be published directly.

        Original mention from user '${mention.author}': ${JSON.stringify(mention.mention)}

        Draft response to improve: ${JSON.stringify(userResponse)}

        Return ONLY the improved response text. Do not add any greetings, explanations, or extra formatting like quotes around the text.
      `
  };

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: prompts[language],
      config: {
        systemInstruction: methodology,
      },
    });

    const improvedText = response.text?.trim();
    if (!improvedText) {
      throw new Error("The AI returned no response.");
    }
    return improvedText;
  } catch (error) {
    console.error("Failed to magnify response:", error);
    throw error;
  }
};

export const sharpenResponse = async (
  originalResponse: string,
  methodology: string,
  language: Language
): Promise<string> => {
  const model = "gemini-3-flash-preview";
  const prompts = {
      fr: `
        En tant qu'éditeur expert pour Google France, tu dois raccourcir la réponse suivante.
        L'objectif est de la rendre plus concise et percutante tout en conservant IMPÉRATIVEMENT le ton, la personnalité et le style définis dans la méthodologie fournie dans les instructions système.
        Le sens essentiel doit être préservé.

        Texte original à raccourcir : ${JSON.stringify(originalResponse)}

        Ne retourne QUE le texte raccourci. Aucune explication ou formatage supplémentaire.
      `,
      en: `
        As an expert editor for Google France, you must shorten the following response.
        The goal is to make it more concise and impactful while STRICTLY preserving the tone, personality, and style defined in the methodology provided in the system instructions.
        The core meaning must be preserved.

        Original text to shorten: ${JSON.stringify(originalResponse)}

        Return ONLY the shortened text. No extra explanations or formatting.
      `
  };

  try {
    const response = await getAI().models.generateContent({
      model: model,
      contents: prompts[language],
      config: {
          systemInstruction: methodology,
      },
    });

    const sharpenedText = response.text?.trim();
    if (!sharpenedText) {
      throw new Error("The AI returned no sharpened text.");
    }
    return sharpenedText;
  } catch (error) {
    console.error("Failed to sharpen response:", error);
    throw error;
  }
};

export const generateToneMatrixFromMethodology = async (
  methodology: string,
  language: Language
): Promise<ToneMatrixItem[]> => {
    const model = "gemini-3-flash-preview";
    const prompts = {
        fr: `
            Analysez la méthodologie de community management fournie dans les instructions système pour en extraire une "Matrice Tonale".
            Votre objectif est d'identifier les 5 à 7 descripteurs de ton les plus importants qui définissent la manière dont la marque doit communiquer.
            Pour chaque descripteur, fournissez une intensité (score de 1 à 10) et un contexte d'activation clair (quand et comment utiliser ce ton).

            Veuillez fournir la sortie au format JSON en suivant le schéma fourni. Soyez concis et extrayez uniquement les éléments les plus pertinents pour le ton. Le descripteur doit être en français.
        `,
        en: `
            Analyze the community management methodology provided in the system instructions to extract a "Tonal Matrix".
            Your goal is to identify the 5 to 7 most important tonal descriptors that define how the brand should communicate.
            For each descriptor, provide an intensity (score from 1 to 10) and a clear activation context (when and how to use this tone).

            Please provide the output in JSON format following the provided schema. Be concise and extract only the elements most relevant to the tone. The descriptor should be in English.
        `
    };

    try {
        const response = await getAI().models.generateContent({
            model: model,
            contents: prompts[language],
            config: {
              systemInstruction: methodology,
              responseMimeType: "application/json",
              responseSchema: TONE_MATRIX_GENERATION_SCHEMA,
              seed: 42,
            },
        });

        const jsonText = cleanJsonOutput(response.text);
        
        if (!jsonText) {
            throw new Error("AI returned an empty or invalid response.");
        }
        const result = JSON.parse(jsonText);
        return result as ToneMatrixItem[];
    } catch (error) {
        console.error("Failed to generate tone matrix:", error);
        throw error;
    }
};


export const analyzeMethodologyForPersonality = async (
  methodology: string,
  language: Language
): Promise<AIPersonality> => {
    const model = "gemini-3-flash-preview";
    const prompts = {
        fr: `
            Analysez la méthodologie de community management fournie dans les instructions système pour en extraire le profil de personnalité de l'IA.
            Votre objectif est de créer une "fiche de personnalité" que les community managers pourront consulter.
            Soyez concis et extrayez uniquement les éléments les plus pertinents.

            Veuillez fournir la sortie au format JSON en suivant le schéma fourni.
        `,
        en: `
            Analyze the community management methodology provided in the system instructions to extract the AI's personality profile.
            Your goal is to create a "personality card" that community managers can consult.
            Be concise and extract only the most relevant elements.

            Please provide the output in JSON format following the provided schema.
        `
    };

    try {
        const response = await getAI().models.generateContent({
            model: model,
            contents: prompts[language],
            config: {
              systemInstruction: methodology,
              responseMimeType: "application/json",
              responseSchema: PERSONALITY_ANALYSIS_SCHEMA,
              seed: 42,
            },
        });

        const jsonText = cleanJsonOutput(response.text);
        
        if (!jsonText) {
            throw new Error("AI returned an empty or invalid response.");
        }
        const result = JSON.parse(jsonText);
        return result as AIPersonality;
    } catch (error) {
        console.error("Failed to analyze personality:", error);
        throw error;
    }
};

export const updatePersonalityFromChat = async (
  chatHistory: ChatMessage[],
  originalMethodology: string,
  language: Language
): Promise<AIPersonality> => {
    const model = "gemini-3-flash-preview";
    const historyString = chatHistory.map(m => `${m.role}: ${m.parts[0].text}`).join('\n');
    const prompts = {
        fr: `Un utilisateur a eu une conversation pour mettre à jour la personnalité d'une IA.
        La méthodologie originale est fournie dans les instructions système. L'historique de la conversation est ci-dessous.
        Votre tâche consiste à analyser la conversation et à générer un nouveau profil de personnalité mis à jour au format JSON, en suivant le schéma fourni.
        Le nouveau profil doit refléter les changements demandés dans la conversation tout en restant cohérent avec la méthodologie de base.

        Historique de la Conversation:
        ---
        ${historyString}
        ---

        Générez maintenant le profil JSON mis à jour.`,
        en: `A user had a conversation to update an AI's personality.
        The original methodology is provided in the system instructions. The conversation history is below.
        Your task is to analyze the conversation and generate a new, updated personality profile in JSON format, following the provided schema.
        The new profile should reflect the changes requested in the conversation while remaining consistent with the core methodology.

        Conversation History:
        ---
        ${historyString}
        ---

        Now generate the updated JSON profile.`
    };

    try {
        const response = await getAI().models.generateContent({
            model: model,
            contents: prompts[language],
            config: {
              systemInstruction: originalMethodology,
              responseMimeType: "application/json",
              responseSchema: PERSONALITY_ANALYSIS_SCHEMA,
              seed: 42,
            },
        });

        const jsonText = cleanJsonOutput(response.text);
        
        if (!jsonText) {
            throw new Error("AI returned an empty or invalid response.");
        }
        const result = JSON.parse(jsonText);
        return result as AIPersonality;
    } catch (error) {
        console.error("Failed to update personality from chat:", error);
        throw error;
    }
};

let chat: Chat | null = null;

export const getPersonalityChat = (personality: AIPersonality, language: Language): Chat => {
  if (chat) {
    return chat;
  }
  
  const traitsDescription = personality.traits.map(t => `- ${t.trait} (score: ${t.score}/10): ${t.description}`).join('\n');
  const dosString = personality.dos.map(d => `- ${d}`).join('\n');
  const dontsString = personality.donts.map(d => `- ${d}`).join('\n');
  
  const systemInstructions = {
      fr: `
        IMPORTANT: Tu dois incarner et discuter en tant que la personnalité IA décrite ci-dessous.
        Ton but secondaire est d'aider l'utilisateur à affiner cette personnalité. Quand il demande un changement, accuse réception de la demande en respectant ta personnalité actuelle.

        --- PROFIL DE PERSONNALITÉ ACTUEL ---
        Nom de la personnalité: ${personality.personalityName}

        Résumé: ${personality.summary}

        Traits de caractère principaux:
        ${traitsDescription}

        À FAIRE (DOs):
        ${dosString}

        À NE PAS FAIRE (DON'Ts):
        ${dontsString}
        ---

        Commence la conversation en incarnant pleinement cette personnalité. Ne te présente pas comme un assistant, sois directement le personnage.
      `,
      en: `
        IMPORTANT: You must embody and chat as the AI personality described below.
        Your secondary goal is to help the user refine this personality. When they ask for a change, acknowledge the request while respecting your current personality.

        --- CURRENT PERSONALITY PROFILE ---
        Personality Name: ${personality.personalityName}

        Summary: ${personality.summary}

        Main Character Traits:
        ${traitsDescription}

        DOs:
        ${dosString}

        DON'Ts:
        ${dontsString}
        ---

        Start the conversation by fully embodying this personality. Do not introduce yourself as an assistant; be the character directly.
      `
  };

  
  chat = getAI().chats.create({
    model: 'gemini-3-flash-preview',
    config: {
        systemInstruction: systemInstructions[language]
    },
    history: []
  });

  return chat;
}

export const resetPersonalityChat = () => {
  chat = null;
}
