import { loadTasks, saveTasks, createTask, visibleTasks, taskStats, MAX_TASKS } from './core.js';

const $ = id => document.getElementById(id);
let storage;
try { storage = localStorage; } catch { /* Private browser settings may block storage. */ }
const initial = loadTasks(storage);
let tasks = initial.tasks;
let filter = 'all';
let deleted = null;
let sessionOnly = false;
function announce(text) { $('announcement').textContent = text; }
function showWarning(text) { $('warning').textContent = text; $('warning').hidden = !text; }
function persist() {
  sessionOnly = !saveTasks(storage, tasks);
  if (sessionOnly) showWarning('Browser storage is unavailable or full. Changes work during this visit, but may be lost when you close or reload this page.');
  else showWarning('');
  $('save-status').lastChild.textContent = sessionOnly ? ' Saved for this visit only' : ' Saved in this browser';
  $('save-status').classList.toggle('session-only', sessionOnly);
}
function focusTask(index = 0) {
  const boxes = $('task-list').querySelectorAll('input');
  if (boxes.length) boxes[Math.min(index, boxes.length - 1)].focus();
  else $('task-input').focus();
}
function render() {
  const stats = taskStats(tasks);
  for (const [id, value] of Object.entries({ 'total-count': stats.total, 'active-count': stats.active, 'completed-count': stats.completed, 'all-badge': stats.total })) $(id).textContent = value;
  const visible = visibleTasks(tasks, filter);
  $('task-list').replaceChildren();
  for (const task of visible) {
    const li = document.createElement('li'); li.className = `task-row${task.completed ? ' completed' : ''}`;
    const label = document.createElement('label'); label.className = 'task-label';
    const box = document.createElement('input'); box.type = 'checkbox'; box.checked = task.completed;
    const check = document.createElement('span'); check.className = 'custom-check'; check.setAttribute('aria-hidden', 'true'); check.textContent = '✓';
    const text = document.createElement('span'); text.className = 'task-text'; text.textContent = task.text;
    box.addEventListener('change', () => {
      const index = visible.findIndex(item => item.id === task.id);
      task.completed = box.checked;
      persist(); render();
      focusTask(index);
      announce(task.completed ? `Completed: ${task.text}` : `Marked active: ${task.text}`);
    });
    label.append(box, check, text);
    const remove = document.createElement('button'); remove.className = 'delete-button'; remove.type = 'button';
    remove.setAttribute('aria-label', `Delete task: ${task.text}`);
    remove.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5m4-5v5"/></svg>';
    remove.addEventListener('click', () => {
      deleted = { task: { ...task }, index: tasks.findIndex(item => item.id === task.id) };
      const index = visible.findIndex(item => item.id === task.id);
      tasks = tasks.filter(item => item.id !== task.id);
      persist(); render(); focusTask(index);
      $('undo-copy').textContent = 'Task deleted.'; $('undo-bar').hidden = false;
      announce(`Deleted: ${task.text}. Undo is available below the list.`);
    });
    li.append(label, remove); $('task-list').append(li);
  }
  $('empty-state').hidden = visible.length > 0;
  const empty = !stats.total ? ['A clear space. A fresh start.', 'Add your first task above.\nBig plans begin with one small step.'] : filter === 'active' ? ['All caught up. Nicely done.', 'You’ve completed every task.\nTake a breath. You earned it.'] : ['Your wins will live here.', 'Check off a task when it’s done.\nEvery little bit is progress.'];
  $('empty-title').textContent = empty[0]; $('empty-copy').textContent = empty[1];
  $('progress-section').hidden = stats.total === 0;
  $('progress-label').textContent = `${stats.completed} of ${stats.total} completed`;
  $('progress-percent').textContent = `${stats.percent}%`;
  $('progress').value = stats.percent;
  $('progress-note').textContent = stats.percent === 100 ? 'Everything checked off. Enjoy a little breathing room.' : 'Progress, at your own pace.';
}
$('add-form').addEventListener('submit', event => {
  event.preventDefault();
  const input = $('task-input');
  input.setCustomValidity('');
  try {
    if (tasks.length >= MAX_TASKS) throw new Error('Your list has 500 tasks. Delete a task to make room.');
    const task = createTask(input.value);
    tasks.unshift(task); input.value = '';
    // Show a newly added active task even when viewing completed tasks.
    if (filter === 'completed') {
      filter = 'all'; document.querySelector('[name="filter"][value="all"]').checked = true;
    }
    persist(); render(); input.focus(); announce(`Added: ${task.text}`);
  } catch (error) { input.setCustomValidity(error.message); input.reportValidity(); }
});
$('task-input').addEventListener('input', () => $('task-input').setCustomValidity(''));
$('filters').addEventListener('change', event => { filter = event.target.value; render(); announce(`Showing ${filter === 'all' ? 'all tasks' : `${filter} tasks`}.`); });
$('undo').addEventListener('click', () => {
  if (!deleted) return;
  if (tasks.length >= MAX_TASKS) { showWarning('Delete a task before restoring this one. Your list is full.'); return; }
  tasks.splice(Math.min(deleted.index, tasks.length), 0, deleted.task);
  deleted = null; $('undo-bar').hidden = true;
  persist(); render(); $('task-input').focus(); announce('Task restored.');
});
function updateDate() {
  const now = new Date();
  $('date').dateTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  $('date').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(now);
}
updateDate(); setInterval(updateDate, 60000);
render(); showWarning(initial.warning);
if (initial.warning) $('save-status').lastChild.textContent = ' Check storage notice below';
if (!storage) {
  $('save-status').lastChild.textContent = ' Saved for this visit only';
  $('save-status').classList.add('session-only');
}
