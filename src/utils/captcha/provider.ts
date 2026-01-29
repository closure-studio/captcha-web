import type { CaptchaInfo } from "../../types/type";
import { AegirGeetestWordProvider } from "./aegir/word/aegirWord";
import type { AegirOptions } from "./aegir/word/client";
import type { TTShituOptions } from "./ttshitu/client";
import { TTShituCaptchaProvider } from "./ttshitu/ttshitu";
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
  static createAegir(
    captchaInfo: CaptchaInfo,
    options: AegirOptions,
  ): AegirGeetestWordProvider {
    const provider = new AegirGeetestWordProvider(captchaInfo, options);
    this.register(provider);
    return provider;
  }

  /**
   * 创建 TTShitu 提供者
   */
  static createTTShitu(
    captchaInfo: CaptchaInfo,
    options: TTShituOptions,
  ): TTShituCaptchaProvider {
    const provider = new TTShituCaptchaProvider(options, captchaInfo);
    this.register(provider);
    return provider;
  }
}
