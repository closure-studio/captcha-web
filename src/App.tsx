import "./App.css";
import { CaptchaSolver } from "./components/CaptchaSolver";
import { SystemInfo } from "./components/ui/SystemInfo";
import { useCaptchaQueue } from "./hooks";
import { useAutoRefresh } from "./hooks/useAutoRefreshManager";

// 空槽位占位组件
function EmptySlot({ index }: { index: number }) {
  return (
    <div
      className="captcha-isolation-container w-[340px] h-[386px] bg-slate-200 border border-dashed border-slate-300 rounded-lg flex items-center justify-center"
      data-slot-index={index}
    >
      <span className="text-slate-400 text-sm">空槽位 {index + 1}</span>
    </div>
  );
}

function RefreshBanner() {
  const { isPreparingRefresh } = useAutoRefresh();
  const { activeTaskCount } = useCaptchaQueue();

  if (!isPreparingRefresh) return null;

  return (
    <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg text-yellow-800 text-sm">
      正在等待 {activeTaskCount} 个任务完成后刷新页面...
    </div>
  );
}

function App() {
  const { tasks, completeTask } = useCaptchaQueue();

  return (
    <div className="min-h-screen bg-slate-50 p-2">
      <SystemInfo />
      <RefreshBanner />

      <div className="flex flex-wrap gap-x-4 gap-y-8 mt-32 overflow-y-auto">
        {tasks.map((task, index) => {
          if (task === null) {
            return <EmptySlot key={`empty-${index}`} index={index} />;
          }
          return (
            <CaptchaSolver
              key={task.containerId}
              task={task}
              completeTask={completeTask}
            />
          );
        })}
      </div>
    </div>
  );
}

export default App;
