
export type Platform = 'YouTube' | 'TikTok' | 'Douyin' | 'Reels';

export interface AppConfig {
  deepseekKey: string;
  arkKey: string;
  arkModel: string;
  deepseekEndpoint: string;
}

export interface Scene {
  id: string;
  time: string;
  narration: string;
  visualKeywords: string[];
  imagePrompt: string;
  imageUrl?: string;
}

export interface HistoryItem<T> {
  id: string;
  timestamp: number;
  data: T;
  note: string;
}

export interface WorkflowState {
  step: number;
  config: AppConfig;
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
  history: {
    analysis: HistoryItem<WorkflowState['analysis']>[];
    script: HistoryItem<WorkflowState['script']>[];
    scenes: HistoryItem<WorkflowState['scenes']>[];
    metadata: HistoryItem<WorkflowState['metadata']>[];
  };
}

export const INITIAL_STATE: WorkflowState = {
  step: 1,
  config: {
    deepseekKey: '',
    arkKey: '',
    arkModel: 'doubao-seedream-4-5-251128',
    deepseekEndpoint: 'https://api.deepseek.com/v1'
  },
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
  history: {
    analysis: [],
    script: [],
    scenes: [],
    metadata: []
  }
};
