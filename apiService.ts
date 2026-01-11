
import { AppConfig, Platform } from "./types";

/**
 * Utility to extract JSON from a string, handling markdown code blocks if present.
 */
const extractJson = (text: string) => {
  try {
    // Attempt direct parse
    return JSON.parse(text);
  } catch (e) {
    // Try to find JSON block in markdown
    const jsonMatch = text.match(/```json\s?([\s\S]*?)\s?```/) || text.match(/{[\s\S]*}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } catch (innerE) {
        throw new Error("模型返回的 JSON 格式不正确，无法解析。");
      }
    }
    throw new Error("无法从回复中提取有效的 JSON 数据。");
  }
};

const callDeepSeek = async (config: AppConfig, systemPrompt: string, userPrompt: string, isJson: boolean = true) => {
  if (!config.deepseekKey) throw new Error("请先在设置中配置 DeepSeek API Key");
  
  const endpoint = config.deepseekEndpoint.endsWith('/') 
    ? config.deepseekEndpoint.slice(0, -1) 
    : config.deepseekEndpoint;

  const body = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.6,
    max_tokens: 4000,
    // DeepSeek JSON mode requires the word "json" in the prompt and MUST be an object.
    response_format: isJson ? { type: "json_object" } : undefined
  };

  try {
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.deepseekKey.trim()}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { error: { message: errorText } };
      }
      
      const msg = errorData.error?.message || errorData.message || response.statusText;
      throw new Error(`DeepSeek API 调用失败 (${response.status}): ${msg}`);
    }

    const data = await response.json();
    const resultText = data.choices[0].message.content;

    if (isJson) {
      return extractJson(resultText);
    }
    return resultText;
  } catch (err: any) {
    console.error("DeepSeek API Error:", err);
    if (err.name === 'TypeError') {
      throw new Error("网络请求失败，请检查 API 端点是否正确或是否存在跨域限制。");
    }
    throw err;
  }
};

export const analyzeContent = async (config: AppConfig, content: string, platform: Platform) => {
  const system = `你是一位专业的短视频内容战略专家。请分析用户提供的内容，并以 JSON 格式输出。
JSON 结构必须包含以下字段：
- "coreInfo": 核心信息的简明总结
- "audience": 目标受众画像分析
- "strategy": 针对 ${platform} 平台的具体创作建议`;
  
  const user = `内容原文：${content}\n发布平台：${platform}`;
  return callDeepSeek(config, system, user);
};

export const generateViralScript = async (config: AppConfig, analysis: any, platform: Platform) => {
  const system = `你是一位资深的爆款视频编剧。根据分析结果，创作一份具有高度吸引力的视频口播稿。
以 JSON 格式输出，包含以下字段：
- "title": 吸引人的视频标题
- "content": 完整的口播文案`;

  const user = `分析背景：${JSON.stringify(analysis)}\n发布平台：${platform}`;
  return callDeepSeek(config, system, user);
};

export const splitScenes = async (config: AppConfig, script: string) => {
  const system = `你是一位视频剪辑导演。请将口播稿拆分为多个视觉场景。
必须以 JSON 对象格式输出，其中包含一个名为 "scenes" 的数组。
每个场景对象包含：
- "id": 场景序号 (如 "1")
- "time": 预计时长 (如 "0-5s")
- "narration": 该场景对应的口播文字
例如：{"scenes": [{"id": "1", "time": "0-5s", "narration": "..."}]}`;

  const user = `口播稿：${script}`;
  const result = await callDeepSeek(config, system, user);
  return result.scenes || [];
};

export const generateVisualAssets = async (config: AppConfig, scenes: any[]) => {
  const system = `你是一位视觉艺术家。请为每个分镜设计匹配的视觉描述。
必须以 JSON 对象格式输出，其中包含一个名为 "visuals" 的数组。
每个对象包含：
- "id": 对应的分镜 ID
- "visualKeywords": 3-5个英文视觉关键词
- "imagePrompt": 详细的 AI 绘图提示词。必须要求“手绘风格”(Hand-drawn illustration style)。
例如：{"visuals": [{"id": "1", "visualKeywords": ["sketch", "art"], "imagePrompt": "hand-drawn style..."}]}`;

  const user = `分镜列表：${JSON.stringify(scenes)}`;
  const result = await callDeepSeek(config, system, user);
  return result.visuals || [];
};

export const generatePackaging = async (config: AppConfig, script: string, platform: Platform) => {
  const system = `你是一位社交媒体运营专家。请为视频生成发布包装。
以 JSON 格式输出：
- "videoTitle": 最终发布标题
- "description": 视频简介与话题
- "tags": 标签数组
- "coverPrompt": 详细的手绘风格封面图提示词`;

  const user = `口播稿内容：${script}`;
  return callDeepSeek(config, system, user);
};

export const generateImage = async (config: AppConfig, prompt: string) => {
  if (!config.arkKey) throw new Error("请先在设置中配置 火山引擎 (Ark) API Key");

  const styledPrompt = `手绘插画风格, 细腻的笔触, 艺术感, (hand-drawn illustration style, artistic sketch, textured paper): ${prompt}`;

  try {
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.arkKey.trim()}`
      },
      body: JSON.stringify({
        model: config.arkModel,
        prompt: styledPrompt,
        sequential_image_generation: "disabled",
        response_format: "url",
        size: "2K", 
        stream: false,
        watermark: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = response.statusText;
      try {
        const err = JSON.parse(errorText);
        errorMsg = err.message || err.error?.message || errorMsg;
      } catch(e) {}
      throw new Error(`豆包 API 错误: ${errorMsg}`);
    }

    const data = await response.json();
    if (data.data && data.data[0] && data.data[0].url) {
      return data.data[0].url;
    }
    throw new Error("豆包 API 未返回有效的图片链接。");
  } catch (err: any) {
    console.error("Doubao API Error:", err);
    throw err;
  }
};
