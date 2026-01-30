import { useEffect, useRef, useState } from "react";
import "./App.css";
import { MyCaptchaSolver } from "./components/captcha";
import type { CaptchaInfo } from "./types/type";
import { generateContainerId } from "./utils";

function App() {
  const [challengeList, setChallengeList] = useState<CaptchaInfo[]>([
    // {
    //   containerId: generateContainerId(),
    //   challenge: "1",
    //   geetestId: CAPTCHA_ID,
    //   provider: "geetest_v4",
    //   type: "slide",
    // },
    {
      containerId: generateContainerId(),
      challenge: "122ca1ba-0101-4b26-9842-63c0a1424cc2",
      geetestId: "54088bb07d2df3c46b79f80300b0abbe",
      provider: "geetest_v4",
      riskType: "word",
      type: "word",
    },
  ]);

  // 用 useRef 持久化定时器映射
  const timeoutMap = useRef(new Map<string, number>());

  // 添加 challenge 时设置超时
  const addChallengeWithTimeout = (containerId: string) => {
    // 避免重复添加
    if (timeoutMap.current.has(containerId)) return;
    const timeout = window.setTimeout(
      () => {
        setChallengeList((prev) =>
          prev.filter((item) => item.containerId !== containerId),
        );
        timeoutMap.current.delete(containerId);
      },
      2 * 60 * 1000,
    );
    timeoutMap.current.set(containerId, timeout);
  };

  // 完成时移除 challenge
  const handleComplete = (containerId: string) => () => {
    setChallengeList((prev) =>
      prev.filter((item) => item.containerId !== containerId),
    );
    const timeout = timeoutMap.current.get(containerId);
    if (timeout) {
      clearTimeout(timeout);
      timeoutMap.current.delete(containerId);
    }
  };

  // 监听 challengeList 变化，为新增的 challenge 设置超时
  useEffect(() => {
    challengeList.forEach((item) => {
      addChallengeWithTimeout(item.containerId);
    });
    // 清理已被移除 challenge 的定时器
    timeoutMap.current.forEach((timeout, key) => {
      if (!challengeList.some((item) => item.containerId === key)) {
        clearTimeout(timeout);
        timeoutMap.current.delete(key);
      }
    });
  }, [challengeList]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="flex flex-col gap-6">
        {challengeList.map((captchaInfo) => (
          <MyCaptchaSolver
            key={captchaInfo.containerId}
            captchaInfo={captchaInfo}
            handleComplete={handleComplete(captchaInfo.containerId)}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
