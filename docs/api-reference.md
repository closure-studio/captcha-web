# Captcha Server API 接口文档

## 基础信息

- **Base URL**: `{WORKER_URL}/api`
- **Content-Type**: `application/json`
- **响应格式**: 所有接口返回 `{ success: boolean, data?, error? }`

---

## 1. 获取待处理任务

获取状态为 `pending` 的任务列表。

```
GET /api/tasks?limit={limit}
```

### 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `limit` | number | 否 | 10 | 返回数量，最大 100 |

### 响应示例

```json
{
  "success": true,
  "tasks": [
    {
      "taskId": "task-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "challenge": "122ca1ba-0101-4b26-9842-63c0a1424cc2",
      "geetestId": "54088bb07d2df3c46b79f80300b0abbe",
      "provider": "geetest_v4",
      "riskType": "word",
      "type": "word",
      "createdAt": 1706832000000
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `taskId` | string | 任务唯一标识 |
| `challenge` | string | GeeTest challenge 值 |
| `geetestId` | string \| null | GeeTest captcha ID |
| `provider` | string | `geetest_v4` \| `geetest_v3` |
| `riskType` | string \| null | 风控类型 |
| `type` | string \| null | 验证码类型: `slide` \| `word` \| `icon` |
| `createdAt` | number | 创建时间 (Unix 毫秒时间戳) |

---

## 2. 创建任务

创建一个新的验证码任务。

```
POST /api/tasks
```

### 请求体

```json
{
  "challenge": "122ca1ba-0101-4b26-9842-63c0a1424cc2",
  "provider": "geetest_v4",
  "geetestId": "54088bb07d2df3c46b79f80300b0abbe",
  "captchaType": "word",
  "riskType": "word"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `challenge` | string | **是** | GeeTest challenge 值 |
| `provider` | string | **是** | `geetest_v4` \| `geetest_v3` |
| `geetestId` | string | 否 | GeeTest captcha ID |
| `captchaType` | string | 否 | `slide` \| `word` \| `icon` |
| `riskType` | string | 否 | 风控类型 |

### 响应示例

```json
{
  "success": true,
  "taskId": "task-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "message": "Task created"
}
```

---

## 3. 提交任务结果

提交验证码求解结果，支持同时写入识别记录、Bypass 记录和资产信息。

```
POST /api/tasks/{taskId}
```

### 请求体

```json
{
  "status": "success",
  "result": {
    "lot_number": "xxx",
    "captcha_output": "xxx",
    "pass_token": "xxx",
    "gen_time": "xxx"
  },
  "duration": 5230,
  "recognition": {
    "recognizerName": "Gemini",
    "attemptSeq": 1,
    "success": true,
    "captchaId": "recog-id-456",
    "points": [{"x": 123, "y": 456}],
    "message": "识别成功",
    "elapsedMs": 1200,
    "errorReported": false
  },
  "bypass": {
    "bypassType": "click",
    "success": true,
    "message": "点击完成",
    "configJson": "{\"delay\":{\"min\":400,\"max\":600}}"
  },
  "assets": [
    {
      "assetType": "original",
      "r2Key": "captchas/geetest_v4/word/task-xxx/original.png",
      "fileSize": 45678,
      "width": 344,
      "height": 384
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `status` | string | **是** | `success` \| `failed` \| `timeout` \| `error` |
| `result` | object | 否 | GeeTest 验证成功凭证，仅 status=success 时需要 |
| `duration` | number | 否 | 总耗时（毫秒） |
| `errorMessage` | string | 否 | 错误信息，status 非 success 时使用 |
| `recognition` | object | 否 | 单次识别记录 |
| `recognitions` | array | 否 | 多次识别记录（重试场景），与 `recognition` 二选一 |
| `bypass` | object | 否 | Bypass 执行记录 |
| `assets` | array | 否 | 图片资产列表 |

#### recognition 对象

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `recognizerName` | string | **是** | `TTShitu` \| `Gemini` \| `Aegir` \| `Cloudflare` \| `Nvidia` |
| `success` | boolean | **是** | 是否识别成功 |
| `attemptSeq` | number | 否 | 尝试序号，默认 1 |
| `captchaId` | string | 否 | 识别服务返回的 ID（用于报错反馈） |
| `points` | array | 否 | 识别坐标 `[{x, y}]` |
| `message` | string | 否 | 识别服务返回的消息 |
| `elapsedMs` | number | 否 | 识别 API 请求耗时（毫秒） |
| `errorReported` | boolean | 否 | 是否已向识别服务报错 |

#### bypass 对象

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bypassType` | string | **是** | `slide` \| `click` |
| `success` | boolean | **是** | 是否执行成功 |
| `message` | string | 否 | 结果消息 |
| `configJson` | string | 否 | 执行配置参数 JSON 字符串 |
| `targetX` | number | 否 | 滑动目标 X 坐标 |
| `actualSteps` | number | 否 | 实际执行步数（仅滑动类型） |

#### asset 对象

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `assetType` | string | **是** | `original` \| `cropped` \| `marked` \| `background` |
| `r2Key` | string | **是** | R2 存储路径 |
| `fileSize` | number | 否 | 文件大小（字节） |
| `width` | number | 否 | 图片宽度（像素） |
| `height` | number | 否 | 图片高度（像素） |

### 响应示例

```json
{
  "success": true,
  "message": "Result submitted"
}
```

---

## 4. 统计查询

统一的统计接口，通过 `view` 参数切换不同视图。

```
GET /api/stats?view={view}&from={from}&to={to}&interval={interval}
```

### 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `view` | string | 否 | `overview` | 视图类型 |
| `from` | number | 否 | 24小时前 | 开始时间 (Unix 毫秒) |
| `to` | number | 否 | 当前时间 | 结束时间 (Unix 毫秒) |
| `interval` | string | 否 | `hour` | 时间粒度，仅 trend 视图使用 |

### view 类型

| view | 说明 |
|------|------|
| `overview` | 总览统计 |
| `by-type` | 按验证码类型分组 |
| `by-recognizer` | 按识别器分组 |
| `trend` | 时间趋势 |

---

### 4.1 总览统计

```
GET /api/stats?view=overview
```

```json
{
  "success": true,
  "data": {
    "total": 1000,
    "success": 720,
    "failed": 200,
    "timeout": 60,
    "error": 20,
    "successRate": 72.0,
    "avgDurationMs": 4500
  }
}
```

---

### 4.2 按类型统计

```
GET /api/stats?view=by-type
```

```json
{
  "success": true,
  "data": [
    { "captchaType": "slide", "total": 500, "success": 400, "successRate": 80.0, "avgDurationMs": 3200 },
    { "captchaType": "word",  "total": 300, "success": 200, "successRate": 66.67, "avgDurationMs": 5100 },
    { "captchaType": "icon",  "total": 200, "success": 120, "successRate": 60.0, "avgDurationMs": 5800 }
  ]
}
```

---

### 4.3 按识别器统计

```
GET /api/stats?view=by-recognizer
```

```json
{
  "success": true,
  "data": [
    { "recognizerName": "Gemini",  "total": 400, "success": 320, "successRate": 80.0, "avgElapsedMs": 1500 },
    { "recognizerName": "TTShitu", "total": 350, "success": 250, "successRate": 71.43, "avgElapsedMs": 900 },
    { "recognizerName": "Aegir",   "total": 250, "success": 150, "successRate": 60.0, "avgElapsedMs": 1100 }
  ]
}
```

---

### 4.4 时间趋势

```
GET /api/stats?view=trend&interval=hour
```

| interval | 说明 |
|----------|------|
| `hour` | 按小时聚合 |
| `day` | 按天聚合 |

```json
{
  "success": true,
  "data": [
    { "time": "2025-02-01 10:00", "total": 50, "success": 38, "successRate": 76.0 },
    { "time": "2025-02-01 11:00", "total": 45, "success": 35, "successRate": 77.78 }
  ]
}
```

---

## 错误响应

所有接口错误返回格式一致：

```json
{
  "success": false,
  "error": "错误描述"
}
```

| HTTP 状态码 | 说明 |
|-------------|------|
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## TypeScript 类型定义

```typescript
// 任务状态
type TaskStatus = 'pending' | 'success' | 'failed' | 'timeout' | 'error';

// 验证码类型
type CaptchaType = 'slide' | 'word' | 'icon';

// Provider
type Provider = 'geetest_v4' | 'geetest_v3';

// 识别器
type RecognizerName = 'TTShitu' | 'Gemini' | 'Aegir' | 'Cloudflare' | 'Nvidia';

// Bypass 类型
type BypassType = 'slide' | 'click';

// 资产类型
type AssetType = 'original' | 'cropped' | 'marked' | 'background';

// 坐标点
interface Point {
  x: number;
  y: number;
}
```

---

## 示例：完整流程

```typescript
// 1. 创建任务
const createRes = await fetch('/api/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    challenge: 'xxx-xxx-xxx',
    provider: 'geetest_v4'
  })
});
const { taskId } = await createRes.json();

// 2. 执行验证码求解...

// 3. 提交结果
await fetch(`/api/tasks/${taskId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'success',
    result: { lot_number: '...', captcha_output: '...', pass_token: '...', gen_time: '...' },
    duration: 5230,
    recognition: {
      recognizerName: 'Gemini',
      success: true,
      points: [{ x: 123, y: 456 }],
      elapsedMs: 1200
    }
  })
});

// 4. 查看统计
const statsRes = await fetch('/api/stats?view=overview');
const { data } = await statsRes.json();
console.log(`成功率: ${data.successRate}%`);
```
