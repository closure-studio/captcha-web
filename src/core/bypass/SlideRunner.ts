import type {
  BypassResult,
  GeeTestSlideBypassContext,
  SlideConfig,
} from "./types";

/**
 * 默认滑动配置
 */
const DEFAULT_CONFIG: SlideConfig = {
  xOffset: -10,
  slideSteps: 30,
  stepDelay: { min: 15, max: 25 },
  debug: true,
};

/**
 * 缓动函数：缓入缓出（三次贝塞尔近似）
 * t=0→0, t=0.5 时加速最大, t=1→1
 */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * 生成拟人化滑动轨迹
 * 特征：缓入缓出速度 + 自然Y轴抖动 + 可选过冲回正
 */
function generateHumanTrack(
  startX: number,
  startY: number,
  endX: number,
  steps: number,
): Array<{ x: number; y: number; delay: number }> {
  const totalDistance = endX - startX;
  const track: Array<{ x: number; y: number; delay: number }> = [];

  // 是否执行过冲回正（70% 概率）
  const doOvershoot = Math.random() < 0.7;
  // 过冲距离：滑动总距离的 2%~5%
  const overshootPx = doOvershoot
    ? totalDistance * (0.02 + Math.random() * 0.03)
    : 0;

  // Y 轴自然抖动参数：使用低频正弦叠加
  const yFreq1 = 0.5 + Math.random() * 0.5; // 主频
  const yFreq2 = 1.5 + Math.random() * 1.0; // 高频扰动
  const yAmp1 = 1.5 + Math.random() * 2.0; // 主幅度 1.5~3.5px
  const yAmp2 = 0.3 + Math.random() * 0.7; // 高频幅度 0.3~1px
  const yPhase1 = Math.random() * Math.PI * 2;
  const yPhase2 = Math.random() * Math.PI * 2;

  // 主滑动阶段步数（过冲前）
  const mainSteps = doOvershoot ? steps - 3 : steps;

  for (let i = 1; i <= mainSteps; i++) {
    const t = i / mainSteps; // 归一化进度 [0,1]

    // 使用缓动函数计算 X 位置（含过冲目标偏移）
    const eased = easeInOutCubic(t);
    const targetWithOvershoot = totalDistance + overshootPx;
    const x = startX + targetWithOvershoot * eased;

    // Y 轴：低频正弦叠加高频扰动 + 少量随机噪声
    const yOffset =
      yAmp1 * Math.sin(yFreq1 * t * Math.PI * 2 + yPhase1) +
      yAmp2 * Math.sin(yFreq2 * t * Math.PI * 2 + yPhase2) +
      (Math.random() - 0.5) * 0.5;
    const y = startY + yOffset;

    // 步间延迟：开头和结尾慢（30~60ms），中间快（8~18ms）
    const speedFactor = 4 * t * (1 - t); // 抛物线：两端=0，中间=1
    const slowDelay = 30 + Math.random() * 30; // 慢速区间
    const fastDelay = 8 + Math.random() * 10; // 快速区间
    const delay = slowDelay + (fastDelay - slowDelay) * speedFactor;

    track.push({ x, y, delay });
  }

  // 过冲回正阶段：3 步从过冲位置回到精确目标
  if (doOvershoot) {
    const overshootX = startX + totalDistance + overshootPx;
    const corrections = [0.6, 0.85, 1.0]; // 逐步回正比例
    for (const ratio of corrections) {
      const x = overshootX - overshootPx * ratio;
      const y = startY + (Math.random() - 0.5) * 0.8;
      const delay = 25 + Math.random() * 35; // 回正时放慢
      track.push({ x, y, delay });
    }
  }

  return track;
}

/**
 * 通用滑动执行器
 * 消除 TTShituSlide 和 GeminiSlide 中的重复滑动代码
 */
export class SlideRunner {
  private config: SlideConfig;

  constructor(config?: Partial<SlideConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 执行 GeeTest 滑块 bypass
   * @param context bypass 上下文
   * @param targetX 识别返回的目标 X 坐标（基于 canvas）
   */
  async execute(
    context: GeeTestSlideBypassContext,
    targetX: number,
  ): Promise<BypassResult> {
    try {
      const { sliderBtn, sliceElement, captchaWindow, canvasWidth } = context;

      // 获取滑块按钮的位置
      const btnRect = sliderBtn.getBoundingClientRect();
      const startX = btnRect.left - btnRect.width;
      const startY = btnRect.top + btnRect.height / 2;

      // 获取拼图块和验证码窗口的位置信息
      const sliceRect = sliceElement.getBoundingClientRect();
      const windowRect = captchaWindow.getBoundingClientRect();

      // 计算缩放比例：canvas 截图尺寸 vs 实际 DOM 元素尺寸
      const scaleFactor = windowRect.width / canvasWidth;

      // 将 canvas 坐标转换为实际 DOM 坐标
      const scaledTargetX = targetX * scaleFactor;

      // 计算拼图块当前在验证码图片中的相对x位置
      const sliceStartX = sliceRect.left - windowRect.left;

      // 计算需要滑动的距离（包含偏移量校正）
      const slideDistance = scaledTargetX - sliceStartX + this.config.xOffset;

      // 最终的鼠标目标位置
      const endX = startX + slideDistance;

      // 执行滑动
      await this.performSlide(sliderBtn, startX, startY, endX, startY);

      return { success: true, message: "Slide bypass completed" };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 拟人化滑动操作
   */
  private async performSlide(
    sliderBtn: HTMLElement,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): Promise<void> {
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

    // 1. 鼠标/触摸按下
    sliderBtn.dispatchEvent(createMouseEvent("mousedown", startX, startY));
    sliderBtn.dispatchEvent(createTouchEvent("touchstart", startX, startY));

    // 2. 按下后短暂停顿（模拟人类反应时间 80~200ms）
    await new Promise((resolve) =>
      setTimeout(resolve, 80 + Math.random() * 120),
    );

    // 3. 生成拟人化轨迹并逐步执行
    const track = generateHumanTrack(
      startX,
      startY,
      endX,
      this.config.slideSteps,
    );

    for (const point of track) {
      await new Promise((resolve) => setTimeout(resolve, point.delay));

      sliderBtn.dispatchEvent(
        createMouseEvent("mousemove", point.x, point.y),
      );
      sliderBtn.dispatchEvent(
        createTouchEvent("touchmove", point.x, point.y),
      );
      document.dispatchEvent(
        createMouseEvent("mousemove", point.x, point.y),
      );
    }

    // 4. 到达终点后短暂停顿再松手（50~150ms）
    await new Promise((resolve) =>
      setTimeout(resolve, 50 + Math.random() * 100),
    );

    // 5. 鼠标/触摸松开
    sliderBtn.dispatchEvent(createMouseEvent("mouseup", endX, endY));
    sliderBtn.dispatchEvent(createTouchEvent("touchend", endX, endY));
    document.dispatchEvent(createMouseEvent("mouseup", endX, endY));
  }
}
