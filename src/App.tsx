import "./App.css";
import { useCallback, useEffect, useRef } from "react";
import { CaptchaSolver } from "./components/CaptchaSolver";
import { SystemInfo } from "./components/ui/SystemInfo";
import { TaskControls } from "./components/ui/TaskControls";
import { AutoRefreshProvider } from "./contexts/AutoRefreshContext";
import { useCaptchaQueue } from "./hooks/useCaptchaQueue";
import { useAutoRefresh } from "./hooks/useAutoRefresh";

// 自动刷新间隔（毫秒）- 1 小时
const AUTO_REFRESH_INTERVAL = 1 * 60 * 60 * 1000;
// 等待任务完成的最大时间（毫秒）- 5分钟
const MAX_WAIT_TIME = 5 * 60 * 1000;

// 空槽位占位组件
function EmptySlot({ index }: { index: number }) {
  return (
    <div
      className="captcha-isolation-container w-[340px] h-[386px] bg-slate-100 border border-dashed border-slate-300 rounded-lg flex items-center justify-center"
      data-slot-index={index}
    >
      <span className="text-slate-400 text-sm">空槽位 {index + 1}</span>
    </div>
  );
}

interface RefreshBannerProps {
  activeTaskCount: number;
}

function RefreshBanner({ activeTaskCount }: RefreshBannerProps) {
  const { isPreparingRefresh } = useAutoRefresh();

  if (!isPreparingRefresh) return null;

  return (
    <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg text-yellow-800 text-sm">
      正在等待 {activeTaskCount} 个任务完成后刷新页面...
    </div>
  );
}

function App() {
  const {
    tasks,
    isLoading,
    error,
    fetchTasks,
    completeTask,
    startPolling,
    stopPolling,
    isPolling,
    activeTaskCount,
  } = useCaptchaQueue({
    taskTimeout: 3 * 60 * 1000,
    maxConcurrent: 8,
  });

  // 用 ref 保证 getActiveTaskCount 始终拿到最新值
  const activeTaskCountRef = useRef(activeTaskCount);
  const stopPollingRef = useRef(stopPolling);

  useEffect(() => {
    activeTaskCountRef.current = activeTaskCount;
  }, [activeTaskCount]);

  useEffect(() => {
    stopPollingRef.current = stopPolling;
  }, [stopPolling]);

  const handleComplete = useCallback(
    (containerId: string) => {
      // 只做本地状态标记，API 上报已在 GeetestV4Captcha 内完成
      completeTask(containerId, "success");
    },
    [completeTask],
  );

  return (
    <AutoRefreshProvider
      refreshInterval={AUTO_REFRESH_INTERVAL}
      maxWaitTime={MAX_WAIT_TIME}
      getActiveTaskCount={() => activeTaskCountRef.current}
      onStopPolling={() => stopPollingRef.current()}
    >
      <div className="min-h-screen bg-slate-50 p-2">
        <SystemInfo />
        <RefreshBanner activeTaskCount={activeTaskCount} />
        <TaskControls
          isLoading={isLoading}
          isPolling={isPolling}
          taskCount={activeTaskCount}
          error={error}
          onFetchTasks={fetchTasks}
          onStartPolling={startPolling}
          onStopPolling={stopPolling}
        />

        <div className="flex flex-wrap gap-x-4 gap-y-4 mt-16 overflow-y-auto">
          {tasks.map((task, index) => {
            // 空槽位或已完成的任务显示占位组件
            if (task === null || task.completed) {
              return <EmptySlot key={`empty-${index}`} index={index} />;
            }
            // 有效任务显示 CaptchaSolver
            return (
              <CaptchaSolver
                key={task.containerId}
                task={task}
                onComplete={() => handleComplete(task.containerId)}
              />
            );
          })}
        </div>
      </div>
    </AutoRefreshProvider>
  );
}

export default App;
