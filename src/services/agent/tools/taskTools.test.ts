import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTaskListTool,
  addTasksTool,
  updateTaskTool,
  getTaskListTool,
  validateTasksFileData,
} from './taskTools';
import { vaultService } from '../../vaultService';

describe('taskTools', () => {
  beforeEach(async () => {
    await vaultService.writeFile('ProjectNote.md', '# Project\nWelcome.');
  });

  it('validates task file schema correctly', () => {
    const validData = {
      title: 'Sprint A',
      tasks: [{ id: '1', title: 'Task 1', status: 'todo' as const, priority: 'high' as const }],
    };
    expect(validateTasksFileData(validData).valid).toBe(true);

    const invalidData = {
      title: '',
      tasks: [{ id: '1', status: 'invalid-status' }],
    };
    const res = validateTasksFileData(invalidData);
    expect(res.valid).toBe(false);
    expect(res.errors?.length).toBeGreaterThan(1);
  });

  it('creates task list and embeds block in note', async () => {
    const res = await createTaskListTool.execute({
      companionPath: 'tasks/sprint-test.tasks.json',
      title: 'Test Sprint',
      tasks: [
        { title: 'Setup CI', status: 'todo', priority: 'high' },
        { title: 'Write Tests', status: 'in-progress' },
      ],
      embedInNotePath: 'ProjectNote.md',
    });

    expect(res).toContain('Successfully created task list');
    expect(res).toContain('embedded into note');

    const note = await vaultService.readFile('ProjectNote.md');
    expect(note).toContain('```tasks');
    expect(note).toContain('tasks/sprint-test.tasks.json');

    const companionRaw = await vaultService.readFile('tasks/sprint-test.tasks.json');
    const companion = JSON.parse(companionRaw);
    expect(companion.title).toBe('Test Sprint');
    expect(companion.tasks).toHaveLength(2);
  });

  it('adds and updates tasks in existing companion file', async () => {
    await createTaskListTool.execute({
      companionPath: 'tasks/manage.tasks.json',
      title: 'Management',
      tasks: [{ id: '1', title: 'Existing Task', status: 'todo' }],
    });

    // Add task
    const addRes = await addTasksTool.execute({
      companionPath: 'tasks/manage.tasks.json',
      tasks: [{ title: 'New Task', status: 'in-progress' }],
    });
    expect(addRes).toContain('Successfully added 1 tasks');

    // Update task
    const updateRes = await updateTaskTool.execute({
      companionPath: 'tasks/manage.tasks.json',
      taskId: '1',
      updates: { status: 'done', priority: 'high' },
    });
    expect(updateRes).toContain('Successfully updated task "1"');

    // Read back
    const getRes = await getTaskListTool.execute({ companionPath: 'tasks/manage.tasks.json' });
    const parsed = JSON.parse(getRes);
    expect(parsed.tasks).toHaveLength(2);
    expect(parsed.tasks[0].status).toBe('done');
    expect(parsed.tasks[0].priority).toBe('high');
  });
});
