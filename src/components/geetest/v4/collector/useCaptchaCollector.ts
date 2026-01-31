import { useRef, useCallback, useMemo } from "react";
import type { CaptchaCollector } from "../../../../utils/captcha/type/provider";

// Re-export for convenience
export type { CaptchaCollector };

/**
 * 完整的 Collector 接口，包含 React 组件需要的额外方法
 */
export interface FullCaptchaCollector extends CaptchaCollector {
  getArgs: () => { captures: Record<string, string>; metadata: Record<string, unknown> };
  reset: () => void;
}

export function useCaptchaCollector(): FullCaptchaCollector {
  const capturesRef = useRef<Record<string, string>>({});
  const metadataRef = useRef<Record<string, unknown>>({});

  const addCapture = useCallback((name: string, base64: string) => {
    capturesRef.current[name] = base64;
  }, []);

  const setMetadata = useCallback((key: string, value: unknown) => {
    metadataRef.current[key] = value;
  }, []);

  const getArgs = useCallback(() => ({
    captures: { ...capturesRef.current },
    metadata: { ...metadataRef.current },
  }), []);

  const reset = useCallback(() => {
    capturesRef.current = {};
    metadataRef.current = {};
  }, []);

  return useMemo(
    () => ({ addCapture, setMetadata, getArgs, reset }),
    [addCapture, setMetadata, getArgs, reset]
  );
}
