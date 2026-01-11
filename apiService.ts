
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Platform, Scene } from "./types";

// Always use process.env.API_KEY directly as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Utility to convert a Blob to a Data URL
 */
const blobToDataURL = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const analyzeContent = async (content: string, platform: Platform) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `你是一位专业的短视频内容战略专家。请分析以下内容并为 ${platform} 平台制定策略。\n内容原文：${content}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          coreInfo: { type: Type.STRING, description: '核心信息的简明总结' },
          audience: { type: Type.STRING, description: '目标受众画像分析' },
          strategy: { type: Type.STRING, description: '针对平台的具体创作建议' },
        },
        required: ["coreInfo", "audience", "strategy"]
      }
    }
  });
  return JSON.parse(response.text);
};

export const generateViralScript = async (analysis: any, platform: Platform) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `你是一位资深的爆款视频编剧。根据以下分析结果，为 ${platform} 创作一份具有高度吸引力的视频口播稿。\n分析背景：${JSON.stringify(analysis)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: '吸引人的视频标题' },
          content: { type: Type.STRING, description: '完整的口播文案' },
        },
        required: ["title", "content"]
      }
    }
  });
  return JSON.parse(response.text);
};

export const splitScenes = async (script: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `你是一位视频剪辑导演。请将以下口播稿拆分为多个高度精细化的视觉场景。
    
    【核心要求】：
    1. **极短步频**：为了保证短视频的完播率和视觉冲击力，每个分镜的时长必须控制在 **3-5 秒以内**。
    2. **密集切镜**：将长句子拆分成多个更短的动作或视觉点，每个分镜只对应一小句口播内容。
    3. **完整覆盖**：确保整篇口播稿被完整拆分，不遗漏任何文字。
    4. **时间标注**：请在 time 字段准确标注预估的起止时间点，格式如 "00:00-00:04"。
    
    口播稿全文：${script}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                time: { type: Type.STRING, description: '预计起止时间，如 00:00-00:04' },
                narration: { type: Type.STRING, description: '该极短分镜对应的口播文字段落' },
              },
              required: ["id", "time", "narration"]
            }
          }
        },
        required: ["scenes"]
      }
    }
  });
  const data = JSON.parse(response.text);
  return data.scenes || [];
};

export const generateVisualAssets = async (scenes: any[]) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `你是一位视觉与创意总监。请为每个分镜设计匹配的视觉描述和背景音效建议。分镜列表：${JSON.stringify(scenes)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          visuals: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                visualKeywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: '3-5个英文视觉关键词' },
                imagePrompt: { type: Type.STRING, description: '详细的手绘插画风格绘图提示词 (英文)' },
                sfxPrompt: { type: Type.STRING, description: '背景音效描述 (英文)' },
              },
              required: ["id", "visualKeywords", "imagePrompt", "sfxPrompt"]
            }
          }
        },
        required: ["visuals"]
      }
    }
  });
  const data = JSON.parse(response.text);
  return data.visuals || [];
};

export const generatePackaging = async (script: string, platform: Platform) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `你是一位社交媒体运营专家。请为视频生成发布包装内容。口播稿：${script}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          videoTitle: { type: Type.STRING, description: '最终发布标题' },
          description: { type: Type.STRING, description: '视频简介与话题' },
          tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: '标签数组' },
          coverPrompt: { type: Type.STRING, description: '手绘风格封面图提示词 (英文)' },
        },
        required: ["videoTitle", "description", "tags", "coverPrompt"]
      }
    }
  });
  return JSON.parse(response.text);
};

export const generateImage = async (prompt: string) => {
  const styledPrompt = `Hand-drawn illustration style, artistic sketch, clean lines, professional digital art, ${prompt}`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: styledPrompt }] },
    config: {
      imageConfig: { aspectRatio: "16:9" }
    }
  });

  const candidates = response.candidates || [];
  if (candidates.length > 0) {
    const parts = candidates[0].content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  }
  return null;
};

export const generateSpeech = async (text: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `朗读这段文案：${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
      },
    });

    let base64Audio;
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        base64Audio = part.inlineData.data;
        break;
      }
    }

    if (!base64Audio) throw new Error("未生成语音数据");

    const pcmData = decodeBase64(base64Audio);
    const wavBlob = createWavBlob(pcmData, 24000);
    return await blobToDataURL(wavBlob);
  } catch (error: any) {
    console.error("Gemini TTS Error:", error);
    throw error;
  }
};

/**
 * Generate Sound Effects using ElevenLabs API
 */
export const generateSfx = async (prompt: string, customKey?: string) => {
  try {
    const elevenLabsKey = customKey?.trim() || (process.env as any).ELEVENLABS_API_KEY;
    
    if (!elevenLabsKey) {
      throw new Error("MissingElevenLabsKey");
    }

    // ElevenLabs Sound Effects works best with concise English prompts.
    // Ensure prompt is within reasonable length.
    const cleanPrompt = prompt.slice(0, 200);

    const response = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": elevenLabsKey,
      },
      body: JSON.stringify({
        text: cleanPrompt,
        duration_seconds: 5,
        prompt_influence: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetail = response.statusText;
      let errorCode = "";
      
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.detail?.status || errorJson.detail?.message || errorJson.detail || response.statusText;
        errorCode = errorJson.detail?.status || "";
      } catch (e) {}

      if (errorDetail === "missing_permissions" || errorCode === "missing_permissions") {
        throw new Error("ElevenLabsPermissionsError");
      }
      
      throw new Error(`ElevenLabs 接口错误: ${errorDetail}`);
    }

    const blob = await response.blob();
    return await blobToDataURL(blob);
  } catch (error: any) {
    if (error.message === "MissingElevenLabsKey" || error.message === "ElevenLabsPermissionsError") {
      throw error;
    }
    console.error("ElevenLabs SFX Generation Error:", error);
    throw error;
  }
};

function decodeBase64(base64: string): Int16Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

function createWavBlob(pcmData: Int16Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + pcmData.length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmData.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, pcmData.length * 2, true);
  let offset = 44;
  for (let i = 0; i < pcmData.length; i++, offset += 2) {
    view.setInt16(offset, pcmData[i], true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
