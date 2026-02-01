import type { IRecognizer } from "./recognizers";
import type { ISolveStrategy } from "./strategies";

/**
 * 验证码注册表
 * 替代工厂方法，支持动态注册
 */
class CaptchaRegistry {
  private recognizers = new Map<string, IRecognizer>();
  private strategies = new Map<string, ISolveStrategy>();

  /**
   * 注册识别器
   */
  registerRecognizer(name: string, recognizer: IRecognizer): void {
    this.recognizers.set(name.toLowerCase(), recognizer);
  }

  /**
   * 获取识别器
   */
  getRecognizer(name: string): IRecognizer | undefined {
    return this.recognizers.get(name.toLowerCase());
  }

  /**
   * 获取所有识别器名称
   */
  getRecognizerNames(): string[] {
    return Array.from(this.recognizers.keys());
  }

  /**
   * 注册策略
   */
  registerStrategy(type: string, strategy: ISolveStrategy): void {
    this.strategies.set(type.toLowerCase(), strategy);
  }

  /**
   * 获取策略
   */
  getStrategy(type: string): ISolveStrategy | undefined {
    return this.strategies.get(type.toLowerCase());
  }

  /**
   * 获取所有策略类型
   */
  getStrategyTypes(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * 清除所有注册
   */
  clear(): void {
    this.recognizers.clear();
    this.strategies.clear();
  }
}

export const registry = new CaptchaRegistry();
export { CaptchaRegistry };
