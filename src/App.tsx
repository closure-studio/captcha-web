import "./App.css";
import { GeeTestV4Captcha } from "./components/GeeTestV4Captcha";

const CAPTCHA_ID = import.meta.env.VITE_GEETEST_CAPTCHA_ID || "your-captcha-id";

function App() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <GeeTestV4Captcha
        captchaId={CAPTCHA_ID}
        title="人机验证"
        subtitle="请完成验证以继续"
        product="float"
        autoShow={true}
        autoValidate={true}
        enableCaptchaSonic={true}
        showDetails={true}
        onCaptchaSonicSuccess={(answers) => {
          console.log("TTShitu 识别成功, X坐标:", answers);
        }}
        onCaptchaSonicError={(error) => {
          console.error("TTShitu 识别失败:", error);
        }}
        onServerSuccess={(response) => {
          console.log("验证成功，可以执行后续操作", response);
        }}
        onServerError={(error) => {
          console.error("验证失败:", error);
        }}
      />
    </div>
  );
}

export default App;
