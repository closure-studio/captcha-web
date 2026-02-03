# 后端适配指南

## 背景

前端已完成重构，将 `submitResult` 上报逻辑从 `useCaptchaQueue` hook 移至 `GeetestV4Captcha` 组件内部。由于 `fetchTasks` 获取的任务不存储在 D1 数据库中，前端现在会在 `submitResult` 请求中**携带完整的任务原始信息**。

## API 变更

### 端点

```
POST /api/tasks/{taskId}
```

### 请求体变更

**旧版本** (假设任务已在 D1 中):
```json
{
  "status": "success",
  "duration": 5230,
  "result": {
    "lot_number": "xxx",
    "captcha_output": "xxx",
    "pass_token": "xxx",
    "gen_time": "xxx"
  }
}
```

**新版本** (携带完整任务信息):
```json
{
  "status": "success",
  "duration": 5230,
  "result": {
    "lot_number": "xxx",
    "captcha_output": "xxx",
    "pass_token": "xxx",
    "gen_time": "xxx"
  },
  "errorMessage": null,

  // 新增：任务原始信息
  "challenge": "122ca1ba-0101-4b26-9842-63c0a1424cc2",
  "geetestId": "54088bb07d2df3c46b79f80300b0abbe",
  "provider": "geetest_v4",
  "captchaType": "word",
  "riskType": "word"
}
```

## 完整请求体类型定义

```typescript
interface SubmitResultRequest {
  // === 必填字段 ===
  status: "success" | "failed" | "timeout" | "error";

  // === 可选：结果数据 ===
  duration?: number;              // 耗时（毫秒）
  result?: GeetestValidateResult; // 验证成功时的凭证
  errorMessage?: string;          // 失败/错误时的消息

  // === 可选：详细记录（暂未使用，预留扩展）===
  recognition?: RecognitionRecord;
  recognitions?: RecognitionRecord[];
  bypass?: BypassRecord;
  assets?: AssetRecord[];

  // === 新增：任务原始信息 ===
  challenge?: string;             // 验证码 challenge
  geetestId?: string;             // GeeTest captcha ID
  provider?: "geetest_v4" | "geetest_v3";
  captchaType?: "slide" | "word" | "icon";
  riskType?: string;              // GeeTest 风控类型
}

interface GeetestValidateResult {
  lot_number?: string;
  captcha_output?: string;
  pass_token?: string;
  gen_time?: string;
}
```

## 后端处理逻辑建议

### 方案 A：直接使用请求中的任务信息

后端不再依赖 D1 查询任务，直接使用请求体中携带的信息：

```go
// Go 伪代码
func HandleSubmitResult(c *gin.Context) {
    taskId := c.Param("taskId")

    var req SubmitResultRequest
    if err := c.BindJSON(&req); err != nil {
        c.JSON(400, gin.H{"success": false, "error": "Invalid request"})
        return
    }

    // 直接使用请求中的任务信息，无需查询 D1
    record := CaptchaRecord{
        TaskID:      taskId,
        Status:      req.Status,
        Duration:    req.Duration,
        Challenge:   req.Challenge,    // 来自请求体
        GeetestID:   req.GeetestId,    // 来自请求体
        Provider:    req.Provider,     // 来自请求体
        CaptchaType: req.CaptchaType,  // 来自请求体
        RiskType:    req.RiskType,     // 来自请求体
        Result:      req.Result,
        ErrorMsg:    req.ErrorMessage,
        CreatedAt:   time.Now(),
    }

    // 存入 D1
    if err := db.Insert(record); err != nil {
        c.JSON(500, gin.H{"success": false, "error": "Database error"})
        return
    }

    c.JSON(200, gin.H{"success": true})
}
```

### 方案 B：验证后使用（可选）

如果需要验证 taskId 的有效性，可以先查询再合并：

```go
func HandleSubmitResult(c *gin.Context) {
    taskId := c.Param("taskId")

    var req SubmitResultRequest
    if err := c.BindJSON(&req); err != nil {
        c.JSON(400, gin.H{"success": false, "error": "Invalid request"})
        return
    }

    // 尝试从 D1 查询（可能不存在）
    existingTask, err := db.FindTask(taskId)

    // 合并数据：优先使用 D1 中的数据，缺失则使用请求中的
    record := CaptchaRecord{
        TaskID:   taskId,
        Status:   req.Status,
        Duration: req.Duration,
    }

    if existingTask != nil {
        record.Challenge = existingTask.Challenge
        record.GeetestID = existingTask.GeetestID
        // ...
    } else {
        // 使用请求中的任务信息
        record.Challenge = req.Challenge
        record.GeetestID = req.GeetestId
        record.Provider = req.Provider
        record.CaptchaType = req.CaptchaType
        record.RiskType = req.RiskType
    }

    // ...
}
```

## 数据库 Schema 建议

如果需要存储完整的结果记录：

```sql
CREATE TABLE captcha_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,

    -- 状态
    status TEXT NOT NULL,           -- 'success' | 'failed' | 'timeout' | 'error'
    duration INTEGER,               -- 耗时（毫秒）
    error_message TEXT,

    -- 任务原始信息
    challenge TEXT,
    geetest_id TEXT,
    provider TEXT,                  -- 'geetest_v4' | 'geetest_v3'
    captcha_type TEXT,              -- 'slide' | 'word' | 'icon'
    risk_type TEXT,

    -- 验证结果（JSON 存储）
    validate_result TEXT,           -- JSON: GeetestValidateResult

    -- 时间戳
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_results_task_id ON captcha_results(task_id);
CREATE INDEX idx_results_status ON captcha_results(status);
CREATE INDEX idx_results_created_at ON captcha_results(created_at);
```

## 响应格式

保持不变：

```json
{
  "success": true,
  "message": "Result submitted successfully"
}
```

或失败时：

```json
{
  "success": false,
  "error": "Error message here"
}
```

## 数据流示意图

```
┌─────────────────┐     GET /api/tasks      ┌─────────────────┐
│                 │ ◄────────────────────── │                 │
│   前端 (Web)    │                         │   后端 (API)    │
│                 │ ───────────────────────►│                 │
│  GeetestV4      │  POST /api/tasks/{id}   │                 │
│  Captcha        │                         │                 │
└─────────────────┘                         └─────────────────┘
                                                    │
        请求体包含:                                   │
        - status                                    │
        - duration                                  ▼
        - result (验证凭证)                    ┌─────────────────┐
        - challenge      ◄── 新增              │                 │
        - geetestId      ◄── 新增              │   D1 Database   │
        - provider       ◄── 新增              │                 │
        - captchaType    ◄── 新增              └─────────────────┘
        - riskType       ◄── 新增
```

## 测试用例

### 成功场景

```bash
curl -X POST "http://localhost:8787/api/tasks/test-task-123" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "success",
    "duration": 5230,
    "result": {
      "lot_number": "abc123",
      "captcha_output": "output_data",
      "pass_token": "token_data",
      "gen_time": "1234567890"
    },
    "challenge": "122ca1ba-0101-4b26-9842-63c0a1424cc2",
    "geetestId": "54088bb07d2df3c46b79f80300b0abbe",
    "provider": "geetest_v4",
    "captchaType": "word",
    "riskType": "word"
  }'
```

### 失败场景

```bash
curl -X POST "http://localhost:8787/api/tasks/test-task-456" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "failed",
    "duration": 12500,
    "errorMessage": "已达最大重试次数",
    "challenge": "abc-def-ghi",
    "geetestId": "54088bb07d2df3c46b79f80300b0abbe",
    "provider": "geetest_v4",
    "captchaType": "slide",
    "riskType": "slide"
  }'
```

### 错误场景

```bash
curl -X POST "http://localhost:8787/api/tasks/test-task-789" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "error",
    "duration": 1200,
    "errorMessage": "识别失败: API 超时",
    "challenge": "xyz-123",
    "geetestId": "54088bb07d2df3c46b79f80300b0abbe",
    "provider": "geetest_v4",
    "captchaType": "icon"
  }'
```

## 注意事项

1. **字段可选性**: 所有新增的任务信息字段都是可选的，后端应处理字段缺失的情况
2. **向后兼容**: 建议后端同时支持旧格式（不含任务信息）和新格式
3. **数据验证**: 建议对 `provider`, `captchaType`, `status` 等枚举字段进行验证
4. **日志记录**: 建议记录完整请求以便调试

## 前端代码位置

相关前端代码变更位于：
- `src/components/GeetestV4Captcha.tsx` - `submitTaskResult` 函数（第 101-134 行）
- `src/types/api.ts` - `SubmitResultRequest` 类型定义（第 110-128 行）
