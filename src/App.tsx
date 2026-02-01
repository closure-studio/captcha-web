import "./App.css";
import { useCallback } from "react";
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
    maxConcurrent: 4,
  });

  const handleComplete = useCallback(
    (containerId: string) => {
      completeTask(containerId, "success");
    },
    [completeTask],
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <SystemInfo />
      <TaskControls
        isLoading={isLoading}
        isPolling={isPolling}
        taskCount={tasks.filter((t) => !t.completed).length}
        error={error}
        onFetchTasks={fetchTasks}
        onStartPolling={startPolling}
        onStopPolling={stopPolling}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-2">
        {tasks.map((task) =>
          task.completed ? (
            <div key={task.containerId} />
          ) : (
            <CaptchaSolver
              key={task.containerId}
              captchaInfo={task}
              onComplete={handleComplete}
            />
          ),
        )}
      </div>
    </div>
  );
}

export default App;
