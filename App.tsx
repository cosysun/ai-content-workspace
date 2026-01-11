
import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_STATE, WorkflowState, Platform, Scene, HistoryItem } from './types';
import * as api from './apiService';
import * as db from './dbService';
import JSZip from 'jszip';
import { 
  CheckCircle2, 
  ChevronRight, 
  Loader2, 
  Video, 
  MessageSquare, 
  Image as ImageIcon, 
  AlertCircle,
  FileText,
  Save,
  Wand2,
  History,
  X,
  ShieldCheck,
  Zap,
  Brush,
  RefreshCw,
  Hash,
  Volume2,
  Mic,
  Music,
  Play,
  StopCircle,
  Upload,
  Square,
  Trash2,
  Download,
  Settings as SettingsIcon,
  ExternalLink,
  Key,
  ShieldAlert
} from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<WorkflowState>(INITIAL_STATE);
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Load state from IndexedDB on mount
  useEffect(() => {
    const init = async () => {
      const saved = await db.loadState();
      if (saved) {
        console.log('🔍 加载的旧数据:', saved);
        
        // 兼容旧版本的 settings 结构
        let migratedSettings = INITIAL_STATE.settings;
        if (saved.settings) {
          // 如果是旧版本 (只有 elevenLabsApiKey)
          if (typeof saved.settings === 'object' && 'elevenLabsApiKey' in saved.settings && !('contentModel' in saved.settings)) {
            migratedSettings = {
              ...INITIAL_STATE.settings,
              sfxModel: {
                ...INITIAL_STATE.settings.sfxModel,
                elevenLabsApiKey: saved.settings.elevenLabsApiKey || ''
              }
            };
          } else {
            // 新版本，深度合并
            migratedSettings = {
              contentModel: { ...INITIAL_STATE.settings.contentModel, ...saved.settings.contentModel },
              ttsModel: { ...INITIAL_STATE.settings.ttsModel, ...saved.settings.ttsModel },
              imageModel: { ...INITIAL_STATE.settings.imageModel, ...saved.settings.imageModel },
              sfxModel: { ...INITIAL_STATE.settings.sfxModel, ...saved.settings.sfxModel },
              proxyUrl: saved.settings.proxyUrl || INITIAL_STATE.settings.proxyUrl
            };
          }
        }

        // 修复 analysis 对象中可能存在的嵌套对象问题
        let migratedAnalysis = saved.analysis || INITIAL_STATE.analysis;
        if (migratedAnalysis) {
          // 如果字段是对象而不是字符串，尝试提取实际内容
          if (typeof migratedAnalysis.coreInfo === 'object' && migratedAnalysis.coreInfo !== null) {
            console.warn('⚠️ 检测到 coreInfo 为对象，尝试修复...');
            // 尝试提取对象中的文本内容
            migratedAnalysis.coreInfo = migratedAnalysis.coreInfo.text || 
                                        migratedAnalysis.coreInfo.content || 
                                        migratedAnalysis.coreInfo.value ||
                                        (typeof migratedAnalysis.coreInfo === 'string' ? migratedAnalysis.coreInfo : '');
          }
          if (typeof migratedAnalysis.audience === 'object' && migratedAnalysis.audience !== null) {
            console.warn('⚠️ 检测到 audience 为对象，尝试修复...');
            migratedAnalysis.audience = migratedAnalysis.audience.text || 
                                       migratedAnalysis.audience.content || 
                                       migratedAnalysis.audience.value ||
                                       (typeof migratedAnalysis.audience === 'string' ? migratedAnalysis.audience : '');
          }
          if (typeof migratedAnalysis.strategy === 'object' && migratedAnalysis.strategy !== null) {
            console.warn('⚠️ 检测到 strategy 为对象，尝试修复...');
            migratedAnalysis.strategy = migratedAnalysis.strategy.text || 
                                       migratedAnalysis.strategy.content || 
                                       migratedAnalysis.strategy.value ||
                                       (typeof migratedAnalysis.strategy === 'string' ? migratedAnalysis.strategy : '');
          }
        }

        const newState = {
          ...INITIAL_STATE,
          ...saved,
          analysis: migratedAnalysis,
          scenes: Array.isArray(saved.scenes) ? saved.scenes : [],
          settings: migratedSettings
        };
        
        console.log('✅ 迁移后的新数据:', newState);
        setState(newState);
      }
      setIsReady(true);
    };
    init();
  }, []);

  // Save state to IndexedDB whenever it changes
  useEffect(() => {
    if (isReady) {
      db.saveState(state);
    }
  }, [state, isReady]);

  const handleClearData = async () => {
    if (confirm('确定要清除所有进度并重置吗？此操作无法撤销。')) {
      await db.clearState();
      // 强制清除 IndexedDB
      try {
        const dbs = await indexedDB.databases();
        for (const db of dbs) {
          if (db.name === 'AIVideoWorkflowDB') {
            indexedDB.deleteDatabase('AIVideoWorkflowDB');
          }
        }
      } catch (e) {
        console.warn('清除数据库失败:', e);
      }
      // 延迟重载，确保数据库完全清除
      setTimeout(() => {
        window.location.reload();
      }, 100);
    }
  };

  const steps = [
    { id: 1, name: '输入素材', icon: FileText },
    { id: 2, name: '内容分析', icon: Zap },
    { id: 3, name: '口播文稿', icon: MessageSquare },
    { id: 4, name: '分镜规划', icon: Brush },
    { id: 5, name: '生成素材', icon: ImageIcon },
    { id: 6, name: '发布包装', icon: Hash },
  ];

  const saveToHistory = (stepId: number, data: any, note: string) => {
    const key = getHistoryKey(stepId);
    if (!key) return;
    const newItem: HistoryItem<any> = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      data: JSON.parse(JSON.stringify(data)),
      note
    };
    setState(prev => ({
      ...prev,
      history: { ...prev.history, [key]: [newItem, ...prev.history[key as keyof typeof prev.history]].slice(0, 5) }
    }));
  };

  const getHistoryKey = (stepId: number) => {
    if (stepId === 2) return 'analysis';
    if (stepId === 3) return 'script';
    if (stepId === 4 || stepId === 5) return 'scenes';
    if (stepId === 6) return 'metadata';
    return null;
  };

  const downloadProjectZip = async () => {
    const zip = new JSZip();

    // 1. Create Editing Instructions (剪辑说明.MD)
    let editMd = `# 视频剪辑说明: ${state.metadata.videoTitle || '未命名项目'}\n\n`;
    editMd += `## 项目信息\n`;
    editMd += `- **目标平台**: ${state.input.platform}\n`;
    editMd += `- **核心描述**: ${state.metadata.description}\n`;
    editMd += `- **标签话题**: ${state.metadata.tags.join(', ')}\n\n`;
    editMd += `## 分镜脚本与素材索引\n\n`;

    // 2. Create Publishing Instructions (发布说明.MD)
    let publishMd = `# 视频发布说明: ${state.metadata.videoTitle || state.script.title || '未命名项目'}\n\n`;
    publishMd += `## 基础要素\n`;
    publishMd += `- **视频标题**: ${state.metadata.videoTitle || state.script.title}\n`;
    publishMd += `- **发布平台**: ${state.input.platform}\n`;
    publishMd += `- **建议标签**: ${state.metadata.tags.map(t => '#' + t).join(' ')}\n\n`;
    publishMd += `## 视频简介 (Description)\n`;
    publishMd += `\`\`\`text\n${state.metadata.description}\n\`\`\`\n\n`;
    publishMd += `## 完整口播稿 (Transcript)\n`;
    publishMd += `\`\`\`text\n${state.script.content}\n\`\`\`\n\n`;
    publishMd += `## 封面图提示词 (Cover AI Prompt)\n`;
    publishMd += `> ${state.metadata.coverPrompt}\n`;

    const imagesFolder = zip.folder("images");
    const audioFolder = zip.folder("audio");

    // Helper functions
    const getBase64 = (dataUrl: string) => dataUrl.split(',')[1];
    const isDataUrl = (url: string) => url.startsWith('data:');

    for (let i = 0; i < state.scenes.length; i++) {
      const scene = state.scenes[i];
      const sceneIdx = i + 1;

      editMd += `### 场景 ${sceneIdx}\n`;
      editMd += `> **口播文稿**: ${scene.narration}\n\n`;
      editMd += `- **画面构思**: ${scene.imagePrompt}\n`;
      editMd += `- **预期音效**: ${scene.sfxPrompt || '无'}\n`;
      editMd += `- **视觉文件**: \`images/scene_${sceneIdx}.png\`\n`;
      if (scene.audioUrl) editMd += `- **口播音频**: \`audio/narration_${sceneIdx}.wav\`\n`;
      if (scene.sfxUrl) editMd += `- **音效文件**: \`audio/sfx_${sceneIdx}.wav\`\n`;
      editMd += `\n---\n\n`;

      if (scene.imageUrl) {
        if (isDataUrl(scene.imageUrl)) {
          // Base64 数据 URL
          imagesFolder?.file(`scene_${sceneIdx}.png`, getBase64(scene.imageUrl), { base64: true });
        } else {
          // 外部 URL（如豆包图片），添加说明到 MD 文件
          editMd += `\n> ⚠️ 图片为外部 URL，请手动下载：\n> ${scene.imageUrl}\n\n`;
        }
      }
      if (scene.audioUrl) {
        if (isDataUrl(scene.audioUrl)) {
          audioFolder?.file(`narration_${sceneIdx}.wav`, getBase64(scene.audioUrl), { base64: true });
        }
      }
      if (scene.sfxUrl) {
        if (isDataUrl(scene.sfxUrl)) {
          audioFolder?.file(`sfx_${sceneIdx}.wav`, getBase64(scene.sfxUrl), { base64: true });
        }
      }
    }

    if (state.metadata.coverUrl) {
      if (isDataUrl(state.metadata.coverUrl)) {
        zip.file("cover_image.png", state.metadata.coverUrl.split(',')[1], { base64: true });
        editMd += `### 封面文件\n- \`cover_image.png\`\n- **封面提示词**: ${state.metadata.coverPrompt}\n`;
      } else {
        editMd += `### 封面文件\n- **封面提示词**: ${state.metadata.coverPrompt}\n- **封面 URL**: ${state.metadata.coverUrl}\n`;
      }
    }

    zip.file("剪辑说明.MD", editMd);
    zip.file("发布说明.MD", publishMd);

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${state.metadata.videoTitle || 'AI_Video_Project'}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNext = async () => {
    setLoading(true);
    setError(null);
    try {
      if (state.step === 1) {
        if (!state.input.content) throw new Error("请输入创作内容");
        const analysis = await api.analyzeContent(state.input.content, state.input.platform, state.settings);
        setState(prev => ({ ...prev, step: 2, analysis }));
        saveToHistory(2, analysis, "内容初始分析");
      } else if (state.step === 2) {
        saveToHistory(2, state.analysis, "分析确认");
        const script = await api.generateViralScript(state.analysis, state.input.platform, state.settings);
        setState(prev => ({ ...prev, step: 3, script }));
        saveToHistory(3, script, "文稿生成");
      } else if (state.step === 3) {
        saveToHistory(3, state.script, "文稿确认");
        const scenes = await api.splitScenes(state.script.content, state.settings);
        if (!Array.isArray(scenes)) throw new Error("分镜数据格式错误");
        setState(prev => ({ ...prev, step: 4, scenes }));
        saveToHistory(4, scenes, "分镜切分");
      } else if (state.step === 4) {
        saveToHistory(4, state.scenes, "分镜审核");
        const visuals = await api.generateVisualAssets(state.scenes, state.settings);
        const updatedScenes = state.scenes.map(scene => {
          const match = visuals.find((v: any) => v.id === scene.id);
          return match ? { ...scene, ...match } : scene;
        });
        setState(prev => ({ ...prev, step: 5, scenes: updatedScenes }));
        saveToHistory(5, updatedScenes, "视觉与音效建议生成");
      } else if (state.step === 5) {
        saveToHistory(5, state.scenes, "素材确认");
        const packaging = await api.generatePackaging(state.script.content, state.input.platform, state.settings);
        setState(prev => ({ ...prev, step: 6, metadata: packaging }));
        saveToHistory(6, packaging, "发布方案生成");
      } else if (state.step === 6) {
        setLoading(true);
        await downloadProjectZip();
        setExportSuccess(true);
        setTimeout(() => setExportSuccess(false), 3000);
      }
    } catch (err: any) {
      console.error("Workflow Error:", err);
      setError(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const revertTo = (key: string, data: any) => {
    setState(prev => {
      const updated = { ...prev, [key]: JSON.parse(JSON.stringify(data)) };
      if (key === 'scenes' && !Array.isArray(updated.scenes)) {
        updated.scenes = [];
      }
      return updated;
    });
    setShowHistory(false);
  };

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-sm font-bold text-slate-400">正在恢复工作进度...</p>
        </div>
      </div>
    );
  }

  const currentHistoryKey = getHistoryKey(state.step);
  const currentHistory = currentHistoryKey ? state.history[currentHistoryKey as keyof typeof state.history] : [];

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 p-2 rounded-xl">
            <Video className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">AI 创作工作流</h1>
            <p className="text-[10px] text-slate-400 font-medium">全方位 AI 素材引擎 • 人工审核驱动</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {currentHistoryKey && (
            <button onClick={() => setShowHistory(true)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-all border border-transparent hover:border-slate-200">
              <History className="w-4 h-4" />
              版本 ({currentHistory.length})
            </button>
          )}
          <div className="h-6 w-px bg-slate-200" />
          <button onClick={() => setShowSettings(true)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="应用设置">
            <SettingsIcon className="w-4 h-4" />
          </button>
          <button onClick={handleClearData} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="重置项目">
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">STEP {state.step}</span>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <nav className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col gap-1 shrink-0">
          {steps.map((step) => {
            const Icon = step.icon;
            const isActive = state.step === step.id;
            const isCompleted = state.step > step.id;
            return (
              <div key={step.id} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${isActive ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100' : 'text-slate-400'}`}>
                <div className={`shrink-0 ${isActive ? 'text-indigo-600' : isCompleted ? 'text-emerald-500' : 'text-slate-300'}`}>
                  {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <span className="text-sm font-bold">{step.name}</span>
              </div>
            );
          })}
        </nav>

        <div className="flex-1 overflow-y-auto p-8 bg-[#fcfdfe]">
          <div className="max-w-4xl mx-auto pb-24 relative">
            {exportSuccess && (
              <div className="fixed bottom-24 right-8 z-50 bg-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom duration-300">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-bold">项目已成功导出 ZIP！</span>
              </div>
            )}

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-6 rounded-[2rem] flex flex-col gap-4 animate-in fade-in zoom-in duration-300">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 shrink-0" />
                  <h4 className="font-bold">生成过程中遇到问题</h4>
                </div>
                <p className="text-sm font-medium opacity-80 leading-relaxed">{error}</p>
                <button onClick={() => { setError(null); handleNext(); }} className="w-fit flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-xl text-xs font-bold transition-all">
                  <RefreshCw className="w-3 h-3" /> 立即重试
                </button>
              </div>
            )}

            {state.step === 1 && <InputStep state={state} setState={setState} />}
            {state.step === 2 && <AnalysisStep state={state} setState={setState} />}
            {state.step === 3 && <ScriptStep state={state} setState={setState} />}
            {state.step === 4 && <SceneStep state={state} setState={setState} />}
            {state.step === 5 && <VisualAssetStep state={state} setState={setState} onOpenSettings={() => setShowSettings(true)} />}
            {state.step === 6 && <PackagingStep state={state} setState={setState} />}

            <div className="mt-12 flex items-center justify-between border-t border-slate-100 pt-8">
              <button
                onClick={() => setState(prev => ({ ...prev, step: Math.max(1, prev.step - 1) }))}
                disabled={state.step === 1 || loading}
                className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 disabled:opacity-30"
              >
                上一步
              </button>
              <button
                onClick={handleNext}
                disabled={loading || (state.step === 1 && !state.input.content)}
                className={`flex items-center gap-2 px-10 py-3 rounded-2xl shadow-xl transition-all font-bold disabled:opacity-50 ${state.step === 6 ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-900 hover:bg-black text-white'}`}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : state.step === 6 ? <Download className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                {state.step === 6 ? '打包导出 ZIP' : '确认内容并下一步'}
                {state.step < 6 && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {showHistory && (
          <HistoryDrawer history={currentHistory} onRevert={(data) => revertTo(currentHistoryKey!, data)} onClose={() => setShowHistory(false)} />
        )}

        {showSettings && (
          <SettingsModal 
            settings={state.settings} 
            onSave={(newSettings) => setState(prev => ({ ...prev, settings: newSettings }))} 
            onClose={() => setShowSettings(false)} 
          />
        )}
      </main>
    </div>
  );
};

const SettingsModal = ({ settings, onSave, onClose }: any) => {
  const [tempSettings, setTempSettings] = useState(settings);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
        <div className="p-8 space-y-8">
          <div className="flex items-center justify-between sticky top-0 bg-white pb-4 border-b border-slate-100">
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-indigo-600" />
              模型配置
            </h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
          </div>
          
          {/* 内容模型配置 */}
          <div className="space-y-4 p-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100">
            <h4 className="text-sm font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              内容模型配置
            </h4>
            <div className="space-y-3">
              <div className="flex gap-2">
                <button 
                  onClick={() => setTempSettings((p: any) => ({ ...p, contentModel: { ...p.contentModel, provider: 'gemini' } }))}
                  className={`flex-1 px-4 py-2 rounded-xl text-xs font-bold transition-all ${tempSettings.contentModel.provider === 'gemini' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200'}`}>
                  Gemini
                </button>
                <button 
                  onClick={() => setTempSettings((p: any) => ({ ...p, contentModel: { ...p.contentModel, provider: 'deepseek' } }))}
                  className={`flex-1 px-4 py-2 rounded-xl text-xs font-bold transition-all ${tempSettings.contentModel.provider === 'deepseek' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200'}`}>
                  DeepSeek
                </button>
              </div>
              
              {tempSettings.contentModel.provider === 'gemini' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600">Gemini 模型</label>
                    <select
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={tempSettings.contentModel.geminiModel}
                      onChange={(e) => setTempSettings((p: any) => ({ ...p, contentModel: { ...p.contentModel, geminiModel: e.target.value } }))}>
                      <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (实验版)</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600">Gemini API Key</label>
                    <input
                      type="password"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="输入 Gemini API Key..."
                      value={tempSettings.contentModel.geminiApiKey}
                      onChange={(e) => setTempSettings((p: any) => ({ ...p, contentModel: { ...p.contentModel, geminiApiKey: e.target.value } }))}
                    />
                  </div>
                </div>
              )}
              
              {tempSettings.contentModel.provider === 'deepseek' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 flex items-center justify-between">
                    DeepSeek API Key
                    <a href="https://platform.deepseek.com/api_keys" target="_blank" className="text-indigo-600 hover:underline text-[10px]">获取密钥 <ExternalLink className="w-3 h-3 inline" /></a>
                  </label>
                  <input 
                    type="password"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="输入 DeepSeek API Key..."
                    value={tempSettings.contentModel.deepseekApiKey}
                    onChange={(e) => setTempSettings((p: any) => ({ ...p, contentModel: { ...p.contentModel, deepseekApiKey: e.target.value } }))}
                  />
                </div>
              )}
            </div>
          </div>

          {/* 语音模型配置 */}
          <div className="space-y-4 p-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100">
            <h4 className="text-sm font-black text-emerald-900 uppercase tracking-widest flex items-center gap-2">
              <Mic className="w-4 h-4" />
              语音模型配置
            </h4>
            <div className="space-y-3">
              <div className="flex gap-2">
                <button 
                  onClick={() => setTempSettings((p: any) => ({ ...p, ttsModel: { ...p.ttsModel, provider: 'gemini' } }))}
                  className={`flex-1 px-4 py-2 rounded-xl text-xs font-bold transition-all ${tempSettings.ttsModel.provider === 'gemini' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200'}`}>
                  Gemini TTS
                </button>
                <button 
                  onClick={() => setTempSettings((p: any) => ({ ...p, ttsModel: { ...p.ttsModel, provider: 'doubao' } }))}
                  className={`flex-1 px-4 py-2 rounded-xl text-xs font-bold transition-all ${tempSettings.ttsModel.provider === 'doubao' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200'}`}>
                  豆包 TTS
                </button>
              </div>
              
              {tempSettings.ttsModel.provider === 'gemini' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600">Gemini 语音模型</label>
                    <select
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={tempSettings.ttsModel.geminiModel}
                      onChange={(e) => setTempSettings((p: any) => ({ ...p, ttsModel: { ...p.ttsModel, geminiModel: e.target.value } }))}>
                      <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (实验版)</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600">Gemini API Key</label>
                    <input
                      type="password"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="输入 Gemini API Key..."
                      value={tempSettings.ttsModel.geminiApiKey}
                      onChange={(e) => setTempSettings((p: any) => ({ ...p, ttsModel: { ...p.ttsModel, geminiApiKey: e.target.value } }))}
                    />
                  </div>
                </div>
              )}
              
              {tempSettings.ttsModel.provider === 'doubao' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 flex items-center justify-between">
                      豆包 API Key
                      <a href="https://console.volcengine.com/ark" target="_blank" className="text-emerald-600 hover:underline text-[10px]">获取密钥 <ExternalLink className="w-3 h-3 inline" /></a>
                    </label>
                    <input 
                      type="password"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="输入豆包 API Key..."
                      value={tempSettings.ttsModel.doubaoApiKey}
                      onChange={(e) => setTempSettings((p: any) => ({ ...p, ttsModel: { ...p.ttsModel, doubaoApiKey: e.target.value } }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600">豆包 App ID</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="输入豆包 App ID..."
                      value={tempSettings.ttsModel.doubaoAppId}
                      onChange={(e) => setTempSettings((p: any) => ({ ...p, ttsModel: { ...p.ttsModel, doubaoAppId: e.target.value } }))}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 生图模型配置 */}
          <div className="space-y-4 p-6 bg-gradient-to-br from-violet-50 to-fuchsia-50 rounded-2xl border border-violet-100">
            <h4 className="text-sm font-black text-violet-900 uppercase tracking-widest flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              生图模型配置
            </h4>
            <div className="space-y-3">
              <div className="flex gap-2">
                <button 
                  onClick={() => setTempSettings((p: any) => ({ ...p, imageModel: { ...p.imageModel, provider: 'gemini' } }))}
                  className={`flex-1 px-4 py-2 rounded-xl text-xs font-bold transition-all ${tempSettings.imageModel.provider === 'gemini' ? 'bg-violet-600 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200'}`}>
                  Gemini Image
                </button>
                <button 
                  onClick={() => setTempSettings((p: any) => ({ ...p, imageModel: { ...p.imageModel, provider: 'doubao' } }))}
                  className={`flex-1 px-4 py-2 rounded-xl text-xs font-bold transition-all ${tempSettings.imageModel.provider === 'doubao' ? 'bg-violet-600 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200'}`}>
                  豆包生图
                </button>
              </div>
              
              {tempSettings.imageModel.provider === 'gemini' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600">Gemini 图像模型</label>
                    <select
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500 outline-none"
                      value={tempSettings.imageModel.geminiModel}
                      onChange={(e) => setTempSettings((p: any) => ({ ...p, imageModel: { ...p.imageModel, geminiModel: e.target.value } }))}>
                      <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (实验版)</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600">Gemini API Key</label>
                    <input
                      type="password"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500 outline-none"
                      placeholder="输入 Gemini API Key..."
                      value={tempSettings.imageModel.geminiApiKey}
                      onChange={(e) => setTempSettings((p: any) => ({ ...p, imageModel: { ...p.imageModel, geminiApiKey: e.target.value } }))}
                    />
                  </div>
                </div>
              )}
              
              {tempSettings.imageModel.provider === 'doubao' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 flex items-center justify-between">
                      豆包 API Key
                      <a href="https://console.volcengine.com/ark" target="_blank" className="text-violet-600 hover:underline text-[10px]">获取密钥 <ExternalLink className="w-3 h-3 inline" /></a>
                    </label>
                    <input
                      type="password"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-violet-500 outline-none"
                      placeholder="输入豆包 API Key..."
                      value={tempSettings.imageModel.doubaoApiKey}
                      onChange={(e) => setTempSettings((p: any) => ({ ...p, imageModel: { ...p.imageModel, doubaoApiKey: e.target.value } }))}
                    />
                  </div>
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl">
                    <p className="text-[10px] text-amber-800 font-medium leading-relaxed">
                      <strong>注意</strong>: 豆包图片有 CORS 限制，导出时将以 URL 形式保存（需手动下载）
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">
                    使用模型: doubao-seedream-4-5-251128 | 尺寸: 2K | 带水印
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 音效模型配置 */}
          <div className="space-y-4 p-6 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100">
            <h4 className="text-sm font-black text-amber-900 uppercase tracking-widest flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              音效模型配置
            </h4>
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 flex items-center justify-between">
                  ElevenLabs API Key
                  <a href="https://elevenlabs.io/app/sound-generation" target="_blank" className="text-amber-600 hover:underline text-[10px]">获取密钥 <ExternalLink className="w-3 h-3 inline" /></a>
                </label>
                <input
                  type="password"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="输入 ElevenLabs API Key..."
                  value={tempSettings.sfxModel.elevenLabsApiKey}
                  onChange={(e) => setTempSettings((p: any) => ({ ...p, sfxModel: { ...p.sfxModel, elevenLabsApiKey: e.target.value } }))}
                />
              </div>
              <p className="text-[10px] text-slate-400 font-medium">密钥将仅保存在您的本地浏览器中 (IndexedDB)，不会上传到服务器。</p>
            </div>
          </div>

          {/* CORS 代理配置 */}
          <div className="space-y-4 p-6 bg-gradient-to-br from-slate-50 to-gray-50 rounded-2xl border border-slate-200">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              CORS 代理配置
            </h4>
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600">
                  代理服务器地址
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-500 outline-none"
                  placeholder="http://your-proxy-server.com:5000"
                  value={tempSettings.proxyUrl}
                  onChange={(e) => setTempSettings((p: any) => ({ ...p, proxyUrl: e.target.value }))}
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
                <p className="text-[10px] text-blue-800 font-medium leading-relaxed">
                  <strong>用途</strong>: 用于解决豆包等第三方图片的 CORS 跨域限制。配置后，图片将被转换为 base64 格式，可完整导出到 ZIP。
                </p>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">不配置代理服务器时，应用将回退到 URL 模式（导出时需手动下载图片）。</p>
            </div>
          </div>

          <button
            onClick={() => { onSave(tempSettings); onClose(); }}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl text-sm font-bold shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            保存全部配置
          </button>
        </div>
      </div>
    </div>
  );
};

const InputStep = ({ state, setState }: any) => (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div className="space-y-2">
      <h2 className="text-3xl font-black text-slate-900 tracking-tight">创作灵感入口</h2>
      <p className="text-slate-500 font-medium">输入原始内容、链接或大纲，AI 将为您深度拆解。</p>
    </div>
    <div className="bg-white p-1 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
      <textarea
        className="w-full h-80 p-6 rounded-2xl focus:ring-0 border-none outline-none text-lg resize-none placeholder:text-slate-300"
        placeholder="在这里输入您的创意点子..."
        value={state.input.content}
        onChange={(e) => setState((prev: any) => ({ ...prev, input: { ...prev.input, content: e.target.value } }))}
      />
      <div className="p-4 border-t border-slate-50 flex items-center justify-between bg-slate-50/50 rounded-b-2xl">
        <div className="flex gap-2">
          {['YouTube', 'Douyin'].map(p => (
            <button key={p} onClick={() => setState((prev: any) => ({ ...prev, input: { ...prev.input, platform: p } }))}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${state.input.platform === p ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-500 border border-slate-200'}`}>
              {p === 'Douyin' ? '抖音' : p}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{state.input.content.length} 字</span>
      </div>
    </div>
  </div>
);

const AnalysisStep = ({ state, setState }: any) => (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div className="flex items-center justify-between">
      <h2 className="text-2xl font-black text-slate-900">核心策略分析</h2>
      <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase border border-indigo-100">
        <ShieldCheck className="w-3 h-3" />
        Gemini AI Strategist
      </div>
    </div>
    {['coreInfo', 'audience', 'strategy'].map((field) => {
      // 安全获取字段值，确保是字符串
      let fieldValue = (state.analysis as any)[field];
      if (typeof fieldValue === 'object' && fieldValue !== null) {
        // 如果是对象，尝试提取或转换
        fieldValue = fieldValue.text || fieldValue.content || fieldValue.value || '';
      }
      if (typeof fieldValue !== 'string') {
        fieldValue = String(fieldValue || '');
      }
      
      return (
        <div key={field} className="group bg-white p-6 rounded-3xl border border-slate-200 hover:border-indigo-300 transition-all shadow-sm">
          <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
            {field === 'coreInfo' ? '核心要点' : field === 'audience' ? '受众画像' : '创作策略'}
          </label>
          <textarea
            className="w-full p-0 border-none focus:ring-0 text-slate-700 font-medium leading-relaxed bg-transparent"
            rows={field === 'strategy' ? 6 : 3}
            value={fieldValue}
            onChange={(e) => setState((prev: any) => ({ ...prev, analysis: { ...prev.analysis, [field]: e.target.value } }))}
          />
        </div>
      );
    })}
  </div>
);

const ScriptStep = ({ state, setState }: any) => (
  <div className="space-y-8 animate-in fade-in duration-500">
    <h2 className="text-2xl font-black text-slate-900">口播文稿</h2>
    <div className="space-y-4">
      <input
        className="w-full p-6 bg-white border border-slate-200 rounded-2xl text-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
        value={state.script.title}
        placeholder="视频标题..."
        onChange={(e) => setState((prev: any) => ({ ...prev, script: { ...prev.script, title: e.target.value } }))}
      />
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
        <textarea
          className="w-full h-[500px] border-none focus:ring-0 font-mono text-base leading-loose text-slate-600 resize-none"
          value={state.script.content}
          onChange={(e) => setState((prev: any) => ({ ...prev, script: { ...prev.script, content: e.target.value } }))}
        />
      </div>
    </div>
  </div>
);

const SceneStep = ({ state, setState }: any) => {
  const scenes = Array.isArray(state.scenes) ? state.scenes : [];

  const handleAddScene = (index: number) => {
    const newScene: Scene = {
      id: `scene_${Date.now()}`,
      narration: '',
      visualKeywords: [],
      imagePrompt: ''
    };
    const newScenes = [...scenes];
    newScenes.splice(index + 1, 0, newScene);
    setState((p: any) => ({ ...p, scenes: newScenes }));
  };

  const handleDeleteScene = (index: number) => {
    if (scenes.length <= 1) {
      alert('至少需要保留一个分镜');
      return;
    }
    if (confirm('确定要删除这个分镜吗？')) {
      const newScenes = scenes.filter((_: any, i: number) => i !== index);
      setState((p: any) => ({ ...p, scenes: newScenes }));
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
          <Brush className="w-6 h-6 text-indigo-600" />
          分镜规划
        </h2>
        <span className="text-sm text-slate-400 font-medium">共 {scenes.length} 个分镜</span>
      </div>
      <div className="grid gap-4">
        {scenes.map((scene: Scene, idx: number) => (
          <div key={scene.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-all">
            <div className="p-6 flex items-start gap-4">
              <div className="shrink-0 flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 font-black text-sm flex items-center justify-center">
                  {idx + 1}
                </div>
                <button
                  onClick={() => handleDeleteScene(idx)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  title="删除分镜">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1">
                <textarea
                  className="w-full p-3 bg-slate-50/50 border border-slate-100 rounded-xl text-sm font-medium text-slate-700 resize-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                  rows={3}
                  placeholder="输入这个分镜的口播文案..."
                  value={scene.narration}
                  onChange={(e) => {
                    const n = [...scenes];
                    n[idx].narration = e.target.value;
                    setState((p: any) => ({ ...p, scenes: n }));
                  }}
                />
              </div>
            </div>
            <div className="px-6 pb-4 flex justify-center">
              <button
                onClick={() => handleAddScene(idx)}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all border border-dashed border-indigo-200 hover:border-indigo-400">
                <ChevronRight className="w-3 h-3 rotate-90" />
                在此后插入新分镜
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const VisualAssetStep = ({ state, setState, onOpenSettings }: any) => {
  const scenes = Array.isArray(state.scenes) ? state.scenes : [];
  const [genId, setGenId] = useState<string | null>(null);
  const [audioGenId, setAudioGenId] = useState<string | null>(null);
  const [sfxGenId, setSfxGenId] = useState<string | null>(null);
  const [sfxErrorId, setSfxErrorId] = useState<string | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleGen = async (idx: number) => {
    setGenId(scenes[idx].id);
    try {
      const url = await api.generateImage(scenes[idx].imagePrompt, state.settings, state.input.platform);
      setState((prev: any) => {
        const n = [...prev.scenes];
        n[idx].imageUrl = url || '';
        return { ...prev, scenes: n };
      });
    } catch (e: any) { alert(e.message); }
    finally { setGenId(null); }
  };

  const handleAudioGen = async (idx: number) => {
    setAudioGenId(scenes[idx].id);
    try {
      const url = await api.generateSpeech(scenes[idx].narration, state.settings);
      setState((prev: any) => {
        const n = [...prev.scenes];
        n[idx].audioUrl = url;
        return { ...prev, scenes: n };
      });
    } catch (e: any) { alert(e.message); }
    finally { setAudioGenId(null); }
  };

  const handleSfxGen = async (idx: number) => {
    setSfxGenId(scenes[idx].id);
    setSfxErrorId(null);
    try {
      const url = await api.generateSfx(scenes[idx].sfxPrompt || 'background sound', state.settings);
      setState((prev: any) => {
        const n = [...prev.scenes];
        n[idx].sfxUrl = url;
        return { ...prev, scenes: n };
      });
    } catch (e: any) { 
      if (e.message === "MissingElevenLabsKey") {
        onOpenSettings();
      } else if (e.message === "ElevenLabsPermissionsError") {
        setSfxErrorId(scenes[idx].id);
      } else {
        alert(e.message); 
      }
    }
    finally { setSfxGenId(null); }
  };

  const startRecording = async (idx: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const url = reader.result as string;
          setState((prev: any) => {
            const n = [...prev.scenes];
            n[idx].audioUrl = url;
            return { ...prev, scenes: n };
          });
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordingId(scenes[idx].id);
    } catch (err) {
      alert('无法开启麦克风：' + err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingId(null);
    }
  };

  const handleSfxUpload = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const url = reader.result as string;
        setState((prev: any) => {
          const n = [...prev.scenes];
          n[idx].sfxUrl = url;
          return { ...prev, scenes: n };
        });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <h2 className="text-2xl font-black text-slate-900">视觉与音频素材</h2>
      <div className="grid gap-12">
        {scenes.map((scene: Scene, idx: number) => (
          <div key={scene.id} className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden flex flex-col shadow-xl border-l-[10px] border-l-indigo-600">
            <div className="p-8 flex flex-col lg:flex-row gap-8">
              <div className="flex-1 space-y-6">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">分镜 {idx + 1}</span>
                </div>

                <p className="text-sm font-medium text-slate-700 bg-slate-50 p-4 rounded-2xl italic leading-relaxed border border-slate-100">
                  "{scene.narration}"
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-2">
                      <Brush className="w-3 h-3" /> 画面描述
                    </label>
                    <textarea className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 resize-none focus:ring-2 focus:ring-indigo-500/20 outline-none" rows={3} value={scene.imagePrompt}
                      onChange={(e) => {
                        const n = [...scenes]; n[idx].imagePrompt = e.target.value; setState((p: any) => ({ ...p, scenes: n }));
                      }} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-violet-600 uppercase flex items-center gap-2">
                      <Music className="w-3 h-3" /> 音效建议
                    </label>
                    <textarea className="w-full p-4 bg-violet-50/30 border border-violet-100/50 rounded-2xl text-xs font-bold text-slate-600 resize-none focus:ring-2 focus:ring-violet-500/20 outline-none" rows={3} value={scene.sfxPrompt || ''}
                      onChange={(e) => {
                        const n = [...scenes]; n[idx].sfxPrompt = e.target.value; setState((p: any) => ({ ...p, scenes: n }));
                      }} />
                  </div>
                </div>

                {sfxErrorId === scene.id && (
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-amber-900">ElevenLabs 权限不足 (missing_permissions)</p>
                      <p className="text-[10px] text-amber-700 leading-relaxed font-medium">您的 API 密钥不支持音效生成功能。请检查您的 ElevenLabs 订阅计划或确保已启用 Sound Effects API。您可以尝试手动上传音效素材。</p>
                    </div>
                  </div>
                )}

                <div className="pt-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <button disabled={genId === scene.id} onClick={() => handleGen(idx)} className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50">
                      {genId === scene.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />} AI 生成插画
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <button disabled={audioGenId === scene.id} onClick={() => handleAudioGen(idx)} className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-900 rounded-xl text-xs font-black border border-slate-200 hover:bg-slate-200 transition-all disabled:opacity-50">
                      {audioGenId === scene.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 text-indigo-600" />} AI 口播
                    </button>
                    {isRecording && recordingId === scene.id ? (
                      <button onClick={stopRecording} className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-600 text-white rounded-xl text-xs font-black shadow-lg animate-pulse">
                        <Square className="w-4 h-4 fill-white" /> 停止录音
                      </button>
                    ) : (
                      <button onClick={() => startRecording(idx)} className="flex-1 flex items-center justify-center gap-2 py-3 bg-white text-slate-900 rounded-xl text-xs font-black border border-slate-200 hover:bg-slate-50 transition-all">
                        <Mic className="w-4 h-4 text-indigo-600" /> 人工录制
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button disabled={sfxGenId === scene.id} onClick={() => handleSfxGen(idx)} className="flex-1 flex items-center justify-center gap-2 py-3 bg-violet-600 text-white rounded-xl text-xs font-black shadow-lg hover:bg-violet-700 transition-all disabled:opacity-50">
                      {sfxGenId === scene.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />} AI 音效
                    </button>
                    <label className="flex-1 flex items-center justify-center gap-2 py-3 bg-white text-slate-900 rounded-xl text-xs font-black border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer">
                      <Upload className="w-4 h-4 text-violet-600" /> 人工上传
                      <input type="file" className="hidden" accept="audio/*" onChange={(e) => handleSfxUpload(e, idx)} />
                    </label>
                  </div>
                </div>
              </div>

              <div className="w-full lg:w-80 space-y-4 shrink-0">
                <div className={`${state.input.platform === 'YouTube' ? 'aspect-video' : 'aspect-[9/16]'} bg-slate-50 rounded-3xl overflow-hidden relative group border border-slate-100 shadow-inner`}>
                  {scene.imageUrl ? (
                    <img src={scene.imageUrl} className="w-full h-full object-cover" alt="Preview" />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-3">
                      <ImageIcon className="w-10 h-10 opacity-20" />
                      <span className="text-[10px] font-black uppercase">等待生成</span>
                    </div>
                  )}
                </div>
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 space-y-4">
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2">
                      <Mic className="w-3 h-3" /> 口播轨道
                    </span>
                    {scene.audioUrl ? (
                      <audio key={scene.audioUrl} controls className="w-full h-8"><source src={scene.audioUrl} /></audio>
                    ) : (
                      <div className="h-8 bg-slate-100/50 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-300">
                        未生成/录制
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 pt-2 border-t border-slate-200/50">
                    <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2">
                      <Music className="w-3 h-3" /> 音效轨道
                    </span>
                    {scene.sfxUrl ? (
                      <audio key={scene.sfxUrl} controls className="w-full h-8"><source src={scene.sfxUrl} /></audio>
                    ) : (
                      <div className="h-8 bg-slate-100/50 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-300">
                        未生成/上传
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PackagingStep = ({ state, setState }: any) => {
  const [gen, setGen] = useState(false);
  const handleGen = async () => {
    setGen(true);
    try {
      const url = await api.generateImage(state.metadata.coverPrompt, state.settings, state.input.platform);
      setState((prev: any) => ({ ...prev, metadata: { ...prev.metadata, coverUrl: url || '' } }));
    } catch (e: any) { alert(e.message); }
    finally { setGen(false); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <h2 className="text-2xl font-black text-slate-900">发布包装</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
               <FileText className="w-3 h-3" /> 导出标题
             </label>
             <input className="w-full p-0 border-none focus:ring-0 text-lg font-bold text-slate-800" value={state.metadata.videoTitle} onChange={e => setState((p: any) => ({ ...p, metadata: { ...p.metadata, videoTitle: e.target.value } }))} />
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
               <Hash className="w-3 h-3" /> 热门话题
             </label>
             <div className="flex flex-wrap gap-2">
               {state.metadata.tags.map((tag: string, i: number) => (
                 <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold border border-indigo-100">#{tag}</span>
               ))}
             </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">详情描述</label>
             <textarea className="w-full p-0 border-none focus:ring-0 text-sm font-medium text-slate-600 leading-relaxed" rows={5} value={state.metadata.description} onChange={e => setState((p: any) => ({ ...p, metadata: { ...p.metadata, description: e.target.value } }))} />
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col gap-6">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">封面设计</label>
           <div className={`${state.input.platform === 'YouTube' ? 'aspect-video' : 'aspect-[9/16]'} bg-slate-50 rounded-2xl overflow-hidden relative group border border-slate-100 shadow-inner`}>
             {state.metadata.coverUrl ? <img src={state.metadata.coverUrl} className="w-full h-full object-cover" alt="Cover" /> : <div className="h-full flex items-center justify-center text-slate-200"><Brush className="w-12 h-12" /></div>}
             <button disabled={gen} onClick={handleGen} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-white text-xs font-black">
                {gen ? <Loader2 className="animate-spin" /> : '渲染高清封面'}
             </button>
           </div>
           <textarea className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold text-slate-400" rows={2} value={state.metadata.coverPrompt} onChange={e => setState((p: any) => ({ ...p, metadata: { ...p.metadata, coverPrompt: e.target.value } }))} />
        </div>
      </div>
    </div>
  );
};

const HistoryDrawer = ({ history, onRevert, onClose }: any) => (
  <div className="fixed inset-0 z-50 flex justify-end">
    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
    <div className="relative w-96 bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">历史记录</h3>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {history.map((h: any) => (
          <div key={h.id} className="p-5 border border-slate-100 rounded-2xl hover:border-indigo-200 transition-all group">
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] font-black text-slate-400 uppercase">{new Date(h.timestamp).toLocaleTimeString()}</span>
              <span className="text-[10px] font-bold bg-slate-50 px-2 py-0.5 rounded border border-slate-100 text-slate-500">{h.note}</span>
            </div>
            <button onClick={() => onRevert(h.data)} className="w-full py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black hover:bg-indigo-100 transition-all">
              恢复此版本
            </button>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default App;
