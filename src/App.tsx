import "./App.css";
import { GeeTestV4Captcha } from "./components/GeeTestV4Captcha";

const CAPTCHA_ID = import.meta.env.VITE_GEETEST_CAPTCHA_ID || "your-captcha-id";

function App() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <GeeTestV4Captcha
        captchaId={CAPTCHA_ID}
        onComplete={(response) => {
          console.log("验证完成:", response);
        }}
      />
    </div>
  );
}

export default App;
