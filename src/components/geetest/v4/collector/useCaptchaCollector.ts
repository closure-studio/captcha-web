import { useRef, useCallback, useMemo } from "react";

export interface CaptchaCollector {
  addCapture: (name: string, base64: string) => void;
  setMetadata: (key: string, value: unknown) => void;
  getArgs: () => { captures: Record<string, string>; metadata: Record<string, unknown> };
  reset: () => void;
}

export function useCaptchaCollector(): CaptchaCollector {
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
