# CLAUDE.md

## Project Overview

Closure Captcha Web — 基于 React 的 GeeTest 验证码自动化求解系统。支持 GeeTest V3/V4，支持滑块、文字点选、图标点选三种验证码类型，集成五种识别提供商（Gemini、Cloudflare、Nvidia、TTShitu、Aegir）。内置任务队列管理，支持 16 并发任务的轮询、求解和结果上报。部署到 Cloudflare Pages。

## Tech Stack

- **Framework**: React 19 + TypeScript 5.9
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS 4
- **HTTP Client**: Axios
- **Screenshot**: modern-screenshot
- **Utilities**: es-toolkit
- **Deployment**: Cloudflare Pages (wrangler)

## Common Commands

```bash
pnpm dev          # 开发服务器（--host）
pnpm build        # tsc -b && vite build
pnpm lint         # eslint
npx tsc --noEmit  # 类型检查
```

## Environment Variables

```env
VITE_CAPTCHA_SERVER_HOST=https://your-server.com   # 验证码服务器地址（识别 API + 任务 API + R2 存储）
```

## Directory Structure

```
src/
├── adapters/geetest/               # GeeTest SDK 适配层
│   ├── adapters.ts                  # V3/V4 适配器实例（geetestV3Adapter, geetestV4Adapter）
│   ├── GeetestAdapter.ts            # DOM 元素查找、自动点击按钮
│   ├── GeetestSDK.ts                # SDK 脚本动态加载
│   └── index.ts
├── components/
│   ├── CaptchaSolver.tsx            # 入口组件：选择策略，渲染 GeetestCaptcha
│   ├── GeetestCaptcha.tsx           # 核心组件：SDK 初始化、生命周期、求解/重试/上报
│   ├── ui/
│   │   ├── StatusComponents.tsx     # Spinner、状态指示器、错误展示
│   │   ├── SystemInfo.tsx           # 顶部系统信息栏（版本/CPU/内存/网络/统计）
│   │   └── index.ts
│   └── index.ts
├── contexts/
│   ├── appContext.ts                # AppContext 定义 + useAppContext hook
│   └── AppProvider.tsx              # 顶层 Provider：组合 queue + autoRefresh + systemInfo
├── core/
│   ├── bypass/                      # DOM 事件执行器
│   │   ├── SlideRunner.ts           # 滑块拖拽模拟（鼠标+触摸事件）
│   │   ├── ClickRunner.ts           # 坐标点击模拟（含确认按钮点击）
│   │   ├── types.ts                 # SlideConfig, ClickConfig, BypassContext, BypassResult
│   │   └── index.ts
│   ├── recognizers/                 # 图像识别器（只调 API，返回坐标）
│   │   ├── GeminiRecognizer.ts      # Gemini AI（slide/word/icon，带裁剪预处理）
│   │   ├── CloudflareRecognizer.ts  # Cloudflare Workers AI（slide/icon，带裁剪）
│   │   ├── NvidiaRecognizer.ts      # Nvidia AI（slide/icon，带裁剪）
│   │   ├── TTShituRecognizer.ts     # TTShitu OCR（slide gap + click 1-4）
│   │   ├── AegirRecognizer.ts       # Aegir（word/icon click）
│   │   ├── types.ts                 # IRecognizer, RecognizeRequest/Result, CaptchaCollector
│   │   └── index.ts
│   ├── strategies/                  # 求解策略（识别器 + 执行器）
│   │   ├── SlideStrategy.ts         # 截图 → 识别 → findElements → SlideRunner
│   │   ├── ClickStrategy.ts         # 截图 → 识别 → findElements → ClickRunner
│   │   ├── types.ts                 # ISolveStrategy, SolveContext, SolveResult
│   │   └── index.ts
│   ├── config/captcha.config.ts     # 集中配置（延迟、步数、裁剪参数、重试次数）
│   └── registry.ts                  # 动态注册表（recognizers + strategies）
├── hooks/
│   ├── useCaptchaQueue.ts           # 任务队列 hook（轮询、填充空槽、完成任务）
│   ├── useAutoRefreshManager.ts     # 自动刷新 hook（定时刷新页面释放内存）
│   ├── useSystemInfoManager.ts      # 系统信息 hook + 模块级统计（Provider 耗时 + 验证码成功率）
│   └── index.ts
├── types/
│   ├── api.ts                       # 核心类型：CaptchaTask, TaskQueue, SubmitResultRequest, Point...
│   ├── geetest.ts                   # 统一 GeeTest 接口：GeeTestAdapter, GeeTestInstance, GeeTestError
│   ├── geetest3.d.ts                # V3 SDK 全局类型声明
│   └── geetest4.d.ts                # V4 SDK 全局类型声明
├── consts/consts.ts                 # 全局常量（URL、队列长度、定时、裁剪默认值）
├── utils/
│   ├── api/
│   │   ├── captchaServerApi.ts      # 底层 Axios 客户端（fetchTasks, submitResult, submitTaskDetailed）
│   │   ├── captchaTaskApi.ts        # 高层 API 封装（单例）
│   │   └── index.ts
│   ├── captcha/                     # 识别 API 客户端（纯 HTTP 调用）
│   │   ├── gemini/client.ts         # Gemini: solveSlider, solveIcon, solveWord
│   │   ├── cloudflare/client.ts     # Cloudflare: solveSlider, solveIcon
│   │   ├── nvidia/client.ts         # Nvidia: solveSlider, solveIcon
│   │   ├── ttshitu/client.ts        # TTShitu: predict, recognizeGapX, reportError
│   │   ├── aegir/word/client.ts     # Aegir: selectCaptcha, parsePoints
│   │   └── upload.ts               # R2 数据上传（截图 + metadata）
│   ├── r2/r2Helper.ts               # Cloudflare R2 上传工具
│   ├── screenshot.ts                # DOM 截图 + 调试绘制（竖线/点选标记）
│   ├── logger.ts                    # 日志系统（dev 自动启用，prod 静默全局 console）
│   └── helpers.ts                   # getErrorMessage 等通用工具
├── App.tsx                          # 主界面：SystemInfo + RefreshBanner + 任务网格
├── App.css                          # @import "tailwindcss"
└── main.tsx                         # 入口：AppProvider → App
```

## Architecture

### GeeTest V3/V4 Adapter Pattern

通过 `GeeTestAdapter` 接口统一 V3 和 V4 的差异：

```typescript
interface GeeTestAdapter {
  version: "v3" | "v4";
  loadScript: () => Promise<void>;
  initCaptcha: (task, onError, callback) => void;
  getGeetestId: (task) => string | undefined;
  getEffectDeps: (task) => unknown[];  // React useEffect 依赖
}
```

`CaptchaSolver` 根据 `task.riskType` 是否存在自动选择 V4 或 V3 适配器。

### Strategy Pattern

Strategies 组合 Recognizer + Runner：

```typescript
// 当前默认使用 GeminiRecognizer + ClickStrategy
const strategy = new ClickStrategy(new GeminiRecognizer(), task.type, { delay, debug });
await strategy.solve({ container, containerId, collector });
```

### Solve Flow

```
App (轮询获取任务) → CaptchaSolver (选策略+适配器) → GeetestCaptcha (SDK 初始化)
  → onReady → autoClick → 等待图片加载 → strategy.solve()
    → recognizer.capture() 截图
    → recognizer.recognize() 调 API 获取坐标
    → drawDebugOverlay() 绘制调试标记
    → runner.execute() 模拟 DOM 事件
  → GeeTest SDK 校验 → onSuccess/onFail
  → submitTaskResult() 上报结果 + uploadCaptchaData() 上传截图到 R2
  → onComplete() 释放槽位
```

### Task Queue

`useCaptchaQueue` 管理固定长度 16 槽位的任务队列（`TaskQueue` 是 16 元素元组类型）。轮询填充空槽，任务完成时置空对应槽位。

### Context Architecture

```
AppProvider
├── useCaptchaQueue      → tasks, fetchTasks, completeTask, polling...
├── useAutoRefreshManager → refreshCountdown, isPreparingRefresh, triggerRefresh
└── useSystemInfoManager  → system info, provider stats, captcha stats
```

所有状态通过 `AppContext` 提供给子组件，消费通过 `useAppContext()` hook。

### Data Collection

每次求解会收集截图和元数据，上传到 R2：
```
captchas/{provider}/{type}/{containerId}/
├── original.png    # 原始截图
├── cropped.png     # 裁剪后（Gemini/Cloudflare/Nvidia）
├── marked.png      # 标记坐标点
└── data.json       # 元数据（solver, geetestId, challenge, validateResult...）
```

### Result Reporting

每次求解完成后同时上报两个端点：
1. `POST /captcha/resp` — 提交验证凭证给上游服务器
2. `POST /api/tasks/{taskId}` — 提交详细记录（recognition, bypass, assets）到统计服务器

## Key Interfaces

```typescript
// 验证码任务
interface CaptchaTask extends CaptchaInfo {
  taskId: string;           // 本地 UUID
  containerId: string;      // = taskId，DOM 容器 ID
  provider: "geetest_v4" | "geetest_v3";
  type: "slide" | "word" | "icon";
  challenge: string;
  geetestId?: string;       // V4
  gt?: string;              // V3
  riskType?: string;        // V4 风控类型
}

// 识别器
interface IRecognizer {
  readonly name: string;
  recognize(request: RecognizeRequest, collector?: CaptchaCollector): Promise<RecognizeResult>;
  reportError(captchaId: string): Promise<ReportErrorResult>;
  capture(containerId: string): Promise<ScreenshotResult | null>;
}

// 求解策略
interface ISolveStrategy {
  readonly type: "slide" | "click";
  solve(context: SolveContext): Promise<SolveResult>;
}
```

## Configuration

`src/core/config/captcha.config.ts` 集中管理所有参数：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| slide.xOffset | -10 | 滑块 X 轴偏移校正 |
| slide.slideSteps | 30 | 滑动模拟步数 |
| click.delay | 400-600ms | 点击间隔 |
| delays.screenshot | 1000ms | 截图前等待 |
| delays.autoClick | 1000ms | 自动点击延迟 |
| delays.imageLoad | 2000ms | 图片加载等待 |
| delays.retryWait | 3000ms | 重试等待 |
| maxRetryCount | 5 | 最大重试次数 |

裁剪默认值（`consts.ts`）：
- Slide: topCrop=70, bottomCrop=110
- Click: topCrop=30, bottomCrop=125

## Adding a New Recognizer

1. 创建 API 客户端 `src/utils/captcha/{name}/client.ts`
2. 创建识别器 `src/core/recognizers/{Name}Recognizer.ts`，实现 `IRecognizer`
3. 在 `src/core/recognizers/index.ts` 导出
4. 在 `CaptchaSolver.tsx` 中使用

## API Endpoints (Server-side)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/captcha/reqs?limit=N` | 获取待处理任务（获取后自动删除） |
| POST | `/captcha/resp` | 提交验证凭证（V3/V4 格式不同） |
| POST | `/api/tasks/{taskId}` | 提交详细求解记录 |
| POST | `/store/upload` | 批量上传文件到 R2 |
| POST | `/solver/{provider}/geetest/{type}` | 识别 API（slider/icon/word） |

## Code Style

- 业务逻辑注释使用中文
- 接口/类型名使用英文
- 日志使用 `createModuleLogger()` 命名空间
- 所有坐标以 canvas 坐标处理，运行时按 DOM 实际尺寸缩放
