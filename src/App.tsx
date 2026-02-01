import "./App.css";
import { CaptchaSolver } from "./components/CaptchaSolver";
import { SystemInfo } from "./components/ui/SystemInfo";
import { TaskControls } from "./components/ui/TaskControls";
import { useCaptchaQueue } from "./hooks/useCaptchaQueue";

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
  } = useCaptchaQueue({
    useMock: true,
    taskTimeout: 2 * 60 * 1000,
    maxConcurrent: 2,
  });

  const handleComplete = (containerId: string) => () => {
    completeTask(containerId, "success");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <SystemInfo />
      <TaskControls
        isLoading={isLoading}
        isPolling={isPolling}
        taskCount={tasks.length}
        error={error}
        onFetchTasks={fetchTasks}
        onStartPolling={startPolling}
        onStopPolling={stopPolling}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-2">
        {tasks.map((task) => (
          <CaptchaSolver
            key={task.containerId}
            captchaInfo={task}
            handleComplete={handleComplete(task.containerId)}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
