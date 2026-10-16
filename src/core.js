export const STORAGE_KEY = 'daymark:tasks:v1';
export const MAX_LENGTH = 180;
export const MAX_TASKS = 500;
export function isTask(task) {
  return task && typeof task.id === 'string' && task.id.length > 0 && typeof task.text === 'string' && task.text.trim().length > 0 && task.text.length <= MAX_LENGTH && typeof task.completed === 'boolean';
}
export function createTask(text, id = globalThis.crypto.randomUUID()) {
  const clean = text.trim();
  if (!clean || clean.length > MAX_LENGTH) throw new Error(`Enter a task between 1 and ${MAX_LENGTH} characters.`);
  return { id, text: clean, completed: false };
}
export function loadTasks(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { tasks: [], warning: '' };
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error('Invalid data');
    const seen = new Set();
    const tasks = data.filter(task => {
      if (!isTask(task) || seen.has(task.id)) return false;
      seen.add(task.id); return true;
    }).slice(0, MAX_TASKS);
    return { tasks, warning: tasks.length !== data.length ? 'Some saved tasks could not be read. Your valid tasks are still available.' : '' };
  } catch {
    return { tasks: [], warning: 'Saved tasks could not be read. You can still use the list during this visit.' };
  }
}
export function saveTasks(storage, tasks) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(tasks)); return true; }
  catch { return false; }
}
export function visibleTasks(tasks, filter) {
  return tasks.filter(task => filter === 'active' ? !task.completed : filter === 'completed' ? task.completed : true);
}
export function taskStats(tasks) {
  const total = tasks.length;
  const completed = tasks.filter(task => task.completed).length;
  return { total, completed, active: total - completed, percent: total ? Math.round(completed / total * 100) : 0 };
}
