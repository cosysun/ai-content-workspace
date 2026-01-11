
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Platform, Scene, ModelSettings } from "./types";

// Gemini AI instance (can be initialized with different keys)
let geminiAI: GoogleGenAI | null = null;

const getGeminiAI = (apiKey?: string) => {
  const key = apiKey || process.env.API_KEY;
  if (!geminiAI || apiKey) {
    geminiAI = new GoogleGenAI({ apiKey: key });
  }
  return geminiAI;
};

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

// DeepSeek API 调用
const callDeepSeek = async (prompt: string, apiKey: string, systemPrompt?: string) => {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('DeepSeek API Error:', errorText);
    throw new Error(`DeepSeek API 错误: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  console.log('🔍 DeepSeek raw response:', content);

  try {
    return JSON.parse(content);
  } catch (parseError: any) {
    console.error('❌ JSON 解析失败:', parseError);
    console.error('原始内容:', content);

    // 尝试修复常见的 JSON 格式问题
    try {
      // 移除可能的 markdown 代码块标记
      let cleaned = content.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }

      // 尝试再次解析
      return JSON.parse(cleaned);
    } catch (retryError) {
      throw new Error(`DeepSeek 返回的 JSON 格式无效: ${parseError.message}`);
    }
  }
};

// 豆包 TTS API 调用
const callDoubaoTTS = async (text: string, apiKey: string, appId: string) => {
  // 豆包 TTS API 调用逻辑
  // 注意: 这里需要根据豆包实际的 API 文档进行调整
  const response = await fetch('https://openspeech.bytedance.com/api/v1/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      app_id: appId,
      text: text,
      voice_type: 'zh_female_qingxin',
      encoding: 'wav',
      speed_ratio: 1.0,
      volume_ratio: 1.0,
      pitch_ratio: 1.0
    })
  });

  if (!response.ok) {
    throw new Error(`豆包 TTS API 错误: ${response.statusText}`);
  }

  const blob = await response.blob();
  return await blobToDataURL(blob);
};

// 豆包生图 API 调用
const callDoubaoImage = async (prompt: string, apiKey: string, proxyUrl: string, aspectRatio: string) => {
  // 根据比例设置对应的尺寸
  // 16:9 使用 2560x1440, 9:16 使用 1440x2560
  const size = aspectRatio === '16:9' ? '2560x1440' : '1440x2560';
  
  const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'doubao-seedream-4-5-251128',
      prompt: prompt,
      sequential_image_generation: 'disabled',
      response_format: 'url',
      size: size, // 使用具体尺寸而不是 "2K"
      stream: false,
      watermark: true
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('豆包生图 API Error:', errorText);
    throw new Error(`豆包生图 API 错误: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('🎨 豆包生图响应:', data);

  // 豆包返回格式: { data: [{ url: "..." }] }
  if (data.data && data.data[0] && data.data[0].url) {
    const imageUrl = data.data[0].url;
    console.log('✅ 豆包图片 URL:', imageUrl);

    // 通过代理服务器下载图片并转为 base64
    try {
      const proxyEndpoint = `${proxyUrl}/proxy/image?url=${encodeURIComponent(imageUrl)}`;
      console.log('🔄 尝试通过代理下载:', proxyEndpoint);
      const proxyResponse = await fetch(proxyEndpoint);

      if (!proxyResponse.ok) {
        throw new Error(`代理服务器错误: ${proxyResponse.status}`);
      }

      const proxyData = await proxyResponse.json();
      console.log('📦 代理服务器响应:', proxyData);

      // 兼容两种格式：直接返回 或 包装在 result 字段中
      const result = proxyData.result || proxyData;

      if (result.success && result.dataUrl && result.dataUrl.length > 0) {
        console.log('✅ 通过代理成功下载图片');
        return result.dataUrl;
      } else {
        console.warn('⚠️ 代理返回的 dataUrl 为空或无效');
        throw new Error(`代理返回数据无效: dataUrl length = ${result.dataUrl?.length || 0}`);
      }
    } catch (proxyError: any) {
      console.warn('⚠️ 代理服务器不可用，直接返回 URL:', proxyError.message || proxyError);
      // 如果代理服务不可用，回退到直接返回 URL
      return imageUrl;
    }
  }

  throw new Error('豆包生图返回数据格式错误');
};

export const analyzeContent = async (content: string, platform: Platform, settings: ModelSettings) => {
  const provider = settings.contentModel.provider;
  const prompt = `你是一位专业的短视频内容战略专家。请仔细分析以下内容并为 ${platform} 平台制定详细的创作策略。

内容原文：
${content}

请提供以下三个方面的详细分析：

1. **核心信息 (coreInfo)**：提炼内容的核心要点和关键信息，100-200字
2. **目标受众 (audience)**：分析目标受众的年龄、兴趣、痛点和观看习惯，100-200字
3. **创作策略 (strategy)**：针对 ${platform} 平台特点，提供具体的创作建议、内容节奏和表现手法，150-300字

请确保每个字段都包含具体、详实的内容。`;

  if (provider === 'deepseek') {
    const apiKey = settings.contentModel.deepseekApiKey;
    if (!apiKey) throw new Error('请配置 DeepSeek API Key');

    return await callDeepSeek(
      prompt + '\n\n请严格以 JSON 格式返回，包含: coreInfo, audience, strategy 三个字段，每个字段必须是详细的字符串内容。',
      apiKey
    );
  } else {
    // Gemini
    const apiKey = settings.contentModel.geminiApiKey || process.env.API_KEY;
    const model = settings.contentModel.geminiModel || 'gemini-2.0-flash-exp';
    const ai = getGeminiAI(apiKey);
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            coreInfo: {
              type: Type.STRING,
              description: '核心信息的详细总结，必须包含100-200字的实质性内容',
              nullable: false
            },
            audience: {
              type: Type.STRING,
              description: '目标受众画像的详细分析，必须包含100-200字的实质性内容',
              nullable: false
            },
            strategy: {
              type: Type.STRING,
              description: '针对平台的具体创作建议，必须包含150-300字的实质性内容',
              nullable: false
            },
          },
          required: ["coreInfo", "audience", "strategy"]
        }
      }
    });

    const result = JSON.parse(response.text);
    console.log('✅ Gemini analyzeContent response:', result);

    // 验证返回数据的完整性
    if (!result.coreInfo || !result.audience || !result.strategy) {
      console.error('❌ 缺失字段:', {
        coreInfo: !!result.coreInfo,
        audience: !!result.audience,
        strategy: !!result.strategy
      });
      throw new Error('AI 返回的分析数据不完整，请重试');
    }

    return result;
  }
};

export const generateViralScript = async (analysis: any, platform: Platform, settings: ModelSettings) => {
  const provider = settings.contentModel.provider;
  const prompt = `你是一位资深的爆款视频编剧。根据以下分析结果，为 ${platform} 创作一份具有高度吸引力的视频口播稿。\n分析背景：${JSON.stringify(analysis)}`;

  if (provider === 'deepseek') {
    const apiKey = settings.contentModel.deepseekApiKey;
    if (!apiKey) throw new Error('请配置 DeepSeek API Key');

    return await callDeepSeek(
      prompt + '\n\n请以 JSON 格式返回，包含: title (吸引人的视频标题), content (完整的口播文案)',
      apiKey
    );
  } else {
    // Gemini
    const apiKey = settings.contentModel.geminiApiKey || process.env.API_KEY;
    const model = settings.contentModel.geminiModel || 'gemini-2.0-flash-exp';
    const ai = getGeminiAI(apiKey);
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
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
  }
};

export const splitScenes = async (script: string, settings: ModelSettings) => {
  const provider = settings.contentModel.provider;
  const prompt = `你是一位专业的视频剪辑导演。请将以下口播稿按照语义和视觉逻辑智能拆分为多个分镜场景。

【分镜原则】：
1. **语义完整性**：每个分镜应该是一个完整的语义单元（一个观点、一个动作、一个场景描述等）
2. **视觉连贯性**：相同主题或场景的内容归为一个分镜
3. **节奏把控**：
   - 重要观点：单独成镜，突出强调
   - 过渡性内容：可适当合并
   - 整体控制在 8-15 个分镜左右
4. **完整覆盖**：确保口播稿的每一句话都被分配到某个分镜中

【示例】：
口播稿："大家好，今天我要分享一个重要的发现。你知道吗？每天早起的人更容易成功。研究表明，早起者的效率比晚睡者高30%。"

分镜拆分：
- 分镜1: "大家好，今天我要分享一个重要的发现。" （开场问候）
- 分镜2: "你知道吗？每天早起的人更容易成功。" （核心观点）
- 分镜3: "研究表明，早起者的效率比晚睡者高30%。" （数据支撑）

口播稿全文：
${script}

请根据上述原则进行智能分镜。`;

  if (provider === 'deepseek') {
    const apiKey = settings.contentModel.deepseekApiKey;
    if (!apiKey) throw new Error('请配置 DeepSeek API Key');

    const result = await callDeepSeek(
      prompt + '\n\n请以 JSON 格式返回，包含 scenes 数组，每个场景包含: id (字符串，如 "scene_1"), narration (该分镜对应的完整口播文字)',
      apiKey,
      'You are a professional video director. Split the script into semantic scenes. Return valid JSON only.'
    );
    return result.scenes || [];
  } else {
    // Gemini
    const apiKey = settings.contentModel.geminiApiKey || process.env.API_KEY;
    const model = settings.contentModel.geminiModel || 'gemini-2.0-flash-exp';
    const ai = getGeminiAI(apiKey);
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
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
                  id: { type: Type.STRING, description: '场景唯一标识，如 scene_1' },
                  narration: { type: Type.STRING, description: '该分镜对应的完整口播文字段落' },
                },
                required: ["id", "narration"]
              }
            }
          },
          required: ["scenes"]
        }
      }
    });
    const data = JSON.parse(response.text);
    return data.scenes || [];
  }
};

export const generateVisualAssets = async (scenes: any[], settings: ModelSettings) => {
  const provider = settings.contentModel.provider;
  const imageProvider = settings.imageModel.provider;
  
  // 根据生图模型决定 prompt 语言
  const promptLanguage = imageProvider === 'doubao' ? '中文' : '英文';
  const keywordsLanguage = imageProvider === 'doubao' ? '中文' : '英文';
  
  const prompt = `你是一位视觉与创意总监。请为每个分镜设计匹配的视觉描述和背景音效建议。

分镜列表：
${JSON.stringify(scenes, null, 2)}

【要求】：
1. 为每个场景生成对应的视觉资源
2. visualKeywords: 3-5个${keywordsLanguage}关键词，简洁明了
3. imagePrompt: 详细的${promptLanguage}绘图提示词，描述画面的风格、构图、色彩等，适合手绘插画风格
4. sfxPrompt: 简短的英文音效描述（5-10个词以内），如 "gentle wind blowing" 或 "soft piano music"

【重要】：
- imagePrompt 必须使用${promptLanguage}
- visualKeywords 必须使用${keywordsLanguage}
- sfxPrompt 统一使用英文（因为音效模型是 ElevenLabs）
- 避免使用换行符、引号等特殊字符
- 保持描述简洁专业`;

  if (provider === 'deepseek') {
    const apiKey = settings.contentModel.deepseekApiKey;
    if (!apiKey) throw new Error('请配置 DeepSeek API Key');

    const result = await callDeepSeek(
      prompt + `\n\n请严格以 JSON 格式返回，包含 visuals 数组。每个元素包含: id (字符串), visualKeywords (字符串数组，${keywordsLanguage}), imagePrompt (字符串，${promptLanguage}), sfxPrompt (字符串，英文)。确保所有字符串字段中的特殊字符都被正确转义。`,
      apiKey,
      'You are a creative director. Return valid JSON only, with all special characters properly escaped in string fields.'
    );
    return result.visuals || [];
  } else {
    // Gemini
    const apiKey = settings.contentModel.geminiApiKey || process.env.API_KEY;
    const model = settings.contentModel.geminiModel || 'gemini-2.0-flash-exp';
    const ai = getGeminiAI(apiKey);
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
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
                  visualKeywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: `3-5个${keywordsLanguage}视觉关键词` },
                  imagePrompt: { type: Type.STRING, description: `详细的手绘插画风格绘图提示词 (${promptLanguage})` },
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
  }
};

export const generatePackaging = async (script: string, platform: Platform, settings: ModelSettings) => {
  const provider = settings.contentModel.provider;
  const imageProvider = settings.imageModel.provider;
  
  // 根据生图模型决定封面图 prompt 语言
  const coverPromptLanguage = imageProvider === 'doubao' ? '中文' : '英文';
  
  const prompt = `你是一位社交媒体运营专家。请为视频生成发布包装内容。口播稿：${script}`;

  if (provider === 'deepseek') {
    const apiKey = settings.contentModel.deepseekApiKey;
    if (!apiKey) throw new Error('请配置 DeepSeek API Key');
    
    return await callDeepSeek(
      prompt + `\n\n请以 JSON 格式返回，包含: videoTitle (最终发布标题), description (视频简介与话题), tags (标签数组), coverPrompt (手绘风格封面图提示词-${coverPromptLanguage})`,
      apiKey
    );
  } else {
    // Gemini
    const apiKey = settings.contentModel.geminiApiKey || process.env.API_KEY;
    const model = settings.contentModel.geminiModel || 'gemini-2.0-flash-exp';
    const ai = getGeminiAI(apiKey);
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            videoTitle: { type: Type.STRING, description: '最终发布标题' },
            description: { type: Type.STRING, description: '视频简介与话题' },
            tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: '标签数组' },
            coverPrompt: { type: Type.STRING, description: `手绘风格封面图提示词 (${coverPromptLanguage})` },
          },
          required: ["videoTitle", "description", "tags", "coverPrompt"]
        }
      }
    });
    return JSON.parse(response.text);
  }
};

export const generateImage = async (prompt: string, settings: ModelSettings, platform: Platform) => {
  const provider = settings.imageModel.provider;
  // 根据平台决定画面比例：YouTube 16:9, 抖音 9:16
  const aspectRatio = platform === 'YouTube' ? '16:9' : '9:16';

  if (provider === 'doubao') {
    const apiKey = settings.imageModel.doubaoApiKey;
    if (!apiKey) throw new Error('请配置豆包 API Key');

    const proxyUrl = settings.proxyUrl || 'http://localhost:5000';
    // 豆包使用中文 prompt（已经是中文，直接传递）
    return await callDoubaoImage(prompt, apiKey, proxyUrl, aspectRatio);
  } else {
    // Gemini 使用英文 prompt
    const apiKey = settings.imageModel.geminiApiKey || process.env.API_KEY;
    const model = settings.imageModel.geminiModel || 'gemini-2.0-flash-exp';
    const ai = getGeminiAI(apiKey);
    // 为 Gemini 添加英文风格描述（prompt 本身已经是英文）
    const styledPrompt = `Hand-drawn illustration style, artistic sketch, clean lines, professional digital art, ${prompt}`;
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [{ text: styledPrompt }] },
      config: {
        imageConfig: { aspectRatio: aspectRatio }
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
  }
};

export const generateSpeech = async (text: string, settings: ModelSettings) => {
  const provider = settings.ttsModel.provider;

  if (provider === 'doubao') {
    const apiKey = settings.ttsModel.doubaoApiKey;
    const appId = settings.ttsModel.doubaoAppId;
    if (!apiKey || !appId) throw new Error('请配置豆包 TTS API Key 和 App ID');
    
    return await callDoubaoTTS(text, apiKey, appId);
  } else {
    // Gemini
    const apiKey = settings.ttsModel.geminiApiKey || process.env.API_KEY;
    const model = settings.ttsModel.geminiModel || 'gemini-2.0-flash-exp';
    const ai = getGeminiAI(apiKey);
    try {
      const response = await ai.models.generateContent({
        model: model,
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
  }
};

/**
 * Generate Sound Effects using ElevenLabs API
 */
export const generateSfx = async (prompt: string, settings: ModelSettings) => {
  try {
    const elevenLabsKey = settings.sfxModel.elevenLabsApiKey?.trim();
    
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
