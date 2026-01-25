import { useState, useCallback } from "react";
import "./App.css";
import { GeeTestCaptcha } from "./components/GeeTestCaptcha";
import { validateGeeTest, type GeeTestValidateResponse } from "./utils/geetest";
import type { GeeTest4ValidateResult, GeeTest4Error } from "./types/geetest4.d.ts";

const CAPTCHA_ID = import.meta.env.VITE_GEETEST_CAPTCHA_ID || "your-captcha-id";

function App() {
  const [validateResult, setValidateResult] = useState<GeeTest4ValidateResult | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [serverResult, setServerResult] = useState<GeeTestValidateResponse | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleSuccess = useCallback(async (result: GeeTest4ValidateResult) => {
    console.log("GeeTest 前端验证成功:", result);
    setValidateResult(result);
    setIsVerified(true);
    setIsValidating(true);
    setServerError(null);
    setServerResult(null);

    try {
      const response = await validateGeeTest(result);
      console.log("后端验证结果:", response);
      setServerResult(response);
    } catch (error) {
      console.error("后端验证失败:", error);
      const errorMessage = error instanceof Error ? error.message : "服务器验证失败";
      setServerError(errorMessage);
    } finally {
      setIsValidating(false);
    }
  }, []);

  const handleFail = useCallback((error: GeeTest4Error) => {
    console.error("GeeTest 验证失败:", error);
    setIsVerified(false);
    setServerResult(null);
    setServerError(null);
  }, []);

  const handleError = useCallback((error: GeeTest4Error) => {
    console.error("GeeTest 错误:", error);
  }, []);

  const handleReady = useCallback(() => {
    console.log("GeeTest 验证码已准备就绪");
  }, []);

  const handleClose = useCallback(() => {
    console.log("GeeTest 验证码已关闭");
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* 卡片 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* 头部 */}
          <div className="px-6 py-5 border-b border-slate-100">
            <h1 className="text-lg font-semibold text-slate-800">人机验证</h1>
            <p className="text-sm text-slate-500 mt-1">请完成验证以继续</p>
          </div>

          {/* 验证码区域 */}
          <div className="p-6">
            <GeeTestCaptcha
              captchaId={CAPTCHA_ID}
              onSuccess={handleSuccess}
              onFail={handleFail}
              onError={handleError}
              onReady={handleReady}
              onClose={handleClose}
              product="popup"
              language="zh-cn"
              className="flex justify-center"
            />
          </div>

          {/* 状态区域 */}
          <div className="px-6 pb-6 space-y-3">
            {/* 验证中 */}
            {isValidating && (
              <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-amber-700">正在验证...</span>
              </div>
            )}

            {/* 验证成功 */}
            {serverResult?.result === "success" && (
              <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg">
                <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-emerald-700">{serverResult.msg || "验证成功"}</span>
              </div>
            )}

            {/* 验证失败 */}
            {serverResult && serverResult.result !== "success" && (
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-red-700">{serverResult.msg || "验证失败"}</span>
              </div>
            )}

            {/* 请求错误 */}
            {serverError && (
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-red-700">{serverError}</span>
              </div>
            )}
          </div>

          {/* 验证详情 */}
          {isVerified && validateResult && !isValidating && (
            <div className="px-6 pb-6">
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer text-sm text-slate-600 hover:text-slate-800">
                  <span>查看验证详情</span>
                  <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="mt-3 p-3 bg-slate-50 rounded-lg text-xs font-mono space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">lot_number</span>
                    <span className="text-slate-700 truncate max-w-[160px]">{validateResult.lot_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">gen_time</span>
                    <span className="text-slate-700">{validateResult.gen_time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">pass_token</span>
                    <span className="text-slate-700 truncate max-w-[160px]">{validateResult.pass_token.substring(0, 20)}...</span>
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>

        {/* 底部 */}
        <p className="text-center text-xs text-slate-400 mt-4">
          Powered by GeeTest v4
        </p>
      </div>
    </div>
  );
}

export default App;
