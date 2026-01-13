# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Video Workflow Master is a React-based web application that provides an end-to-end AI-powered workflow for creating short-form video content. The app uses multiple AI models (Gemini, DeepSeek, ElevenLabs, Doubao) to automate content analysis, script generation, scene planning, asset generation, and publishing preparation.

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (starts on port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Setup

API keys are configured in `.env` file. The app requires:
- `GEMINI_API_KEY` - Primary Gemini API key (can be overridden in UI settings)

Additional API keys can be configured through the UI settings modal (stored in IndexedDB):
- DeepSeek API Key (for content model)
- Doubao API Key + App ID (for TTS/image generation)
- ElevenLabs API Key (for sound effects)

## Architecture Overview

### Core Workflow System

The app implements a 6-step state machine workflow:

1. **Input Step** - User enters raw content and selects target platform (YouTube/TikTok/Douyin/Reels)
2. **Analysis Step** - AI analyzes content for core info, audience, and strategy
3. **Script Step** - Generates viral video script with title and narration
4. **Scene Step** - Intelligently splits script into semantic scenes (8-15 scenes) with add/delete controls
5. **Visual Asset Step** - Generates images, narration audio, and sound effects per scene
6. **Packaging Step** - Creates publishing metadata (title, tags, description, cover image)

State flows unidirectionally forward with history tracking for rollback capability.

### State Management

**Single Source of Truth**: `WorkflowState` (types.ts:55-85) contains entire app state including:
- Current step number
- Input content and platform
- Analysis results
- Script content
- Scene array with assets
- Publishing metadata
- Model settings
- Version history per step

**Persistence**: State auto-saves to IndexedDB (`dbService.ts`) on every change. On mount, state is restored with migration logic to handle legacy settings structures (App.tsx:50-121).

**History System**: Each workflow step saves snapshots to `state.history` with timestamp and note. Users can revert to previous versions through history drawer.

### Service Layer Architecture

**apiService.ts** - Central API orchestration layer that:
- Routes requests to appropriate AI provider based on user settings
- Handles provider-specific API calls (Gemini, DeepSeek, Doubao, ElevenLabs)
- Manages structured JSON responses with schema validation
- Performs audio format conversions (PCM → WAV for Gemini TTS)

Key pattern: All public functions accept `settings: ModelSettings` parameter to enable multi-provider support. Settings object determines which provider to use and which API key to authenticate with.

**Provider Selection Logic**:
- Content model: `settings.contentModel.provider` → 'gemini' or 'deepseek'
- TTS model: `settings.ttsModel.provider` → 'gemini' or 'doubao'
- Image model: `settings.imageModel.provider` → 'gemini' or 'doubao'
- SFX model: Always ElevenLabs (only provider supported)

**dbService.ts** - IndexedDB wrapper for state persistence. Simple CRUD operations on single store.

### Multi-Provider AI Integration

The app supports multiple AI providers with runtime provider switching:

**Gemini (Primary)**:
- Models: gemini-3-flash-preview, gemini-3-pro-preview, gemini-2.5-flash-image, gemini-2.5-flash-preview-tts
- Used for: content analysis, script generation, scene splitting, image generation, TTS
- Features: Structured JSON output with type schemas, native multimodal support

**DeepSeek**:
- Model: deepseek-chat
- Used for: content analysis, script generation, scene splitting (alternative to Gemini)
- Pattern: Uses `response_format: { type: 'json_object' }` for structured output

**ElevenLabs**:
- Used for: Sound effects generation via `/v1/sound-generation` endpoint
- Error handling: Detects "missing_permissions" error for accounts without SFX access
- Prompts should be concise English, max 200 chars

**Doubao (Volcengine)**:
- Models: doubao-seedream-4-5-251128 (image generation)
- Used for: TTS and image generation (alternative to Gemini)
- Image API: Uses ARK platform endpoint with 2K resolution and watermark
- Note: TTS implementation is placeholder - endpoints need verification against actual Doubao docs

### Component Structure

**App.tsx** - Monolithic main component (1100 lines) containing:
- Main workflow orchestration logic
- All step components (InputStep, AnalysisStep, ScriptStep, etc.) defined inline
- Settings modal with provider selection UI
- History drawer for version rollback
- ZIP export functionality (creates editing instructions + publishing guide + assets)

**Design Pattern**: Single-file component architecture with inline sub-components. No component splitting despite size.

### Audio Recording Feature

The app supports browser-based microphone recording for narration (App.tsx:836-876):
- Uses MediaRecorder API to capture audio
- Records in webm format, converts to Data URL
- Stores in scene.audioUrl alongside AI-generated audio
- Recording state managed with refs to handle MediaRecorder lifecycle

### Export System

When user clicks "打包导出 ZIP" at step 6, the app generates (App.tsx:183-252):

1. **剪辑说明.MD** - Editing instructions with scene-by-scene breakdown
2. **发布说明.MD** - Publishing guide with metadata and transcript
3. **/images/** folder - All scene images (PNG)
4. **/audio/** folder - Narration and SFX audio files (WAV)
5. **cover_image.png** - Video cover/thumbnail

All assets stored as Data URLs in state, converted to base64 for ZIP packaging using JSZip.

## Important Patterns

### Semantic Scene Splitting
The app uses intelligent semantic-based scene splitting (App.tsx:259-327):
- Splits based on semantic completeness, not fixed time intervals
- Each scene is a complete semantic unit (one idea, action, or scene description)
- Controls scene count to 8-15 scenes for optimal pacing
- Users can manually add/delete scenes with UI controls
- No time field - focus is on content semantic boundaries

### Scene Management Controls
SceneStep component (App.tsx:785-862) provides:
- **Add scene**: Insert new blank scene after any existing scene
- **Delete scene**: Remove scene (minimum 1 scene required)
- **Edit narration**: Direct text editing in textarea
- **Scene counter**: Display total scene count in header

### Type Safety
All workflow state uses strict TypeScript types defined in `types.ts`. Key types:
- `WorkflowState` - Complete app state shape
- `Scene` - Individual scene with narration, prompts, and asset URLs
- `ModelSettings` - Nested settings for all AI providers
- `HistoryItem<T>` - Generic type for versioned snapshots

### Data Migration
The app includes migration logic for backward compatibility (App.tsx:56-105):
- Detects legacy settings structure (only `elevenLabsApiKey`)
- Migrates to new nested `ModelSettings` structure
- Handles corrupted analysis fields (objects instead of strings)
- Uses defensive checks with fallbacks to INITIAL_STATE

### Error Handling
- API errors caught at step handlers (App.tsx:254-300)
- Special error codes: "MissingElevenLabsKey", "ElevenLabsPermissionsError"
- Missing API keys show friendly prompts to open settings
- Retry button shown on error with full error message display

### Responsive Modality Switching
Gemini TTS uses `responseModalities: [Modality.AUDIO]` to receive raw PCM audio instead of text. The response includes inlineData with base64-encoded PCM that must be wrapped in WAV container before playback (apiService.ts:380-410).

## File Organization

```
/
├── App.tsx              # Main component with all UI and workflow logic
├── apiService.ts        # Multi-provider API integration layer
├── dbService.ts         # IndexedDB persistence wrapper
├── types.ts             # TypeScript type definitions and INITIAL_STATE
├── index.tsx            # React app entry point
├── vite.config.ts       # Vite config with env variable injection
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies and scripts
```

No subdirectories for components, utils, or hooks. Flat structure with all source files in root.

## Build Configuration

**Vite** (vite.config.ts):
- Server runs on port 3000, bound to 0.0.0.0
- Defines `process.env.API_KEY` and `process.env.GEMINI_API_KEY` from `.env` file
- Uses `@vitejs/plugin-react` for JSX transform
- Path alias `@/*` maps to project root

**TypeScript** (tsconfig.json):
- Target: ES2022
- Module: ESNext with bundler resolution
- JSX: react-jsx (new transform)
- Allows importing .ts extensions (noEmit mode)
- Experimental decorators enabled

## Key Dependencies

- `react` + `react-dom` (v19) - UI framework
- `@google/genai` - Official Gemini SDK for content/image/audio generation
- `lucide-react` - Icon library (comprehensive set of icons used throughout)
- `jszip` - ZIP file creation for project export
- `vite` - Build tool and dev server
- `typescript` - Type safety

## Development Notes

- State updates should always return new objects (immutability pattern used consistently)
- Scene arrays must be validated as arrays before rendering (defensive checks present)
- All API keys stored in IndexedDB are user-managed; no server-side storage
- Image aspect ratio is 16:9 for Gemini, 2K for Doubao (all generated images)
- Scene splitting is semantic-based (8-15 scenes), not time-based
- Scenes can be dynamically added/deleted by users in SceneStep
- Audio format must be WAV for compatibility (PCM data wrapped with proper headers)
- Doubao image generation uses model: doubao-seedream-4-5-251128 with 2K resolution
- Model selection is user-configurable via settings modal (stored in ModelSettings)
