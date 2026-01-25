import { useRef, useCallback } from 'react';
import type { GeeTest4Instance } from '../types/geetest4.d.ts';

/**
 * GeeTest Captcha Hook
 * 用于更灵活地控制验证码实例
 */
export function useGeeTestCaptcha() {
  const captchaRef = useRef<GeeTest4Instance | null>(null);

  const setCaptchaRef = useCallback((instance: GeeTest4Instance | null) => {
    captchaRef.current = instance;
  }, []);

  const reset = useCallback(() => {
    captchaRef.current?.reset();
  }, []);

  const showCaptcha = useCallback(() => {
    captchaRef.current?.showCaptcha();
  }, []);

  const getValidate = useCallback(() => {
    return captchaRef.current?.getValidate() || false;
  }, []);

  const destroy = useCallback(() => {
    captchaRef.current?.destroy();
    captchaRef.current = null;
  }, []);

  return {
    setCaptchaRef,
    reset,
    showCaptcha,
    getValidate,
    destroy,
  };
}
