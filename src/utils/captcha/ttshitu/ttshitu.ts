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

/**
 * TTShitu 验证码提供者
 */
export class TTShituCaptchaProvider implements ICaptchaProvider {
  readonly name = ProviderNames.TTSHITU;
  private client: TTShituClient;
  private lastResultId: string = "";

  // TTShitu 特有的偏移量校正值
  private static readonly SLIDE_X_OFFSET = -10;

  constructor(options?: TTShituOptions) {
    this.client = new TTShituClient(options);
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
   * TTShitu 返回的坐标是基于截图 canvas 的，需要转换为实际 DOM 坐标
   */
  async bypassGeeTestSlide(
    context: GeeTestSlideBypassContext,
    solveResult: CaptchaSolveResult,
  ): Promise<BypassResult> {
    try {
      const { sliderBtn, sliceElement, captchaWindow, canvasWidth } = context;

      if (solveResult.data.points.length === 0) {
        return {
          success: false,
          message: "No points in solve result",
        };
      }

      const targetX = solveResult.data.points[0].x;

      // 获取滑块按钮的位置（相对于容器内部计算）
      const btnRect = sliderBtn.getBoundingClientRect();
      const startX = btnRect.left - btnRect.width;
      const startY = btnRect.top + btnRect.height / 2;

      // 获取拼图块和验证码窗口的位置信息
      const sliceRect = sliceElement.getBoundingClientRect();
      const windowRect = captchaWindow.getBoundingClientRect();

      // 计算缩放比例：canvas 截图尺寸 vs 实际 DOM 元素尺寸
      const scaleFactor = windowRect.width / canvasWidth;

      // 将 TTShitu 返回的 targetX（基于 canvas 坐标）转换为实际 DOM 坐标
      const scaledTargetX = targetX * scaleFactor;

      // 计算拼图块当前在验证码图片中的相对x位置
      const sliceStartX = sliceRect.left - windowRect.left;

      // 计算需要滑动的距离（包含 TTShitu 特有的偏移量校正）
      const slideDistance =
        scaledTargetX - sliceStartX + TTShituCaptchaProvider.SLIDE_X_OFFSET;

      // 最终的鼠标目标位置
      const endX = startX + slideDistance;
      const endY = startY;

      // 调试信息
      console.log("TTShitu: ========== 滑动调试信息 ==========");
      console.log("TTShitu: 识别返回的 targetX (canvas坐标):", targetX);
      console.log("TTShitu: Canvas 宽度:", canvasWidth);
      console.log("TTShitu: 验证码窗口 DOM 宽度:", windowRect.width);
      console.log("TTShitu: 缩放比例 (DOM/Canvas):", scaleFactor);
      console.log("TTShitu: 缩放后的 targetX (DOM坐标):", scaledTargetX);
      console.log(
        "TTShitu: X 偏移量校正:",
        TTShituCaptchaProvider.SLIDE_X_OFFSET,
      );
      console.log("TTShitu: 拼图块当前位置:", {
        left: sliceRect.left,
        relativeLeft: sliceStartX,
        width: sliceRect.width,
      });
      console.log("TTShitu: 滑动计算:", {
        sliceStartX,
        scaledTargetX,
        slideDistance,
        startX,
        endX,
      });
      console.log("TTShitu: =====================================");

      // 执行滑动
      await this.performSlide(sliderBtn, startX, startY, endX, endY);

      return {
        success: true,
        message: "Slide bypass completed",
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 执行滑动操作
   */
  private async performSlide(
    sliderBtn: HTMLElement,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): Promise<void> {
    // 创建鼠标事件
    const createMouseEvent = (type: string, x: number, y: number) => {
      return new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        button: 0,
        buttons: type === "mouseup" ? 0 : 1,
      });
    };

    // 创建 Touch 事件（用于支持移动端）
    const createTouchEvent = (type: string, x: number, y: number) => {
      const touch = new Touch({
        identifier: Date.now(),
        target: sliderBtn,
        clientX: x,
        clientY: y,
        pageX: x + window.scrollX,
        pageY: y + window.scrollY,
        screenX: x,
        screenY: y,
      });
      return new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        touches: type === "touchend" ? [] : [touch],
        targetTouches: type === "touchend" ? [] : [touch],
        changedTouches: [touch],
      });
    };

    // 模拟拖动过程
    // 1. 鼠标/触摸按下
    sliderBtn.dispatchEvent(createMouseEvent("mousedown", startX, startY));
    sliderBtn.dispatchEvent(createTouchEvent("touchstart", startX, startY));

    // 2. 逐步移动（模拟人类滑动）
    const steps = 30;
    const deltaX = (endX - startX) / steps;

    for (let i = 1; i <= steps; i++) {
      const currentX = startX + deltaX * i;
      // 添加随机偏移模拟人类行为
      const randomY = startY + (Math.random() - 0.5) * 2;

      await new Promise((resolve) =>
        setTimeout(resolve, 15 + Math.random() * 10),
      );

      sliderBtn.dispatchEvent(createMouseEvent("mousemove", currentX, randomY));
      sliderBtn.dispatchEvent(createTouchEvent("touchmove", currentX, randomY));
      document.dispatchEvent(createMouseEvent("mousemove", currentX, randomY));
    }

    // 3. 最后一次移动到准确位置
    await new Promise((resolve) => setTimeout(resolve, 50));
    sliderBtn.dispatchEvent(createMouseEvent("mousemove", endX, endY));
    sliderBtn.dispatchEvent(createTouchEvent("touchmove", endX, endY));
    document.dispatchEvent(createMouseEvent("mousemove", endX, endY));

    // 4. 鼠标/触摸松开
    await new Promise((resolve) => setTimeout(resolve, 100));
    sliderBtn.dispatchEvent(createMouseEvent("mouseup", endX, endY));
    sliderBtn.dispatchEvent(createTouchEvent("touchend", endX, endY));
    document.dispatchEvent(createMouseEvent("mouseup", endX, endY));
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

        console.log("TTShitu: 点击坐标:", {
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
