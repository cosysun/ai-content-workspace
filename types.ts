
export type Platform = 'YouTube' | 'Douyin';

export type ContentModelProvider = 'gemini' | 'deepseek';
export type TTSProvider = 'gemini' | 'doubao';
export type ImageModelProvider = 'gemini' | 'doubao';
export type SfxProvider = 'elevenlabs';

export interface Scene {
  id: string;
  narration: string;
  visualKeywords: string[];
  imagePrompt: string;
  imageUrl?: string;
  audioUrl?: string;
  sfxPrompt?: string;
  sfxUrl?: string;
}

export interface HistoryItem<T> {
  id: string;
  timestamp: number;
  data: T;
  note: string;
}

export interface ModelSettings {
  // 内容模型配置
  contentModel: {
    provider: ContentModelProvider;
    geminiApiKey: string;
    geminiModel: string; // Gemini 模型名称
    deepseekApiKey: string;
  };
  // 语音模型配置
  ttsModel: {
    provider: TTSProvider;
    geminiApiKey: string;
    geminiModel: string; // Gemini TTS 模型名称
    doubaoApiKey: string;
    doubaoAppId: string;
  };
  // 生图模型配置
  imageModel: {
    provider: ImageModelProvider;
    geminiApiKey: string;
    geminiModel: string; // Gemini 图像模型名称
    doubaoApiKey: string;
  };
  // 音效模型配置
  sfxModel: {
    provider: SfxProvider;
    elevenLabsApiKey: string;
  };
  // CORS 代理配置
  proxyUrl: string;
}

export interface WorkflowState {
  step: number;
  input: {
    content: string;
    platform: Platform;
  };
  analysis: {
    coreInfo: string;
    audience: string;
    strategy: string;
  };
  script: {
    title: string;
    content: string;
  };
  scenes: Scene[];
  metadata: {
    videoTitle: string;
    description: string;
    tags: string[];
    coverPrompt: string;
    coverUrl?: string;
  };
  settings: ModelSettings;
  history: {
    analysis: HistoryItem<WorkflowState['analysis']>[];
    script: HistoryItem<WorkflowState['script']>[];
    scenes: HistoryItem<WorkflowState['scenes']>[];
    metadata: HistoryItem<WorkflowState['metadata']>[];
  };
}

export const INITIAL_STATE: WorkflowState = {
  step: 1,
  input: {
    content: '',
    platform: 'YouTube'
  },
  analysis: {
    coreInfo: '',
    audience: '',
    strategy: ''
  },
  script: {
    title: '',
    content: ''
  },
  scenes: [],
  metadata: {
    videoTitle: '',
    description: '',
    tags: [],
    coverPrompt: ''
  },
  settings: {
    contentModel: {
      provider: 'gemini',
      geminiApiKey: '',
      geminiModel: 'gemini-2.0-flash-exp',
      deepseekApiKey: ''
    },
    ttsModel: {
      provider: 'gemini',
      geminiApiKey: '',
      geminiModel: 'gemini-2.0-flash-exp',
      doubaoApiKey: '',
      doubaoAppId: ''
    },
    imageModel: {
      provider: 'gemini',
      geminiApiKey: '',
      geminiModel: 'gemini-2.0-flash-exp',
      doubaoApiKey: ''
    },
    sfxModel: {
      provider: 'elevenlabs',
      elevenLabsApiKey: ''
    },
    proxyUrl: 'http://localhost:5000'
  },
  history: {
    analysis: [],
    script: [],
    scenes: [],
    metadata: []
  }
};
