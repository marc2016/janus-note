import { vaultService } from '../../vaultService';
import { AgentTool } from './types';

export interface TaskItem {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'done';
  priority?: 'low' | 'medium' | 'high';
}

export interface TasksFileData {
  title: string;
  tasks: TaskItem[];
}

export function validateTasksFileData(data: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Tasks data must be a valid JSON object.'] };
  }
  if (typeof data.title !== 'string' || !data.title.trim()) {
    errors.push('Tasks data must include a non-empty "title" string.');
  }
  if (!Array.isArray(data.tasks)) {
    errors.push('Tasks data must include a "tasks" array.');
  } else {
    data.tasks.forEach((t: any, index: number) => {
      if (!t || typeof t !== 'object') {
        errors.push(`Task at index ${index} must be an object.`);
        return;
      }
      if (typeof t.id !== 'string' && typeof t.id !== 'number') {
        errors.push(`Task at index ${index} must have an "id".`);
      }
      if (typeof t.title !== 'string' || !t.title.trim()) {
        errors.push(`Task at index ${index} must have a non-empty "title".`);
      }
      if (t.status && !['todo', 'in-progress', 'done'].includes(t.status)) {
        errors.push(`Task "${t.title || index}" has invalid status "${t.status}". Must be todo, in-progress, or done.`);
      }
      if (t.priority && !['low', 'medium', 'high'].includes(t.priority)) {
        errors.push(`Task "${t.title || index}" has invalid priority "${t.priority}". Must be low, medium, or high.`);
      }
    });
  }
  return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
}

export const createTaskListTool: AgentTool<{
  companionPath: string;
  title: string;
  tasks: Array<{ id?: string; title: string; status?: 'todo' | 'in-progress' | 'done'; priority?: 'low' | 'medium' | 'high' }>;
  embedInNotePath?: string;
}> = {
  name: 'create_task_list',
  description: 'Creates a structured companion tasks file (*.tasks.json) and optionally embeds it in a markdown note.',
  definition: {
    name: 'create_task_list',
    description: 'Creates a structured companion tasks file (*.tasks.json) and optionally embeds it in a markdown note.',
    parameters: {
      type: 'object',
      properties: {
        companionPath: {
          type: 'string',
          description: 'The path for the companion file (e.g. "tasks/sprint-2.tasks.json"). Must end in .tasks.json.',
        },
        title: {
          type: 'string',
          description: 'Title of the task board.',
        },
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              status: { type: 'string', enum: ['todo', 'in-progress', 'done'] },
              priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            },
            required: ['title'],
          },
          description: 'List of task items.',
        },
        embedInNotePath: {
          type: 'string',
          description: 'Optional path of a markdown note where the tasks companion block should be inserted.',
        },
      },
      required: ['companionPath', 'title', 'tasks'],
    },
  },
  async execute({ companionPath, title, tasks, embedInNotePath }) {
    try {
      const normalizedPath = companionPath.endsWith('.tasks.json')
        ? companionPath
        : `${companionPath}.tasks.json`;

      const taskItems: TaskItem[] = tasks.map((t, idx) => ({
        id: t.id || String(idx + 1),
        title: t.title,
        status: t.status || 'todo',
        priority: t.priority || 'medium',
      }));

      const taskData: TasksFileData = {
        title,
        tasks: taskItems,
      };

      const validation = validateTasksFileData(taskData);
      if (!validation.valid) {
        return `Schema validation failed: ${validation.errors?.join('; ')}`;
      }

      await vaultService.writeFile(normalizedPath, JSON.stringify(taskData, null, 2));

      let embedMsg = '';
      if (embedInNotePath) {
        try {
          const noteContent = await vaultService.readFile(embedInNotePath);
          const block = `\n\n\`\`\`tasks\nsrc: "${normalizedPath}"\nview: "board"\n\`\`\`\n`;
          await vaultService.writeFile(embedInNotePath, noteContent.trimEnd() + block);
          embedMsg = ` and embedded into note "${embedInNotePath}"`;
        } catch (err: any) {
          embedMsg = ` (note embedding failed: ${err.message})`;
        }
      }

      return `Successfully created task list "${normalizedPath}" with ${taskItems.length} tasks${embedMsg}.`;
    } catch (err: any) {
      return `Error creating task list: ${err.message || String(err)}`;
    }
  },
};

export const addTasksTool: AgentTool<{
  companionPath: string;
  tasks: Array<{ title: string; status?: 'todo' | 'in-progress' | 'done'; priority?: 'low' | 'medium' | 'high' }>;
}> = {
  name: 'add_tasks',
  description: 'Adds new tasks to an existing companion task file (*.tasks.json).',
  definition: {
    name: 'add_tasks',
    description: 'Adds new tasks to an existing companion task file (*.tasks.json).',
    parameters: {
      type: 'object',
      properties: {
        companionPath: {
          type: 'string',
          description: 'Path to the existing *.tasks.json file.',
        },
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              status: { type: 'string', enum: ['todo', 'in-progress', 'done'] },
              priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            },
            required: ['title'],
          },
          description: 'Tasks to add.',
        },
      },
      required: ['companionPath', 'tasks'],
    },
  },
  async execute({ companionPath, tasks }) {
    try {
      const content = await vaultService.readFile(companionPath);
      const data: TasksFileData = JSON.parse(content);

      let maxId = 0;
      data.tasks.forEach((t) => {
        const num = parseInt(t.id, 10);
        if (!isNaN(num) && num > maxId) maxId = num;
      });

      const newItems: TaskItem[] = tasks.map((t, idx) => ({
        id: String(maxId + idx + 1),
        title: t.title,
        status: t.status || 'todo',
        priority: t.priority || 'medium',
      }));

      data.tasks.push(...newItems);

      const validation = validateTasksFileData(data);
      if (!validation.valid) {
        return `Schema validation failed: ${validation.errors?.join('; ')}`;
      }

      await vaultService.writeFile(companionPath, JSON.stringify(data, null, 2));
      return `Successfully added ${newItems.length} tasks to "${companionPath}". Total tasks: ${data.tasks.length}.`;
    } catch (err: any) {
      return `Error adding tasks: ${err.message || String(err)}`;
    }
  },
};

export const updateTaskTool: AgentTool<{
  companionPath: string;
  taskId: string;
  updates: { title?: string; status?: 'todo' | 'in-progress' | 'done'; priority?: 'low' | 'medium' | 'high' };
}> = {
  name: 'update_task',
  description: 'Updates the title, status, or priority of a specific task item in a *.tasks.json file.',
  definition: {
    name: 'update_task',
    description: 'Updates the title, status, or priority of a specific task item in a *.tasks.json file.',
    parameters: {
      type: 'object',
      properties: {
        companionPath: {
          type: 'string',
          description: 'Path to the *.tasks.json file.',
        },
        taskId: {
          type: 'string',
          description: 'ID of the task to update.',
        },
        updates: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            status: { type: 'string', enum: ['todo', 'in-progress', 'done'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
        },
      },
      required: ['companionPath', 'taskId', 'updates'],
    },
  },
  async execute({ companionPath, taskId, updates }) {
    try {
      const content = await vaultService.readFile(companionPath);
      const data: TasksFileData = JSON.parse(content);

      const taskIndex = data.tasks.findIndex((t) => String(t.id) === String(taskId));
      if (taskIndex === -1) {
        return `Error: Task with id "${taskId}" not found in "${companionPath}".`;
      }

      data.tasks[taskIndex] = {
        ...data.tasks[taskIndex],
        ...updates,
      };

      const validation = validateTasksFileData(data);
      if (!validation.valid) {
        return `Schema validation failed: ${validation.errors?.join('; ')}`;
      }

      await vaultService.writeFile(companionPath, JSON.stringify(data, null, 2));
      return `Successfully updated task "${taskId}" in "${companionPath}".`;
    } catch (err: any) {
      return `Error updating task: ${err.message || String(err)}`;
    }
  },
};

export const getTaskListTool: AgentTool<{ companionPath: string }> = {
  name: 'get_task_list',
  description: 'Reads and parses a *.tasks.json companion file.',
  definition: {
    name: 'get_task_list',
    description: 'Reads and parses a *.tasks.json companion file.',
    parameters: {
      type: 'object',
      properties: {
        companionPath: {
          type: 'string',
          description: 'Path to the *.tasks.json file.',
        },
      },
      required: ['companionPath'],
    },
  },
  async execute({ companionPath }) {
    try {
      const content = await vaultService.readFile(companionPath);
      return content;
    } catch (err: any) {
      return `Error reading task list: ${err.message || String(err)}`;
    }
  },
};

export const taskTools = [
  createTaskListTool,
  addTasksTool,
  updateTaskTool,
  getTaskListTool,
];
