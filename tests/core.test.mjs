import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTask, isTask, loadTasks, saveTasks, visibleTasks, taskStats, MAX_LENGTH, MAX_TASKS } from '../src/core.js';
const a = { id: 'a', text: 'Read a chapter', completed: false };
const b = { id: 'b', text: 'Take a walk', completed: true };
test('creates trimmed tasks with unique IDs', () => {
  assert.deepEqual(createTask('  Read a chapter  ', 'a'), a);
  assert.notEqual(createTask('Same task').id, createTask('Same task').id);
});
test('rejects whitespace-only and overly long tasks', () => {
  for (const value of ['', '   ', '\n\t', 'x'.repeat(MAX_LENGTH + 1)]) assert.throws(() => createTask(value));
  assert.equal(createTask('x'.repeat(MAX_LENGTH)).text.length, MAX_LENGTH);
});
test('validates stored task records', () => {
  assert.ok(isTask(a));
  for (const value of [null, {}, { ...a, text: ' ' }, { ...a, id: '' }, { ...a, completed: 'true' }]) assert.ok(!isTask(value));
});
test('loads a new empty workspace and round-trips stored tasks', () => {
  let value = null;
  const storage = { getItem: () => value, setItem: (_, data) => { value = data; } };
  assert.deepEqual(loadTasks(storage), { tasks: [], warning: '' });
  assert.ok(saveTasks(storage, [a, b]));
  assert.deepEqual(loadTasks(storage), { tasks: [a, b], warning: '' });
});
test('recovers valid records and removes duplicate IDs', () => {
  const result = loadTasks({ getItem: () => JSON.stringify([a, null, a, b, { invalid: true }]) });
  assert.deepEqual(result.tasks, [a, b]);
  assert.ok(result.warning);
});
test('handles corrupt, unavailable, and full storage', () => {
  for (const value of ['broken', '{}', 'null']) {
    const result = loadTasks({ getItem: () => value });
    assert.deepEqual(result.tasks, []); assert.ok(result.warning);
  }
  assert.ok(loadTasks(undefined).warning);
  assert.equal(saveTasks(undefined, [a]), false);
  assert.equal(saveTasks({ setItem() { throw new Error('QuotaExceeded'); } }, [a]), false);
});
test('limits restored tasks to prevent an oversized saved list', () => {
  const tasks = Array.from({ length: MAX_TASKS + 1 }, (_, i) => ({ ...a, id: String(i) }));
  const result = loadTasks({ getItem: () => JSON.stringify(tasks) });
  assert.equal(result.tasks.length, MAX_TASKS); assert.ok(result.warning);
});
test('filters without changing the source array', () => {
  const tasks = [a, b];
  assert.deepEqual(visibleTasks(tasks, 'all'), [a, b]);
  assert.deepEqual(visibleTasks(tasks, 'active'), [a]);
  assert.deepEqual(visibleTasks(tasks, 'completed'), [b]);
  assert.deepEqual(tasks, [a, b]);
});
test('counts progress correctly, including empty and complete lists', () => {
  assert.deepEqual(taskStats([]), { total: 0, active: 0, completed: 0, percent: 0 });
  assert.deepEqual(taskStats([a, b]), { total: 2, active: 1, completed: 1, percent: 50 });
  assert.equal(taskStats([b]).percent, 100);
});
