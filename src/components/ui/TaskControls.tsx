interface TaskControlsProps {
  isLoading: boolean;
  isPolling: boolean;
  taskCount: number;
  error: string | null;
  onFetchTasks: () => void;
  onStartPolling: () => void;
  onStopPolling: () => void;
}

export function TaskControls({
  isLoading,
  isPolling,
  taskCount,
  error,
  onFetchTasks,
  onStartPolling,
  onStopPolling,
}: TaskControlsProps) {
  return (
    <div className="flex gap-2 p-4">
      <button
        onClick={onFetchTasks}
        disabled={isLoading}
        className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
      >
        {isLoading ? "获取中..." : "获取任务"}
      </button>
      <button
        onClick={isPolling ? onStopPolling : onStartPolling}
        className={`px-3 py-1 rounded text-sm text-white ${
          isPolling
            ? "bg-red-500 hover:bg-red-600"
            : "bg-green-500 hover:bg-green-600"
        }`}
      >
        {isPolling ? "停止轮询" : "开始轮询"}
      </button>
      <span className="text-sm text-gray-500 self-center">
        任务数: {taskCount}
      </span>
      {error && (
        <span className="text-sm text-red-500 self-center">{error}</span>
      )}
    </div>
  );
}
