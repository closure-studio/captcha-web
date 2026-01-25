import { useEffect, useRef, useCallback, useState } from 'react';
import type { GeeTest4Instance, GeeTest4Config, GeeTest4ValidateResult, GeeTest4Error } from '../types/geetest4.d.ts';

// GeeTest v4 CDN URL
const GEETEST4_JS_URL = 'https://static.geetest.com/v4/gt4.js';

export interface GeeTestCaptchaProps {
  /** GeeTest captchaId */
  captchaId: string;
  /** 验证成功回调 */
  onSuccess?: (result: GeeTest4ValidateResult) => void;
  /** 验证失败回调 */
  onFail?: (error: GeeTest4Error) => void;
  /** 验证错误回调 */
  onError?: (error: GeeTest4Error) => void;
  /** 验证码准备就绪回调 */
  onReady?: () => void;
  /** 验证码关闭回调 */
  onClose?: () => void;
  /** 产品形式 */
  product?: 'popup' | 'float' | 'bind';
  /** 语言 */
  language?: string;
  /** 自定义样式类名 */
  className?: string;
  /** 容器 ID */
  containerId?: string;
}

/**
 * 动态加载 GeeTest v4 SDK
 */
function loadGeeTestScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // 如果已经加载过，直接返回
    if (typeof window.initGeetest4 === 'function') {
      resolve();
      return;
    }

    // 检查是否已经有脚本在加载中
    const existingScript = document.querySelector(`script[src="${GEETEST4_JS_URL}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Failed to load GeeTest SDK')));
      return;
    }

    const script = document.createElement('script');
    script.src = GEETEST4_JS_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load GeeTest SDK'));
    document.head.appendChild(script);
  });
}

/**
 * GeeTest v4 验证码组件
 */
export function GeeTestCaptcha({
  captchaId,
  onSuccess,
  onFail,
  onError,
  onReady,
  onClose,
  product = 'popup',
  language = 'zh-cn',
  className = '',
  containerId = 'geetest-captcha',
}: GeeTestCaptchaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const captchaRef = useRef<GeeTest4Instance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 处理验证成功
  const handleSuccess = useCallback(() => {
    if (captchaRef.current) {
      const result = captchaRef.current.getValidate();
      if (result && onSuccess) {
        onSuccess(result);
      }
    }
  }, [onSuccess]);

  // 处理验证失败
  const handleFail = useCallback((err: GeeTest4Error) => {
    console.error('GeeTest validation failed:', err);
    onFail?.(err);
  }, [onFail]);

  // 处理错误
  const handleError = useCallback((err: GeeTest4Error) => {
    console.error('GeeTest error:', err);
    setError(err.msg || 'Unknown error');
    onError?.(err);
  }, [onError]);

  // 处理准备就绪
  const handleReady = useCallback(() => {
    setIsLoading(false);
    onReady?.();
  }, [onReady]);

  // 处理关闭
  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // 初始化验证码
  useEffect(() => {
    let isMounted = true;

    const initCaptcha = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 加载 GeeTest SDK
        await loadGeeTestScript();

        if (!isMounted || !containerRef.current) return;

        // 检查 initGeetest4 是否可用
        if (typeof window.initGeetest4 !== 'function') {
          throw new Error('GeeTest SDK not loaded properly');
        }

        // 初始化验证码配置
        const config: GeeTest4Config = {
          captchaId,
          product,
          language,
          onError: handleError,
        };

        // 初始化 GeeTest
        window.initGeetest4(config, (captcha) => {
          if (!isMounted) {
            captcha.destroy();
            return;
          }

          captchaRef.current = captcha;

          // 绑定事件
          captcha
            .onReady(handleReady)
            .onSuccess(handleSuccess)
            .onFail(handleFail)
            .onError(handleError)
            .onClose(handleClose);

          // 将验证码附加到容器
          captcha.appendTo(`#${containerId}`);
        });
      } catch (err) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to initialize GeeTest';
          setError(errorMessage);
          setIsLoading(false);
          console.error('GeeTest initialization error:', err);
        }
      }
    };

    initCaptcha();

    // 清理函数
    return () => {
      isMounted = false;
      if (captchaRef.current) {
        captchaRef.current.destroy();
        captchaRef.current = null;
      }
    };
  }, [captchaId, product, language, containerId, handleSuccess, handleFail, handleError, handleReady, handleClose]);

  return (
    <div className={`geetest-captcha-wrapper ${className}`}>
      {isLoading && (
        <div className="flex items-center justify-center p-4 text-gray-500">
          <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>加载验证码中...</span>
        </div>
      )}
      {error && (
        <div className="text-red-500 p-4 text-center">
          <p>验证码加载失败: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            重新加载
          </button>
        </div>
      )}
      <div
        id={containerId}
        ref={containerRef}
        className={isLoading || error ? 'hidden' : ''}
      />
    </div>
  );
}

export default GeeTestCaptcha;
