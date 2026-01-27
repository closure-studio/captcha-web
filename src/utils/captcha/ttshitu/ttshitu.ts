import {
  CaptchaSolveCode,
  CaptchaType,
  ProviderNames,
  type BypassResult,
  type CaptchaPoint,
  type CaptchaReportErrorResult,
  type CaptchaSolveRequest,
  type CaptchaSolveResult,
  type GeeTestClickBypassContext,
  type GeeTestSlideBypassContext,
  type ICaptchaProvider,
} from "../type/provider";
import { TTShituClient, TTShituTypeId, type TTShituOptions } from "./client";
import {
  TTShituSlideBypass,
  type TTShituSlideBypassConfig,
} from "./slide";
import { createModuleLogger } from "../../../utils/logger";

const logger = createModuleLogger("TTShitu");

/**
 * TTShitu 验证码提供者配置
 */
export interface TTShituCaptchaProviderOptions extends TTShituOptions {
  /** 滑块 bypass 配置 */
  slideBypassConfig?: TTShituSlideBypassConfig;
}

/**
 * TTShitu 验证码提供者
 */
export class TTShituCaptchaProvider implements ICaptchaProvider {
  readonly name = ProviderNames.TTSHITU;
  private client: TTShituClient;
  private lastResultId: string = "";
  private slideBypass: TTShituSlideBypass;

  constructor(options?: TTShituCaptchaProviderOptions) {
    this.client = new TTShituClient(options);
    this.slideBypass = new TTShituSlideBypass(options?.slideBypassConfig);
  }

  async solve(request: CaptchaSolveRequest): Promise<CaptchaSolveResult> {
    try {
      let result: { result: string; id: string };
      let points: CaptchaPoint[];

      if (request.type === CaptchaType.SLIDE) {
        // 滑块验证码
        result = await this.client.predict(
          request.image,
          TTShituTypeId.GAP_SINGLE_X,
        );
        const x = parseInt(result.result, 10);
        if (isNaN(x)) {
          throw new Error(`Invalid slide result: ${result.result}`);
        }
        points = [{ x, y: 0 }];
      } else {
        // 点选验证码 - 默认使用 CLICK_3_5
        result = await this.client.predict(
          request.image,
          TTShituTypeId.CLICK_3_5,
        );
        // TTShitu 点选返回格式: "x1,y1|x2,y2|x3,y3"
        points = this.parseClickPoints(result.result);
      }

      this.lastResultId = result.id;

      return {
        message: "success",
        code: CaptchaSolveCode.SUCCESS,
        data: {
          captchaId: result.id,
          points,
        },
      };
    } catch (error) {
      return {
        message: error instanceof Error ? error.message : "Unknown error",
        code: CaptchaSolveCode.FAILED,
        data: {
          captchaId: "",
          points: [],
        },
      };
    }
  }

  /**
   * 解析 TTShitu 点选结果
   * @param result 格式: "x1,y1|x2,y2|x3,y3"
   */
  private parseClickPoints(result: string): CaptchaPoint[] {
    return result.split("|").map((point) => {
      const [x, y] = point.split(",").map((v) => parseFloat(v.trim()));
      return { x: x || 0, y: y || 0 };
    });
  }

  async reportError(captchaId: string): Promise<CaptchaReportErrorResult> {
    try {
      const result = await this.client.reportError(
        captchaId || this.lastResultId,
      );
      return {
        success: true,
        message: result.result,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 执行 GeeTest 滑块验证码 bypass
   * 委托给 TTShituSlideBypass 处理
   */
  async bypassGeeTestSlide(
    context: GeeTestSlideBypassContext,
    solveResult: CaptchaSolveResult,
  ): Promise<BypassResult> {
    return this.slideBypass.execute(context, solveResult);
  }

  /**
   * 执行 GeeTest 点选验证码 bypass
   * TTShitu 返回的坐标是基于截图 canvas 的，需要转换为实际 DOM 坐标
   */
  async bypassGeeTestClick(
    context: GeeTestClickBypassContext,
    solveResult: CaptchaSolveResult,
  ): Promise<BypassResult> {
    try {
      const { captchaWindow, canvasWidth, canvasHeight } = context;

      if (solveResult.data.points.length === 0) {
        return {
          success: false,
          message: "No points in solve result",
        };
      }

      const windowRect = captchaWindow.getBoundingClientRect();

      // 计算缩放比例
      const scaleFactorX = windowRect.width / canvasWidth;
      const scaleFactorY = windowRect.height / canvasHeight;

      // 点击每个坐标点
      for (const point of solveResult.data.points) {
        // 将 canvas 坐标转换为实际 DOM 坐标
        const scaledX = point.x * scaleFactorX;
        const scaledY = point.y * scaleFactorY;

        // 计算在屏幕上的绝对坐标
        const clickX = windowRect.left + scaledX;
        const clickY = windowRect.top + scaledY;

        logger.log("点击坐标:", {
          original: point,
          scaled: { x: scaledX, y: scaledY },
          screen: { x: clickX, y: clickY },
        });

        // 执行点击
        await this.performClick(captchaWindow, clickX, clickY);

        // 等待一段时间再点击下一个
        await new Promise((resolve) =>
          setTimeout(resolve, 200 + Math.random() * 100),
        );
      }

      return {
        success: true,
        message: "Click bypass completed",
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 执行点击操作
   */
  private async performClick(
    target: HTMLElement,
    x: number,
    y: number,
  ): Promise<void> {
    const eventOptions = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
      button: 0,
    };

    target.dispatchEvent(new MouseEvent("mousedown", eventOptions));
    await new Promise((resolve) => setTimeout(resolve, 50));
    target.dispatchEvent(new MouseEvent("mouseup", eventOptions));
    target.dispatchEvent(new MouseEvent("click", eventOptions));
  }
}
