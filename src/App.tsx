import { useState, useCallback } from "react";
import "./App.css";
import { GeeTestCaptcha } from "./components/GeeTestCaptcha";
import type { GeeTest4ValidateResult, GeeTest4Error } from "./types/geetest4.d.ts";

// 从环境变量获取 captchaId，或使用默认值
const CAPTCHA_ID = import.meta.env.VITE_GEETEST_CAPTCHA_ID || "your-captcha-id";

function App() {
  const [validateResult, setValidateResult] = useState<GeeTest4ValidateResult | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  // 验证成功回调
  const handleSuccess = useCallback((result: GeeTest4ValidateResult) => {
    console.log("GeeTest 验证成功:", result);
    setValidateResult(result);
    setIsVerified(true);
    
    // 这里可以将验证结果发送到后端进行二次验证
    // validateGeeTest(result).then(response => {
    //   console.log('后端验证结果:', response);
    // });
  }, []);

  // 验证失败回调
  const handleFail = useCallback((error: GeeTest4Error) => {
    console.error("GeeTest 验证失败:", error);
    setIsVerified(false);
  }, []);

  // 验证错误回调
  const handleError = useCallback((error: GeeTest4Error) => {
    console.error("GeeTest 错误:", error);
  }, []);

  // 验证码准备就绪回调
  const handleReady = useCallback(() => {
    console.log("GeeTest 验证码已准备就绪");
  }, []);

  // 验证码关闭回调
  const handleClose = useCallback(() => {
    console.log("GeeTest 验证码已关闭");
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
          GeeTest v4 验证码示例
        </h1>

        <div className="mb-6">
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

        {isVerified && validateResult && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h2 className="text-lg font-semibold text-green-800 mb-2">
              ✓ 验证成功
            </h2>
            <div className="text-sm text-gray-600 space-y-1">
              <p>
                <span className="font-medium">Lot Number:</span>{" "}
                <code className="bg-gray-100 px-1 rounded text-xs break-all">
                  {validateResult.lot_number}
                </code>
              </p>
              <p>
                <span className="font-medium">Gen Time:</span>{" "}
                <code className="bg-gray-100 px-1 rounded text-xs">
                  {validateResult.gen_time}
                </code>
              </p>
              <p>
                <span className="font-medium">Pass Token:</span>{" "}
                <code className="bg-gray-100 px-1 rounded text-xs break-all">
                  {validateResult.pass_token.substring(0, 20)}...
                </code>
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>请在 <code className="bg-gray-100 px-1 rounded">.env</code> 文件中配置</p>
          <p className="mt-1">
            <code className="bg-gray-100 px-2 py-1 rounded">
              VITE_GEETEST_CAPTCHA_ID=your-captcha-id
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
