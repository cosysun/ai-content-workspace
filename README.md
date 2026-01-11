<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AI Video Workflow Master

端到端 AI 驱动的短视频创作工作流，支持多种 AI 模型（Gemini、DeepSeek、豆包、ElevenLabs）。

View your app in AI Studio: https://ai.studio/apps/drive/1gbD99jWRRWm3zymworgbO6Gz4omM5Y9u

## ✨ 特性

- 🎯 **智能内容分析** - AI 分析原始素材，提取核心要点和受众画像
- ✍️ **爆款文稿生成** - 自动生成适合目标平台的病毒式传播文案
- 🎬 **语义分镜规划** - 智能拆分为 8-15 个语义完整的分镜（支持增删）
- 🖼️ **多模态素材生成** - AI 生图、语音合成、音效生成
- 📦 **一键导出打包** - 生成完整的剪辑说明和发布指南

## 🚀 快速开始

### 前端应用

**Prerequisites:** Node.js 16+

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（可选）
# 在 .env 文件中设置 GEMINI_API_KEY
# 或在应用的设置界面中配置各种 API Key

# 3. 启动应用
npm run dev
```

应用将在 **http://localhost:3000** 启动

### CORS 代理配置（可选）

如果需要使用豆包生图并完整导出到 ZIP，请在应用设置中配置 CORS 代理服务器地址。代理服务器用于解决豆包图片的跨域限制。

## 📖 使用流程

1. **输入素材** - 粘贴原始内容/大纲，选择目标平台
2. **内容分析** - AI 分析核心信息、受众和策略（可手动调整）
3. **口播文稿** - 生成病毒式文案（可编辑）
4. **分镜规划** - 智能语义分镜，支持增删改
5. **生成素材** - 一键生成图片、语音、音效
6. **发布包装** - 生成标题、标签、描述、封面
7. **导出 ZIP** - 下载完整的素材包和说明文档

## 🎛️ 支持的 AI 模型

### 内容生成
- **Gemini** (推荐) - 2.0 Flash、1.5 Flash、1.5 Pro
- **DeepSeek** - deepseek-chat

### 图像生成
- **Gemini** (推荐) - 无 CORS 问题，完整导出
- **豆包** - doubao-seedream-4-5-251128（需代理服务器）

### 语音合成
- **Gemini** - 多语言 TTS
- **豆包** - 待实现

### 音效生成
- **ElevenLabs** - 专业音效生成

所有 API Key 均在应用设置中配置，存储于浏览器 IndexedDB（不上传服务器）。

## 🔧 开发命令

```bash
npm run dev      # 启动开发服务器
npm run build    # 构建生产版本
npm run preview  # 预览生产构建
```

## 📁 项目结构

```
/
├── App.tsx              # 主应用组件（含所有步骤 UI）
├── apiService.ts        # 多 AI 提供商集成
├── dbService.ts         # IndexedDB 持久化
└── types.ts             # TypeScript 类型定义
```

## 🐛 故障排除

### 豆包图片 CORS 错误

**问题**：豆包图片有跨域限制，无法直接下载

**解决方案**：
1. 在设置中配置 CORS 代理服务器地址
2. 或切换为 Gemini 生图（推荐）

### API 调用失败

检查：
1. API Key 是否正确配置（设置 → 模型配置）
2. API 配额是否充足
3. 网络连接是否正常

## 📚 文档

- [CLAUDE.md](./CLAUDE.md) - 代码库架构文档

## 🔒 隐私与安全

- ✅ 所有 API Key 仅存储在本地浏览器（IndexedDB）
- ✅ 不上传到任何服务器
- ✅ 代理服务器配置灵活，支持自建

## 📄 License

本项目基于 AI Studio 模板创建。
