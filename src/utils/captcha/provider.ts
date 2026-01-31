import type { CaptchaInfo } from "../../types/type";
import { AegirGeetestWordProvider } from "./aegir/word/aegirWord";
import type { AegirOptions } from "./aegir/word/client";
import { GeminiSlide } from "./gemini/geminiSlide";
import type { TTShituOptions } from "./ttshitu/client";
import { TTShituSlide } from "./ttshitu/ttshituSlide";
import { TTShituWorld } from "./ttshitu/ttshituWorld";
import type { ICaptchaProvider } from "./type/provider";

/**
 * 验证码提供者工厂
 */
export class CaptchaProviderFactory {
  private static providers: Map<string, ICaptchaProvider> = new Map();

  /**
   * 注册提供者
   */
  static register(provider: ICaptchaProvider): void {
    this.providers.set(provider.name.toLowerCase(), provider);
  }

  /**
   * 获取提供者
   */
  static get(name: string): ICaptchaProvider | undefined {
    return this.providers.get(name.toLowerCase());
  }

  /**
   * 获取所有提供者名称
   */
  static getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * 创建 Aegir 提供者
   */
  static createAegirWord(
    captchaInfo: CaptchaInfo,
    options: AegirOptions,
  ): AegirGeetestWordProvider {
    const provider = new AegirGeetestWordProvider(captchaInfo, options);
    this.register(provider);
    return provider;
  }

  static createTTShituSlider(
    captchaInfo: CaptchaInfo,
    options: TTShituOptions,
  ): TTShituSlide {
    const provider = new TTShituSlide(captchaInfo, options);
    this.register(provider);
    return provider;
  }

  static createTTShituWorld(
    captchaInfo: CaptchaInfo,
    options: TTShituOptions,
  ): TTShituWorld {
    const provider = new TTShituWorld(captchaInfo, options);
    this.register(provider);
    return provider;
  }

  static createGeminiSlider(
    captchaInfo: CaptchaInfo,
    options: TTShituOptions,
  ): GeminiSlide {
    const provider = new GeminiSlide(captchaInfo, options);
    this.register(provider);
    return provider;
  }
}
