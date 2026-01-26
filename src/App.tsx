import React, { useState } from "react";
import "./App.css";
import { GeeTestV4Captcha } from "./components/GeeTestV4Captcha";
import type { CaptchaType } from "./types/type";
import { CAPTCHA_ID } from "./consts/consts";

function App() {
  const [challengeList, setChallengeList] = useState<CaptchaType[]>([
    {
      challenge: "1",
      geetestId: CAPTCHA_ID,
      provider: "geetest_v4",
      type: "slide",
    },
  ]);

  // 用 useRef 持久化定时器映射
  const timeoutMap = React.useRef(new Map<string, number>());

  // 添加 challenge 时设置超时
  const addChallengeWithTimeout = (challenge: string) => {
    // 避免重复添加
    if (timeoutMap.current.has(challenge)) return;
    const timeout = window.setTimeout(
      () => {
        setChallengeList((prev) =>
          prev.filter((item) => item.challenge !== challenge),
        );
        timeoutMap.current.delete(challenge);
      },
      2 * 60 * 1000,
    );
    timeoutMap.current.set(challenge, timeout);
  };

  // 移除 challenge 并清理定时器
  const removeChallenge = (challenge: string) => {
    setChallengeList((prev) =>
      prev.filter((item) => item.challenge !== challenge),
    );
    const timeout = timeoutMap.current.get(challenge);
    if (timeout) {
      clearTimeout(timeout);
      timeoutMap.current.delete(challenge);
    }
  };

  // 完成时移除 challenge
  const handleComplete = (challenge: string) => () => {
    removeChallenge(challenge);
  };

  // 监听 challengeList 变化，为新增的 challenge 设置超时
  React.useEffect(() => {
    challengeList.forEach((item) => {
      addChallengeWithTimeout(item.challenge);
    });
    // 清理已被移除 challenge 的定时器
    timeoutMap.current.forEach((timeout, challenge) => {
      if (!challengeList.some((item) => item.challenge === challenge)) {
        clearTimeout(timeout);
        timeoutMap.current.delete(challenge);
      }
    });
  }, [challengeList]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      {challengeList.map((item) => (
        <GeeTestV4Captcha
          key={item.challenge}
          captchaType={item}
          onComplete={handleComplete(item.challenge)}
        />
      ))}
    </div>
  );
}

export default App;
