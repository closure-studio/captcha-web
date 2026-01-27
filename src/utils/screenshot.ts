import { domToPng } from "modern-screenshot";
import { createModuleLogger } from "./logger";

const logger = createModuleLogger("Screenshot");

/**
 * 截图结果
 */
export interface ScreenshotResult {
  /** Base64 编码的图片数据（不含 data:image/png;base64, 前缀） */
  base64: string;
  /** Canvas 元素，可用于后续图像处理 */
  canvas: HTMLCanvasElement;
  /** 完整的 Data URL */
  dataUrl: string;
}

/**
 * 调试绘制类型
 */
export type DebugDrawType = "vertical-line" | "click-points";

/**
 * 调试绘制配置
 */
export interface DebugDrawConfig {
  /** 绘制类型: vertical-line 画竖线, click-points 画点 */
  type: DebugDrawType;
  /** 坐标点数组 - vertical-line 只用 x, click-points 用 x 和 y */
  points: Array<{ x: number; y?: number }>;
  /** Provider 名称，用于日志标签（可选） */
  providerName?: string;
}

/**
 * 截图配置选项
 */
export interface ScreenshotOptions {
  /** 图片质量 0-1，默认 1 */
  quality?: number;
  /** 缩放比例，默认 1 */
  scale?: number;
  /** 背景颜色，默认透明 (null) */
  backgroundColor?: string | null;
}

/**
 * 对指定容器进行截图
 * @param containerId - 要截图的容器元素 ID
 * @param options - 截图配置选项
 * @returns 截图结果，包含 base64、canvas 和 dataUrl
 * @throws 如果容器不存在或截图失败则抛出错误
 *
 * @example
 * ```ts
 * // 基本用法
 * const result = await captureScreenshot('my-container');
 * console.log(result.base64);
 *
 * // 自定义配置
 * const result = await captureScreenshot('my-container', {
 *   quality: 0.8,
 *   scale: 2,
 *   backgroundColor: '#ffffff'
 * });
 * ```
 */
export async function captureScreenshot(
  containerId: string,
  options: ScreenshotOptions = {},
): Promise<ScreenshotResult> {
  const { quality = 1, scale = 1, backgroundColor = null } = options;

  // 查找容器元素
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`未找到容器元素: #${containerId}`);
  }

  // 使用 modern-screenshot 进行截图
  const dataUrl = await domToPng(container, {
    quality,
    scale,
    backgroundColor,
    fetch: {
      requestInit: {
        mode: "cors",
      },
    },
  });

  if (!dataUrl) {
    throw new Error("截图失败: modern-screenshot 返回空数据");
  }

  // 提取 base64 数据
  const base64 = dataUrl.split(",")[1];

  // 创建 canvas
  const canvas = await createCanvasFromDataUrl(dataUrl);

  return { base64, canvas, dataUrl };
}

/**
 * 对指定 HTML 元素进行截图
 * @param element - 要截图的 HTML 元素
 * @param options - 截图配置选项
 * @returns 截图结果，包含 base64、canvas 和 dataUrl
 * @throws 如果截图失败则抛出错误
 *
 * @example
 * ```ts
 * const element = document.querySelector('.my-element');
 * if (element) {
 *   const result = await captureElement(element as HTMLElement);
 *   console.log(result.base64);
 * }
 * ```
 */
export async function captureElement(
  element: HTMLElement,
  options: ScreenshotOptions = {},
): Promise<ScreenshotResult> {
  const { quality = 1, scale = 1, backgroundColor = null } = options;

  // 使用 modern-screenshot 进行截图
  const dataUrl = await domToPng(element, {
    quality,
    scale,
    backgroundColor,
    fetch: {
      requestInit: {
        mode: "cors",
      },
    },
  });

  if (!dataUrl) {
    throw new Error("截图失败: modern-screenshot 返回空数据");
  }

  // 提取 base64 数据
  const base64 = dataUrl.split(",")[1];

  // 创建 canvas
  const canvas = await createCanvasFromDataUrl(dataUrl);

  return { base64, canvas, dataUrl };
}

/**
 * 从 Data URL 创建 Canvas 元素
 * @param dataUrl - 图片的 Data URL
 * @returns Canvas 元素
 */
async function createCanvasFromDataUrl(
  dataUrl: string,
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      } else {
        reject(new Error("无法获取 Canvas 2D 上下文"));
      }
    };
    img.onerror = () => reject(new Error("加载图片失败"));
    img.src = dataUrl;
  });
}

/**
 * 在控制台输出截图预览（用于调试）
 * @param result - 截图结果
 * @param maxWidth - 最大显示宽度，默认 400
 * @param maxHeight - 最大显示高度，默认 300
 */
export function logScreenshotPreview(
  result: ScreenshotResult,
  maxWidth: number = 400,
  maxHeight: number = 300,
): void {
  const { canvas, dataUrl } = result;
  const displayWidth = Math.min(canvas.width / 2, maxWidth / 2);
  const displayHeight = Math.min(canvas.height / 2, maxHeight / 2);

  logger.log("截图预览:");
  logger.log(
    "%c ",
    `
    font-size: 1px;
    padding: ${displayHeight}px ${displayWidth}px;
    background: url(${dataUrl}) no-repeat;
    background-size: contain;
  `,
  );
}

/**
 * 在 Canvas 上绘制调试标记并输出到控制台
 * @param canvas - 原始截图的 Canvas
 * @param config - 调试绘制配置
 * @returns 带有调试标记的 Canvas
 *
 * @example
 * ```ts
 * // 绘制竖线（滑块验证码）
 * drawDebugOverlay(canvas, {
 *   type: 'vertical-line',
 *   points: [{ x: 150 }],
 *   providerName: 'TTShitu'
 * });
 *
 * // 绘制点选标记（点选验证码）
 * drawDebugOverlay(canvas, {
 *   type: 'click-points',
 *   points: [{ x: 100, y: 50 }, { x: 200, y: 100 }, { x: 150, y: 200 }],
 *   providerName: 'TTShitu'
 * });
 * ```
 */
export function drawDebugOverlay(
  canvas: HTMLCanvasElement,
  config: DebugDrawConfig,
): HTMLCanvasElement {
  const { type, points, providerName = "Provider" } = config;

  // 创建新的 canvas 来绘制标记（调试用）
  const markedCanvas = document.createElement("canvas");
  markedCanvas.width = canvas.width;
  markedCanvas.height = canvas.height;
  const ctx = markedCanvas.getContext("2d");

  if (!ctx) {
    logger.warn("无法获取 Canvas 2D 上下文，跳过调试绘制");
    return canvas;
  }

  // 先绘制原图
  ctx.drawImage(canvas, 0, 0);

  if (type === "vertical-line") {
    // 绘制竖线模式
    points.forEach((point, index) => {
      const x = point.x;

      // 画红色竖线
      ctx.strokeStyle = "red";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, markedCanvas.height);
      ctx.stroke();

      // 添加坐标标注背景
      const labelY = 5 + index * 25;
      ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
      ctx.fillRect(x + 5, labelY, 60, 18);

      // 添加坐标标注文字
      ctx.fillStyle = "white";
      ctx.font = "bold 12px Arial";
      ctx.fillText(`X=${x}`, x + 10, labelY + 13);
    });
  } else if (type === "click-points") {
    // 绘制点选模式
    points.forEach((point, index) => {
      const x = point.x;
      const y = point.y ?? markedCanvas.height / 2;

      // 画圆点
      ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();

      // 画圆环
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.stroke();

      // 添加序号
      ctx.fillStyle = "white";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${index + 1}`, x, y);

      // 添加坐标标注
      ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
      ctx.fillRect(x + 18, y - 9, 70, 18);
      ctx.fillStyle = "white";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(`(${x},${y})`, x + 22, y + 4);
    });
  }

  // 输出带标记的截图到控制台
  const markedDataUrl = markedCanvas.toDataURL("image/png");
  const typeLabel = type === "vertical-line" ? "竖线" : "点选";
  logger.log(`${providerName}: 识别结果可视化（${typeLabel}标记）:`);
  logger.log(
    "%c ",
    `
    font-size: 1px;
    padding: ${canvas.height / 2}px ${canvas.width / 2}px;
    background: url(${markedDataUrl}) no-repeat;
    background-size: contain;
  `,
  );

  return markedCanvas;
}
