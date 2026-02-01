# CLAUDE.md

This file provides guidance for Claude Code when working with this codebase.

## Project Overview

This is a React-based captcha solving system that integrates with GeeTest v4 captcha service. It supports multiple captcha types (slide, icon click, word click) and multiple recognition providers (TTShitu, Gemini, Aegir).

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **Screenshot**: modern-screenshot

## Directory Structure

```
src/
├── core/                           # Core business logic (framework-agnostic)
│   ├── bypass/                     # Bypass execution runners
│   │   ├── SlideRunner.ts          # Slider drag simulation
│   │   ├── ClickRunner.ts          # Click event simulation
│   │   ├── types.ts                # Bypass interfaces
│   │   └── index.ts
│   ├── recognizers/                # Image recognition (API calls only)
│   │   ├── TTShituRecognizer.ts    # TTShitu OCR service
│   │   ├── GeminiRecognizer.ts     # Gemini AI service (with image cropping)
│   │   ├── AegirRecognizer.ts      # Aegir service
│   │   ├── types.ts                # IRecognizer interface
│   │   └── index.ts
│   ├── strategies/                 # Solve strategies (recognizer + runner)
│   │   ├── SlideStrategy.ts        # Slide captcha solving
│   │   ├── ClickStrategy.ts        # Click captcha solving
│   │   ├── types.ts                # ISolveStrategy interface
│   │   └── index.ts
│   ├── config/
│   │   └── captcha.config.ts       # Centralized configuration
│   └── registry.ts                 # Dynamic provider registration
├── adapters/
│   └── geetest/                    # GeeTest-specific adapters
│       ├── GeetestAdapter.ts       # DOM operations, server validation
│       ├── GeetestSDK.ts           # SDK script loading
│       └── index.ts
├── components/
│   ├── CaptchaSolver.tsx           # Main entry component
│   ├── GeetestV4Captcha.tsx        # Unified GeeTest v4 component
│   ├── ui/
│   │   ├── StatusComponents.tsx    # Loading, error, status UI
│   │   └── index.ts
│   └── index.ts
├── utils/
│   ├── captcha/                    # API clients
│   │   ├── ttshitu/client.ts       # TTShitu API
│   │   ├── gemini/client.ts        # Gemini API
│   │   ├── aegir/word/client.ts    # Aegir API
│   │   └── upload.ts               # R2 upload utility
│   ├── r2/r2Helper.ts              # Cloudflare R2 helper
│   ├── screenshot.ts               # DOM screenshot utility
│   ├── logger.ts                   # Logging utility
│   ├── helpers.ts                  # General helpers
│   └── index.ts
├── types/
│   ├── type.ts                     # CaptchaInfo interface
│   ├── captcha.ts                  # Component props types
│   └── geetest4.d.ts               # GeeTest v4 SDK types
├── consts/
│   └── consts.ts                   # Global constants
├── App.tsx
└── main.tsx
```

## Architecture Patterns

### 1. Strategy Pattern
Strategies (`SlideStrategy`, `ClickStrategy`) combine a recognizer with a runner to solve captchas end-to-end.

```typescript
const strategy = new SlideStrategy(
  new GeminiRecognizer(),
  { xOffset: -10, slideSteps: 30 }
);
await strategy.solve({ container, containerId, collector });
```

### 2. Separation of Concerns
- **Recognizers**: Only call APIs, return coordinates
- **Runners**: Only execute DOM events (slide/click)
- **Strategies**: Orchestrate the full flow

### 3. Registry Pattern
Dynamic registration replaces factory methods:
```typescript
registry.registerRecognizer("gemini", new GeminiRecognizer());
registry.registerStrategy("slide", new SlideStrategy(...));
```

## Key Interfaces

### IRecognizer
```typescript
interface IRecognizer {
  readonly name: string;
  recognize(request: RecognizeRequest): Promise<RecognizeResult>;
  reportError(captchaId: string): Promise<ReportErrorResult>;
  capture(containerId: string): Promise<ScreenshotResult | null>;
}
```

### ISolveStrategy
```typescript
interface ISolveStrategy {
  readonly type: "slide" | "click";
  solve(context: SolveContext): Promise<SolveResult>;
}
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
VITE_CAPTCHA_SERVER_HOST=https://your-server.com
VITE_TTSHITU_USERNAME=your-username
VITE_TTSHITU_PASSWORD=your-password
```

## Adding a New Recognizer

1. Create `src/core/recognizers/NewRecognizer.ts`:
```typescript
export class NewRecognizer implements IRecognizer {
  readonly name = "New";

  async recognize(request: RecognizeRequest): Promise<RecognizeResult> {
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
3. Update `CaptchaSolver.tsx` to handle the new type

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
- Metadata (solver, geetestId, challenge, etc.)

Data is uploaded to Cloudflare R2 at:
```
captchas/{provider}/{type}/{containerId}/
  ├── original.png
  ├── cropped.png (if applicable)
  ├── marked.png
  └── data.json
```
