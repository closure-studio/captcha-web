import { useState, useCallback } from 'react';
import { validateGeeTest, type GeeTestValidateResponse } from '../utils/geetest';
import type { GeeTest4ValidateResult, GeeTest4Error } from '../types/geetest4.d.ts';

export interface UseGeeTestV4Options {
  /** 自动验证到服务器 */
  autoValidate?: boolean;
  /** 验证成功回调（前端验证） */
  onFrontendSuccess?: (result: GeeTest4ValidateResult) => void;
  /** 服务器验证成功回调 */
  onServerSuccess?: (response: GeeTestValidateResponse) => void;
  /** 服务器验证失败回调 */
  onServerError?: (error: string) => void;
}

export interface UseGeeTestV4Return {
  /** 前端验证结果 */
  validateResult: GeeTest4ValidateResult | null;
  /** 是否已通过前端验证 */
  isVerified: boolean;
  /** 是否正在进行服务器验证 */
  isValidating: boolean;
  /** 服务器验证结果 */
  serverResult: GeeTestValidateResponse | null;
  /** 服务器验证错误信息 */
  serverError: string | null;
  /** 处理前端验证成功 */
  handleSuccess: (result: GeeTest4ValidateResult) => Promise<void>;
  /** 处理前端验证失败 */
  handleFail: (error: GeeTest4Error) => void;
  /** 处理验证错误 */
  handleError: (error: GeeTest4Error) => void;
  /** 处理验证码准备就绪 */
  handleReady: () => void;
  /** 处理验证码关闭 */
  handleClose: () => void;
  /** 重置状态 */
  reset: () => void;
}

/**
 * GeeTest v4 Hook
 * 封装 GeeTest v4 的状态管理和服务器验证逻辑
 */
export function useGeeTestV4(options: UseGeeTestV4Options = {}): UseGeeTestV4Return {
  const {
    autoValidate = true,
    onFrontendSuccess,
    onServerSuccess,
    onServerError,
  } = options;

  const [validateResult, setValidateResult] = useState<GeeTest4ValidateResult | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [serverResult, setServerResult] = useState<GeeTestValidateResponse | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setValidateResult(null);
    setIsVerified(false);
    setIsValidating(false);
    setServerResult(null);
    setServerError(null);
  }, []);

  const handleSuccess = useCallback(async (result: GeeTest4ValidateResult) => {
    console.log('GeeTest v4 前端验证成功:', result);
    setValidateResult(result);
    setIsVerified(true);
    setServerError(null);
    setServerResult(null);

    onFrontendSuccess?.(result);

    if (autoValidate) {
      setIsValidating(true);

      try {
        const response = await validateGeeTest(result);
        console.log('GeeTest v4 服务器验证结果:', response);
        setServerResult(response);
        
        if (response.result === 'success') {
          onServerSuccess?.(response);
        } else {
          onServerError?.(response.msg || '验证失败');
        }
      } catch (error) {
        console.error('GeeTest v4 服务器验证失败:', error);
        const errorMessage = error instanceof Error ? error.message : '服务器验证失败';
        setServerError(errorMessage);
        onServerError?.(errorMessage);
      } finally {
        setIsValidating(false);
      }
    }
  }, [autoValidate, onFrontendSuccess, onServerSuccess, onServerError]);

  const handleFail = useCallback((error: GeeTest4Error) => {
    console.error('GeeTest v4 验证失败:', error);
    setIsVerified(false);
    setServerResult(null);
    setServerError(null);
  }, []);

  const handleError = useCallback((error: GeeTest4Error) => {
    console.error('GeeTest v4 错误:', error);
  }, []);

  const handleReady = useCallback(() => {
    console.log('GeeTest v4 验证码已准备就绪');
  }, []);

  const handleClose = useCallback(() => {
    console.log('GeeTest v4 验证码已关闭');
  }, []);

  return {
    validateResult,
    isVerified,
    isValidating,
    serverResult,
    serverError,
    handleSuccess,
    handleFail,
    handleError,
    handleReady,
    handleClose,
    reset,
  };
}

export default useGeeTestV4;
