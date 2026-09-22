import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  BarChart3, 
  FileCode2, 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  Circle, 
  Clock, 
  Share2 
} from 'lucide-react';
import { vaultService } from '../../services/vaultService';
import * as yaml from 'js-yaml';

interface CompanionBlockProps {
  type: 'tasks' | 'chart';
  rawCode: string;
}

interface TaskItemData {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'done';
  priority?: 'low' | 'medium' | 'high';
}

interface TasksFileData {
  title?: string;
  tasks: TaskItemData[];
}

interface ChartNodeData {
  id: string;
  label: string;
  category?: string;
}

interface ChartFileData {
  title?: string;
  nodes?: ChartNodeData[];
  type?: string;
}

export const CompanionBlock: React.FC<CompanionBlockProps> = ({ type, rawCode }) => {
  const [sourcePath, setSourcePath] = useState<string>('');
  const [data, setData] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Parse config inside the codeblock
  useEffect(() => {
    try {
      let parsedConfig: any = {};
      if (rawCode.trim().startsWith('{')) {
        parsedConfig = JSON.parse(rawCode);
      } else {
        parsedConfig = yaml.load(rawCode) || {};
      }

      const src = parsedConfig.src || parsedConfig.source || '';
      setSourcePath(src);
    } catch (err) {
      setError(`Failed to parse embed configuration: ${err}`);
      setIsLoading(false);
    }
  }, [rawCode]);

  // Load companion JSON data
  const loadData = async () => {
    if (!sourcePath) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const content = await vaultService.readFile(sourcePath);
      const json = JSON.parse(content);
      setData(json);
    } catch (err: any) {
      const msg = String(err);
      if (msg.includes('not found') || msg.includes('No such file')) {
        setNotFound(true);
      } else {
        setError(`Failed to load companion data: ${msg}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    let unlisten: (() => void) | undefined;
    (async () => {
      unlisten = await vaultService.onFileChanged(event => {
        if (!sourcePath) return;
        const cleanSource = sourcePath.replace(/^\/+/, '');
        const cleanEvent = event.path.replace(/^\/+/, '');
        if (cleanEvent === cleanSource || cleanEvent.endsWith(cleanSource) || cleanSource.endsWith(cleanEvent)) {
          loadData();
        }
      });
    })();

    return () => {
      if (unlisten) unlisten();
    };
  }, [sourcePath]);

  // Create missing companion file
  const handleCreateFile = async () => {
    if (!sourcePath) return;

    let defaultContent = '';
    if (type === 'tasks') {
      const defaultTasks: TasksFileData = {
        title: sourcePath.split('/').pop()?.replace('.tasks.json', '') || 'New Tasks',
        tasks: [
          { id: '1', title: 'First task item', status: 'todo', priority: 'medium' }
        ]
      };
      defaultContent = JSON.stringify(defaultTasks, null, 2);
    } else {
      const defaultChart: ChartFileData = {
        title: sourcePath.split('/').pop()?.replace('.chart.json', '') || 'Architecture Map',
        nodes: [
          { id: 'node1', label: 'Component A' },
          { id: 'node2', label: 'Component B' }
        ]
      };
      defaultContent = JSON.stringify(defaultChart, null, 2);
    }

    try {
      await vaultService.writeFile(sourcePath, defaultContent);
      await loadData();
    } catch (err) {
      setError(`Failed to create companion file: ${err}`);
    }
  };

  // Toggle task status
  const handleToggleTask = async (taskId: string) => {
    if (type !== 'tasks' || !data || !sourcePath) return;

    const currentTasks: TaskItemData[] = data.tasks || [];
    const updatedTasks = currentTasks.map(t => {
      if (t.id === taskId) {
        const nextStatus: TaskItemData['status'] = t.status === 'done' ? 'todo' : 'done';
        return { ...t, status: nextStatus };
      }
      return t;
    });

    const updatedData = { ...data, tasks: updatedTasks };
    setData(updatedData);

    try {
      await vaultService.writeFile(sourcePath, JSON.stringify(updatedData, null, 2));
    } catch (err) {
      setError(`Failed to update task on disk: ${err}`);
    }
  };

  // Add new task
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || type !== 'tasks' || !data || !sourcePath) return;

    const currentTasks: TaskItemData[] = data.tasks || [];
    const newTask: TaskItemData = {
      id: Date.now().toString(),
      title: newTaskTitle.trim(),
      status: 'todo',
      priority: 'medium'
    };

    const updatedData = { ...data, tasks: [...currentTasks, newTask] };
    setData(updatedData);
    setNewTaskTitle('');

    try {
      await vaultService.writeFile(sourcePath, JSON.stringify(updatedData, null, 2));
    } catch (err) {
      setError(`Failed to add task on disk: ${err}`);
    }
  };

  if (!sourcePath) {
    return (
      <div className="my-4 p-3 rounded-lg border border-border-subtle bg-surface/40 text-xs text-text-muted select-none">
        <div className="flex items-center space-x-2 text-amber-400 mb-1">
          <AlertCircle className="w-4 h-4" />
          <span className="font-semibold capitalize">Missing companion source</span>
        </div>
        Specify a companion file path in the block (e.g. <code className="text-accent">src: &quot;sprint.tasks.json&quot;</code>).
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="my-4 p-4 rounded-xl border border-dashed border-border-strong bg-surface/40 select-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-surface border border-border-subtle text-accent">
              <FileCode2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-text-primary">
                Companion file not found: <span className="font-mono text-accent">{sourcePath}</span>
              </div>
              <div className="text-[11px] text-text-dim">
                This {type} embed references a companion file that does not exist in the Vault yet.
              </div>
            </div>
          </div>

          <button
            onClick={handleCreateFile}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent-hover transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Companion File</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="my-5 rounded-xl border border-border-subtle bg-surface/60 backdrop-blur-sm overflow-hidden shadow-lg select-none">
      {/* Companion Card Header */}
      <div className="px-4 py-2.5 bg-sidebar-subtle border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {type === 'tasks' ? (
            <div className="p-1 rounded bg-blue-950/60 text-accent border border-blue-800/40">
              <CheckSquare className="w-4 h-4" />
            </div>
          ) : (
            <div className="p-1 rounded bg-purple-950/60 text-purple-400 border border-purple-800/40">
              <BarChart3 className="w-4 h-4" />
            </div>
          )}

          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-text-primary">
              {data?.title || (type === 'tasks' ? 'Tasks Board' : 'Visualization Map')}
            </span>
            <span className="text-[10px] font-mono text-text-dim px-1.5 py-0.5 rounded bg-surface border border-border-subtle">
              {sourcePath}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-[11px] text-text-muted">
          <span className="capitalize px-1.5 py-0.5 rounded bg-surface border border-border-subtle text-[10px]">
            {type} companion
          </span>
        </div>
      </div>

      {/* Companion Card Body */}
      <div className="p-4">
        {isLoading ? (
          <div className="text-xs text-text-muted py-4 text-center">
            Loading companion data...
          </div>
        ) : error ? (
          <div className="text-xs text-rose-400 py-2 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        ) : type === 'tasks' ? (
          <div className="space-y-3">
            {/* Task list items */}
            <div className="space-y-1.5">
              {(data?.tasks || []).map((t: TaskItemData) => {
                const isDone = t.status === 'done';
                const isInProgress = t.status === 'in-progress';

                return (
                  <div
                    key={t.id}
                    onClick={() => handleToggleTask(t.id)}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border ${
                      isDone
                        ? 'bg-surface/30 border-border-subtle/50 text-text-muted'
                        : 'bg-surface border-border-subtle hover:border-border-strong text-text-primary'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <button className="text-text-muted hover:text-accent transition-colors flex-shrink-0">
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : isInProgress ? (
                          <Clock className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Circle className="w-4 h-4 text-text-dim" />
                        )}
                      </button>
                      <span
                        className={`text-xs ${
                          isDone ? 'line-through text-text-dim' : 'font-medium'
                        }`}
                      >
                        {t.title}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5 text-[10px]">
                      {t.priority && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-semibold ${
                            t.priority === 'high'
                              ? 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                              : t.priority === 'medium'
                              ? 'bg-amber-950/60 text-amber-400 border border-amber-800/40'
                              : 'bg-surface text-text-dim border border-border-subtle'
                          }`}
                        >
                          {t.priority}
                        </span>
                      )}

                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] uppercase ${
                          isDone
                            ? 'text-emerald-400'
                            : isInProgress
                            ? 'text-amber-400'
                            : 'text-text-dim'
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Add Task */}
            <form onSubmit={handleAddTask} className="flex items-center space-x-2 pt-1">
              <input
                type="text"
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                placeholder="+ Add task to companion file..."
                className="flex-1 bg-surface border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-primary placeholder-text-dim focus:outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={!newTaskTitle.trim()}
                className="px-2.5 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent-hover disabled:opacity-40 transition-colors"
              >
                Add
              </button>
            </form>
          </div>
        ) : (
          /* Chart / Diagram Embed Preview */
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(data?.nodes || []).map((node: ChartNodeData) => (
                <div
                  key={node.id}
                  className="p-2.5 rounded-lg bg-surface border border-border-subtle flex flex-col items-center justify-center text-center space-y-1 hover:border-purple-500/50 transition-colors"
                >
                  <Share2 className="w-4 h-4 text-purple-400 mb-0.5" />
                  <span className="text-xs font-medium text-text-primary truncate w-full">
                    {node.label}
                  </span>
                  <span className="text-[9px] font-mono text-text-dim">{node.id}</span>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-text-dim text-center">
              Schema-validated Companion Graph &bull; Mutated via Janus Agent tools
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
