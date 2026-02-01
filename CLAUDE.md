# CLAUDE.md

This file provides guidance for Claude Code when working with this codebase.

## Project Overview

This is a React-based captcha solving system that integrates with GeeTest v4 captcha service. It supports multiple captcha types (slide, icon click, word click) and multiple recognition providers (TTShitu, Gemini, Aegir). The system includes a task queue management feature for handling multiple concurrent captcha solving tasks.

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios + Fetch API
- **Screenshot**: modern-screenshot

## Directory Structure

```
src/
├── core/                           # Core business logic (framework-agnostic)
│   ├── bypass/                     # Bypass execution runners
│   │   ├── SlideRunner.ts          # Slider drag simulation
│   │   ├── ClickRunner.ts          # Click event simulation
│   │   ├── types.ts                # Bypass interfaces (SlideConfig, ClickConfig)
│   │   └── index.ts
│   ├── recognizers/                # Image recognition (API calls only)
│   │   ├── TTShituRecognizer.ts    # TTShitu OCR service (slide + click)
│   │   ├── GeminiRecognizer.ts     # Gemini AI service (with image cropping)
│   │   ├── AegirRecognizer.ts      # Aegir service (word/icon click)
│   │   ├── types.ts                # IRecognizer interface, CaptchaType, Point
│   │   └── index.ts
│   ├── strategies/                 # Solve strategies (recognizer + runner)
│   │   ├── SlideStrategy.ts        # Slide captcha solving
│   │   ├── ClickStrategy.ts        # Click captcha solving
│   │   ├── types.ts                # ISolveStrategy, SolveContext, SolveResult
│   │   └── index.ts
│   ├── config/
│   │   └── captcha.config.ts       # Centralized configuration
│   └── registry.ts                 # Dynamic provider registration
├── adapters/
│   └── geetest/                    # GeeTest-specific adapters
│       ├── GeetestAdapter.ts       # DOM operations, element finding
│       ├── GeetestSDK.ts           # SDK script loading
│       └── index.ts
├── components/
│   ├── CaptchaSolver.tsx           # Entry component (strategy selection)
│   ├── GeetestV4Captcha.tsx        # Unified GeeTest v4 component (lifecycle)
│   ├── ui/
│   │   ├── StatusComponents.tsx    # Loading, error, status UI
│   │   ├── SystemInfo.tsx          # Real-time system info bar
│   │   ├── TaskControls.tsx        # Task fetch/polling controls
│   │   └── index.ts
│   └── index.ts
├── hooks/
│   ├── useCaptchaQueue.ts          # Task queue management hook
│   └── index.ts
├── utils/
│   ├── api/
│   │   └── captchaTaskApi.ts       # Task API client (with mock support)
│   ├── captcha/                    # Recognition API clients
│   │   ├── ttshitu/client.ts       # TTShitu API
│   │   ├── gemini/client.ts        # Gemini API
│   │   ├── aegir/word/client.ts    # Aegir API
│   │   └── upload.ts               # R2 upload utility
│   ├── r2/r2Helper.ts              # Cloudflare R2 helper
│   ├── screenshot.ts               # DOM screenshot utility
│   ├── logger.ts                   # Namespaced logging utility
│   ├── helpers.ts                  # General helpers (generateContainerId, etc.)
│   └── index.ts
├── types/
│   ├── type.ts                     # CaptchaInfo interface
│   ├── captcha.ts                  # Component props types
│   ├── api.ts                      # API types (CaptchaTask, responses)
│   └── geetest4.d.ts               # GeeTest v4 SDK types
├── consts/
│   └── consts.ts                   # Global constants (CAPTCHA_ID, URLs)
├── App.tsx                         # Main app with task queue integration
├── App.css                         # Styling
└── main.tsx                        # React entry point
```

## Architecture Patterns

### 1. Strategy Pattern
Strategies (`SlideStrategy`, `ClickStrategy`) combine a recognizer with a runner to solve captchas end-to-end.

```typescript
// Slide solving with Gemini
const strategy = new SlideStrategy(
  new GeminiRecognizer(undefined, { topCrop: 70, bottomCrop: 110 }),
  { xOffset: -10, slideSteps: 30 }
);

// Click solving with TTShitu
const strategy = new ClickStrategy(
  new TTShituRecognizer(),
  CaptchaType.WORLD,
  { delay: { min: 400, max: 600 } }
);

await strategy.solve({ container, containerId, collector });
```

### 2. Separation of Concerns
- **Recognizers**: Only call APIs, return coordinates
- **Runners**: Only execute DOM events (slide/click)
- **Strategies**: Orchestrate the full flow (screenshot → recognize → bypass → collect)

### 3. Registry Pattern
Dynamic registration replaces factory methods:
```typescript
registry.registerRecognizer("gemini", new GeminiRecognizer());
registry.registerStrategy("slide", new SlideStrategy(...));
```

### 4. Task Queue Pattern
The `useCaptchaQueue` hook manages concurrent captcha tasks:
```typescript
const {
  tasks,
  isLoading,
  fetchTasks,
  completeTask,
  startPolling,
  stopPolling,
  isPolling,
} = useCaptchaQueue({
  maxConcurrent: 2,
  pollInterval: 10000,
  taskTimeout: 2 * 60 * 1000,
  useMock: true,
});
```

## Key Interfaces

### IRecognizer
```typescript
interface IRecognizer {
  readonly name: string;
  recognize(request: RecognizeRequest, collector?: CaptchaCollector): Promise<RecognizeResult>;
  reportError(captchaId: string): Promise<ReportErrorResult>;
  capture(containerId: string): Promise<ScreenshotResult | null>;
}

interface RecognizeResult {
  success: boolean;
  captchaId: string;
  points: Point[];        // Coordinates for solving
  message: string;
}
```

### ISolveStrategy
```typescript
interface ISolveStrategy {
  readonly type: "slide" | "click";
  solve(context: SolveContext): Promise<SolveResult>;
}

interface SolveContext {
  container: HTMLElement;
  containerId: string;
  collector: CaptchaCollector;
}
```

### CaptchaTask (API)
```typescript
interface CaptchaTask extends CaptchaInfo {
  taskId: string;
  createdAt?: number;
}

type CaptchaResultStatus = "success" | "failed" | "timeout" | "error";
```

## Solve Flow

### High-Level Flow
```
1. App fetches tasks via useCaptchaQueue
   ↓
2. CaptchaSolver selects strategy based on captchaInfo.type
   ↓
3. GeetestV4Captcha initializes SDK and waits for ready
   ↓
4. strategy.solve() executes:
   a) Capture screenshot
   b) Send to recognizer API
   c) Execute runner with coordinates
   d) Collect data
   ↓
5. GeeTest validates (onSuccess/onFail)
   ↓
6. completeTask() reports result to server
```

### Slide Strategy Flow
```
SlideStrategy.solve()
├─ recognizer.capture()
├─ recognizer.recognize()
├─ findGeeTestElements()
├─ drawDebugOverlay()
├─ SlideRunner.execute()
│  ├─ Calculate canvas→DOM scale
│  ├─ Calculate slide distance (with xOffset)
│  └─ Perform mouse/touch events
└─ return { recognizeResult, bypassResult }
```

### Click Strategy Flow
```
ClickStrategy.solve()
├─ recognizer.capture()
├─ recognizer.recognize()
├─ drawDebugOverlay()
├─ ClickRunner.execute()
│  ├─ Scale coordinates
│  ├─ For each point: dispatch events
│  └─ Click commit button
└─ return { recognizeResult, bypassResult }
```

## Common Commands

```bash
# Development
npm run dev

# Build
npm run build

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

## Environment Variables

```env
VITE_GEETEST_CAPTCHA_ID=your-captcha-id
VITE_API_BASE_URL=http://localhost:3000
VITE_TASK_API_URL=http://localhost:8080/api
VITE_CAPTCHA_SERVER_HOST=https://your-server.com
VITE_TTSHITU_USERNAME=your-username
VITE_TTSHITU_PASSWORD=your-password
```

## Configuration

Centralized in `src/core/config/captcha.config.ts`:

```typescript
const captchaConfig = {
  slide: {
    ttshitu: { xOffset: -10, slideSteps: 30, stepDelay: { min: 15, max: 25 } },
    gemini: { xOffset: -10, slideSteps: 30, cropConfig: { topCrop: 70, bottomCrop: 110 } }
  },
  click: {
    delay: { min: 400, max: 600 }
  },
  delays: {
    screenshot: 1000,
    autoClick: 1000,
    imageLoad: 2000,
    retryWait: 3000
  },
  maxRetryCount: 5
};
```

## Adding a New Recognizer

1. Create `src/core/recognizers/NewRecognizer.ts`:
```typescript
export class NewRecognizer implements IRecognizer {
  readonly name = "New";

  async recognize(request: RecognizeRequest, collector?: CaptchaCollector): Promise<RecognizeResult> {
    // Call your API
  }

  async reportError(captchaId: string): Promise<ReportErrorResult> {
    // Report error if supported
  }

  async capture(containerId: string): Promise<ScreenshotResult | null> {
    // Use captureScreenshot utility
  }
}
```

2. Export from `src/core/recognizers/index.ts`

3. Use with a strategy:
```typescript
const strategy = new SlideStrategy(new NewRecognizer());
```

## Adding a New Captcha Type

1. If it's a new bypass method, add a runner in `src/core/bypass/`
2. Create a new strategy in `src/core/strategies/`
3. Update `CaptchaSolver.tsx` to handle the new type in strategy selection

## Code Style Notes

- Use Chinese comments for business logic explanations
- Use English for interface/type names and code structure
- Logging uses `createModuleLogger()` for namespaced output
- All coordinates are processed as canvas coordinates, then scaled to DOM

## Debugging

Enable debug mode in config:
```typescript
{ debug: true }
```

This will:
- Log coordinate calculations
- Show image previews in console
- Output step-by-step bypass progress

## Data Collection

The system captures:
- Original screenshot
- Cropped/processed images
- Recognition results
- Metadata (solver, geetestId, challenge, duration, etc.)

Data is uploaded to Cloudflare R2 at:
```
captchas/{provider}/{type}/{containerId}/
  ├── original.png
  ├── cropped.png (if applicable)
  ├── marked.png
  └── data.json
```

## Task Queue System

The task queue (`useCaptchaQueue` hook) provides:
- **Polling**: Configurable interval for fetching new tasks
- **Concurrency Control**: Limits concurrent tasks (default: 2)
- **Timeout Handling**: Auto-completes timed-out tasks
- **Duration Tracking**: Records solve time for analytics
- **Mock Support**: Built-in mock data for development

### API Endpoints
```
GET  /api/tasks                    # Fetch pending tasks
POST /api/tasks/{taskId}/result    # Submit solve result
```

### Task Lifecycle
```
Fetch → In Progress → Success/Failed/Timeout → Report Result
```
