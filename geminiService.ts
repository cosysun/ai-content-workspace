
import { GoogleGenAI, Type } from "@google/genai";
import { Platform, Scene } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeContent = async (content: string, platform: Platform) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze the following content and provide a video creation strategy for ${platform}. 
    Content: "${content}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          coreInfo: { type: Type.STRING, description: 'Summary of core information' },
          audience: { type: Type.STRING, description: 'Target audience analysis' },
          strategy: { type: Type.STRING, description: 'Step-by-step content strategy' },
        },
        required: ["coreInfo", "audience", "strategy"]
      }
    }
  });
  return JSON.parse(response.text);
};

export const generateViralScript = async (analysis: any, platform: Platform) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a viral video script for ${platform} based on this analysis: ${JSON.stringify(analysis)}. 
    The script should have a strong hook, engaging body, and clear CTA.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          content: { type: Type.STRING, description: 'The full narration script' },
        },
        required: ["title", "content"]
      }
    }
  });
  return JSON.parse(response.text);
};

export const splitScenes = async (script: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Split the following video script into logical visual scenes. 
    Script: "${script}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            time: { type: Type.STRING, description: 'Approximate timestamp or duration like 00:00-00:05' },
            narration: { type: Type.STRING },
          },
          required: ["id", "time", "narration"]
        }
      }
    }
  });
  return JSON.parse(response.text);
};

export const generateVisualAssets = async (scenes: any[]) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `For each of these scenes, generate visual matching data (Pixabay keywords and AI Image prompt). 
    Scenes: ${JSON.stringify(scenes)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            visualKeywords: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING }, 
              description: 'English keywords for stock footage search' 
            },
            imagePrompt: { type: Type.STRING, description: 'Detailed AI image generation prompt' },
          },
          required: ["id", "visualKeywords", "imagePrompt"]
        }
      }
    }
  });
  return JSON.parse(response.text);
};

export const generatePackaging = async (script: string, platform: Platform) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate final packaging metadata (Title, Description, Tags, Cover Prompt) for a ${platform} video based on this script: ${script}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          videoTitle: { type: Type.STRING },
          description: { type: Type.STRING },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          coverPrompt: { type: Type.STRING },
        },
        required: ["videoTitle", "description", "tags", "coverPrompt"]
      }
    }
  });
  return JSON.parse(response.text);
};

export const generateImage = async (prompt: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: prompt }]
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9",
      }
    }
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
};
