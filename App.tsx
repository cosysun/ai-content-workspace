
import React, { useState, useEffect } from 'react';
import { INITIAL_STATE, WorkflowState, Platform, Scene, HistoryItem, AppConfig } from './types';
import * as api from './apiService';
import { 
  CheckCircle2, 
  ChevronRight, 
  Loader2, 
  Video, 
  MessageSquare, 
  Layout, 
  Image as ImageIcon, 
  Settings, 
  AlertCircle,
  FileText,
  Save,
  Wand2,
  History,
  RotateCcw,
  Clock,
  X,
  ShieldCheck,
  Zap,
  Brush,
  RefreshCw,
  ExternalLink,
  Hash
} from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<WorkflowState>(() => {
    const saved = localStorage.getItem('ai_video_workflow_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { 
          ...INITIAL_STATE, 
          ...parsed, 
          config: { ...INITIAL_STATE.config, ...parsed.config },
          scenes: Array.isArray(parsed.scenes) ? parsed.scenes : []
        };
      } catch (e) {
        return INITIAL_STATE;
      }
    }
    return INITIAL_STATE;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(!state.config.deepseekKey || !state.config.arkKey);

  useEffect(() => {
    localStorage.setItem('ai_video_workflow_state', JSON.stringify(state));
  }, [state]);

  const steps = [
    { id: 1, name: '输入素材', icon: FileText },
    { id: 2, name: '内容分析', icon: Zap },
    { id: 3, name: '口播文稿', icon: MessageSquare },
    { id: 4, name: '分镜规划', icon: Brush },
    { id: 5, name: '生成素材', icon: ImageIcon },
    { id: 6, name: '发布包装', icon: Settings },
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
      history: { ...prev.history, [key]: [newItem, ...prev.history[key as keyof typeof prev.history]].slice(0, 10) }
    }));
  };

  const getHistoryKey = (stepId: number) => {
    if (stepId === 2) return 'analysis';
    if (stepId === 3) return 'script';
    if (stepId === 4 || stepId === 5) return 'scenes';
    if (stepId === 6) return 'metadata';
    return null;
  };

  const handleNext = async () => {
    setLoading(true);
    setError(null);
    try {
      if (state.step === 1) {
        if (!state.input.content) throw new Error("请输入创作内容");
        const analysis = await api.analyzeContent(state.config, state.input.content, state.input.platform);
        setState(prev => ({ ...prev, step: 2, analysis }));
        saveToHistory(2, analysis, "内容初始分析");
      } else if (state.step === 2) {
        saveToHistory(2, state.analysis, "分析确认");
        const script = await api.generateViralScript(state.config, state.analysis, state.input.platform);
        setState(prev => ({ ...prev, step: 3, script }));
        saveToHistory(3, script, "文稿生成");
      } else if (state.step === 3) {
        saveToHistory(3, state.script, "文稿确认");
        const scenes = await api.splitScenes(state.config, state.script.content);
        if (!Array.isArray(scenes)) throw new Error("分镜数据格式错误：未能获得分镜列表");
        setState(prev => ({ ...prev, step: 4, scenes }));
        saveToHistory(4, scenes, "分镜切分");
      } else if (state.step === 4) {
        saveToHistory(4, state.scenes, "分镜审核");
        const visuals = await api.generateVisualAssets(state.config, state.scenes);
        if (!Array.isArray(visuals)) throw new Error("视觉提示词生成错误：未能获得提示词列表");
        const updatedScenes = state.scenes.map(scene => {
          const match = visuals.find((v: any) => v.id === scene.id);
          return match ? { ...scene, ...match } : scene;
        });
        setState(prev => ({ ...prev, step: 5, scenes: updatedScenes }));
        saveToHistory(5, updatedScenes, "视觉提示词生成");
      } else if (state.step === 5) {
        saveToHistory(5, state.scenes, "素材确认");
        const packaging = await api.generatePackaging(state.config, state.script.content, state.input.platform);
        setState(prev => ({ ...prev, step: 6, metadata: packaging }));
        saveToHistory(6, packaging, "发布方案生成");
      }
    } catch (err: any) {
      console.error("Workflow Error:", err);
      setError(err.message || '操作失败，请检查配置');
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
            <h1 className="text-lg font-bold tracking-tight">AI 创作工作流 <span className="text-xs font-normal text-slate-400">DeepSeek + Doubao</span></h1>
            <p className="text-[10px] text-slate-400 font-medium">人工审核驱动 • 手绘风格引擎</p>
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
          <button onClick={() => setShowSettings(true)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
            <Settings className="w-5 h-5" />
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
          <div className="max-w-4xl mx-auto pb-24">
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-6 rounded-[2rem] flex flex-col gap-4 animate-in fade-in zoom-in duration-300">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 shrink-0" />
                  <h4 className="font-bold">生成过程中遇到问题</h4>
                </div>
                <p className="text-sm font-medium opacity-80 leading-relaxed">{error}</p>
                <div className="flex gap-2">
                  <button onClick={() => { setError(null); handleNext(); }} className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-xl text-xs font-bold transition-all">
                    <RefreshCw className="w-3 h-3" /> 重试
                  </button>
                  <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all">
                    <Settings className="w-3 h-3" /> 检查 API 配置
                  </button>
                </div>
              </div>
            )}

            {state.step === 1 && <InputStep state={state} setState={setState} />}
            {state.step === 2 && <AnalysisStep state={state} setState={setState} />}
            {state.step === 3 && <ScriptStep state={state} setState={setState} />}
            {state.step === 4 && <SceneStep state={state} setState={setState} />}
            {state.step === 5 && <VisualAssetStep state={state} setState={setState} />}
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
                className="flex items-center gap-2 px-10 py-3 bg-slate-900 hover:bg-black text-white rounded-2xl shadow-xl transition-all font-bold disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {state.step === 6 ? '确认方案' : '确认内容并下一步'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {showHistory && (
          <HistoryDrawer history={currentHistory} onRevert={(data) => revertTo(currentHistoryKey!, data)} onClose={() => setShowHistory(false)} />
        )}
        {showSettings && (
          <SettingsModal config={state.config} setConfig={(c) => setState(prev => ({ ...prev, config: c }))} onClose={() => setShowSettings(false)} />
        )}
      </main>
    </div>
  );
};

// --- Step Components ---

const InputStep = ({ state, setState }: any) => (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div className="space-y-2">
      <h2 className="text-3xl font-black text-slate-900 tracking-tight">内容创作入口</h2>
      <p className="text-slate-500 font-medium">输入原始内容或链接，AI 将进行语义拆解与创作。</p>
    </div>
    <div className="bg-white p-1 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
      <textarea
        className="w-full h-80 p-6 rounded-2xl focus:ring-0 border-none outline-none text-lg resize-none placeholder:text-slate-300"
        placeholder="粘贴内容链接或直接输入灵感..."
        value={state.input.content}
        onChange={(e) => setState((prev: any) => ({ ...prev, input: { ...prev.input, content: e.target.value } }))}
      />
      <div className="p-4 border-t border-slate-50 flex items-center justify-between bg-slate-50/50 rounded-b-2xl">
        <div className="flex gap-2">
          {['YouTube', 'TikTok', 'Douyin'].map(p => (
            <button key={p} onClick={() => setState((prev: any) => ({ ...prev, input: { ...prev.input, platform: p } }))}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${state.input.platform === p ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-500 border border-slate-200'}`}>
              {p}
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
      <h2 className="text-2xl font-black text-slate-900">内容深度策略分析</h2>
      <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100">
        <ShieldCheck className="w-3 h-3" />
        AI Content Strategy
      </div>
    </div>
    {['coreInfo', 'audience', 'strategy'].map((field) => (
      <div key={field} className="group bg-white p-6 rounded-3xl border border-slate-200 hover:border-indigo-300 transition-all shadow-sm">
        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
          {field === 'coreInfo' ? '核心要点' : field === 'audience' ? '受众画像' : '创作策略'}
        </label>
        <textarea
          className="w-full p-0 border-none focus:ring-0 text-slate-700 font-medium leading-relaxed bg-transparent"
          rows={field === 'strategy' ? 6 : 3}
          value={(state.analysis as any)[field]}
          onChange={(e) => setState((prev: any) => ({ ...prev, analysis: { ...prev.analysis, [field]: e.target.value } }))}
        />
      </div>
    ))}
  </div>
);

const ScriptStep = ({ state, setState }: any) => (
  <div className="space-y-8 animate-in fade-in duration-500">
    <h2 className="text-2xl font-black text-slate-900">口播文稿生成</h2>
    <div className="space-y-4">
      <input
        className="w-full p-6 bg-white border border-slate-200 rounded-2xl text-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
        value={state.script.title}
        placeholder="输入爆款标题..."
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
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
        <Brush className="w-6 h-6 text-indigo-600" />
        分镜规划预演
      </h2>
      <div className="grid gap-4">
        {scenes.map((scene: Scene, idx: number) => (
          <div key={scene.id} className="bg-white border border-slate-200 p-6 rounded-2xl flex items-start gap-6 hover:shadow-md transition-all">
            <div className="shrink-0">
               <input className="w-20 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center" value={scene.time} 
                 onChange={(e) => {
                   const n = [...scenes]; n[idx].time = e.target.value; setState((p: any) => ({ ...p, scenes: n }));
                 }} />
            </div>
            <div className="flex-1">
              <textarea className="w-full p-3 bg-slate-50/50 border border-slate-100 rounded-xl text-sm font-medium text-slate-600 resize-none focus:bg-white transition-colors" rows={2} value={scene.narration} 
                 onChange={(e) => {
                   const n = [...scenes]; n[idx].narration = e.target.value; setState((p: any) => ({ ...p, scenes: n }));
                 }} />
            </div>
          </div>
        ))}
        {scenes.length === 0 && <p className="text-slate-400 italic text-center py-12">暂无分镜数据</p>}
      </div>
    </div>
  );
};

const VisualAssetStep = ({ state, setState }: any) => {
  const scenes = Array.isArray(state.scenes) ? state.scenes : [];
  const [genId, setGenId] = useState<string | null>(null);
  
  const handleGen = async (idx: number) => {
    setGenId(scenes[idx].id);
    try {
      const url = await api.generateImage(state.config, scenes[idx].imagePrompt);
      const n = [...scenes]; n[idx].imageUrl = url; setState((p: any) => ({ ...p, scenes: n }));
    } catch (e: any) { alert(e.message); }
    finally { setGenId(null); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <h2 className="text-2xl font-black text-slate-900">视觉素材生成</h2>
      <div className="grid gap-8">
        {scenes.map((scene: Scene, idx: number) => (
          <div key={scene.id} className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden flex flex-col md:flex-row shadow-sm hover:shadow-xl transition-all border-l-4 border-l-indigo-600">
            <div className="flex-1 p-8 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded">SCENE {idx + 1}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{scene.time}</span>
              </div>
              <p className="text-xs font-medium text-slate-400 italic">"{scene.narration}"</p>
              <textarea className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-indigo-900 outline-none focus:ring-1 focus:ring-indigo-300 transition-all" rows={3} value={scene.imagePrompt}
                onChange={(e) => {
                  const n = [...scenes]; n[idx].imagePrompt = e.target.value; setState((p: any) => ({ ...p, scenes: n }));
                }} />
            </div>
            <div className="w-full md:w-72 h-72 bg-slate-50 border-l border-slate-100 relative group shrink-0">
              {scene.imageUrl ? (
                <img src={scene.imageUrl} className="w-full h-full object-cover transition-all group-hover:scale-105" alt="Preview" />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-3">
                  <Brush className="w-8 h-8 opacity-20" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Awaiting Render</span>
                </div>
              )}
              <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-[2px]">
                <button disabled={genId === scene.id} onClick={() => handleGen(idx)} className="bg-white text-slate-900 px-6 py-3 rounded-2xl text-xs font-black shadow-2xl hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-50">
                  {genId === scene.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 text-indigo-600" />}
                  手绘风格生成
                </button>
              </div>
            </div>
          </div>
        ))}
        {scenes.length === 0 && <p className="text-slate-400 italic text-center py-12">暂无分镜数据</p>}
      </div>
    </div>
  );
};

const PackagingStep = ({ state, setState }: any) => {
  const [gen, setGen] = useState(false);
  const handleGen = async () => {
    setGen(true);
    try {
      const url = await api.generateImage(state.config, state.metadata.coverPrompt);
      setState((prev: any) => ({ ...prev, metadata: { ...prev.metadata, coverUrl: url } }));
    } catch (e: any) { alert(e.message); }
    finally { setGen(false); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <h2 className="text-2xl font-black text-slate-900">最后一步：发布包装与封面</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4 shadow-sm">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
               <FileText className="w-3 h-3" /> 发布标题
             </label>
             <input className="w-full p-0 border-none focus:ring-0 text-lg font-bold text-slate-800" value={state.metadata.videoTitle} onChange={e => setState((p: any) => ({ ...p, metadata: { ...p.metadata, videoTitle: e.target.value } }))} />
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4 shadow-sm">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
               <Hash className="w-3 h-3" /> 关键词 (Keywords)
             </label>
             <div className="flex flex-wrap gap-2">
               {state.metadata.tags.map((tag: string, i: number) => (
                 <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold border border-indigo-100">#{tag}</span>
               ))}
               {state.metadata.tags.length === 0 && <span className="text-xs text-slate-300 italic">暂无关键词</span>}
             </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4 shadow-sm">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">视频简介</label>
             <textarea className="w-full p-0 border-none focus:ring-0 text-sm font-medium text-slate-600 leading-relaxed" rows={5} value={state.metadata.description} onChange={e => setState((p: any) => ({ ...p, metadata: { ...p.metadata, description: e.target.value } }))} />
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-100 flex flex-col gap-6">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">封面图设计 (手绘风格)</label>
           <div className="aspect-[4/5] bg-slate-50 rounded-2xl overflow-hidden relative group border border-slate-100 shadow-inner">
             {state.metadata.coverUrl ? <img src={state.metadata.coverUrl} className="w-full h-full object-cover" alt="Cover" /> : <div className="h-full flex items-center justify-center text-slate-200"><Brush className="w-12 h-12" /></div>}
             <button disabled={gen} onClick={handleGen} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-white text-xs font-black">
                {gen ? <Loader2 className="animate-spin" /> : '重新渲染封面'}
             </button>
           </div>
           <textarea className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold text-slate-400" rows={2} value={state.metadata.coverPrompt} onChange={e => setState((p: any) => ({ ...p, metadata: { ...p.metadata, coverPrompt: e.target.value } }))} />
        </div>
      </div>
      <div className="bg-slate-900 p-10 rounded-[3rem] text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl shadow-slate-300 border border-white/10">
        <div className="space-y-2">
          <h3 className="text-2xl font-black">工作流已就绪</h3>
          <p className="text-slate-400 text-sm max-w-sm">文案与视觉素材已完成版本固化。您可以下载资源包开始剪辑。</p>
        </div>
        <button className="px-12 py-5 bg-white text-slate-900 rounded-3xl font-black shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3">
          <Save className="w-5 h-5 text-indigo-600" />
          下载完整创作包
        </button>
      </div>
    </div>
  );
};

// --- Helper Components ---

const HistoryDrawer = ({ history, onRevert, onClose }: any) => (
  <div className="fixed inset-0 z-50 flex justify-end">
    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
    <div className="relative w-96 bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">版本记录</h3>
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

const SettingsModal = ({ config, setConfig, onClose }: any) => {
  const [localConfig, setLocalConfig] = useState(config);

  const handleSave = () => {
    setConfig(localConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl p-10 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-2xl font-black text-slate-900">API 引擎配置</h3>
            <p className="text-xs font-medium text-slate-400">请确保填写正确的 API Key 和端点</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-6">
          <section className="space-y-4">
            <h4 className="flex items-center gap-2 text-xs font-black uppercase text-indigo-600 tracking-widest border-b pb-2">
              <Zap className="w-3 h-3" /> DeepSeek (文案引擎)
            </h4>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">API Key</label>
                <input className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
                  type="password" value={localConfig.deepseekKey} onChange={e => setLocalConfig({ ...localConfig, deepseekKey: e.target.value })} placeholder="sk-..." />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase flex justify-between">
                  API Endpoint 
                  <a href="https://api-docs.deepseek.com/" target="_blank" className="text-indigo-500 flex items-center gap-1 hover:underline">文档 <ExternalLink className="w-2 h-2" /></a>
                </label>
                <input className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
                  value={localConfig.deepseekEndpoint} onChange={e => setLocalConfig({ ...localConfig, deepseekEndpoint: e.target.value })} placeholder="https://api.deepseek.com/v1" />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h4 className="flex items-center gap-2 text-xs font-black uppercase text-violet-600 tracking-widest border-b pb-2">
              <ImageIcon className="w-3 h-3" /> 豆包 / Volcengine (视觉引擎)
            </h4>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Ark API Key (火山引擎)</label>
                <input className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
                  type="password" value={localConfig.arkKey} onChange={e => setLocalConfig({ ...localConfig, arkKey: e.target.value })} placeholder="填写火山引擎 Access Key 或 Token" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Model ID (接入点名称)</label>
                <input className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" 
                  value={localConfig.arkModel} onChange={e => setLocalConfig({ ...localConfig, arkModel: e.target.value })} placeholder="ep-202xxxxx-xxxxx" />
                <p className="text-[10px] text-slate-400">注：请在火山引擎 Ark 平台创建模型接入点后获取 ID</p>
              </div>
            </div>
          </section>
        </div>

        <button onClick={handleSave} className="w-full mt-10 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl shadow-slate-200 hover:bg-black transition-all flex items-center justify-center gap-2">
          <Save className="w-4 h-4" />
          保存配置并开始
        </button>
      </div>
    </div>
  );
};

export default App;
