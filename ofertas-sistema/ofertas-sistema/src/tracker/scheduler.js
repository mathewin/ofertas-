import config from '../config.js';
import { getSettings, logEvent } from '../db/index.js';
import { runTracker, isRunning } from './engine.js';

let heartbeat = null;
let lastRunAt = 0;
let lastTrigger = null;
let currentIntervalMinutes = config.tracker.intervalMinutes;

async function tick() {
  if (isRunning()) return;
  const settings = await getSettings();
  const intervalMinutes = Number.parseInt(settings.intervalMinutes ?? String(config.tracker.intervalMinutes), 10) || config.tracker.intervalMinutes;
  currentIntervalMinutes = intervalMinutes;

  const elapsed = Date.now() - lastRunAt;
  if (elapsed < intervalMinutes * 60 * 1000) return;

  lastRunAt = Date.now();
  lastTrigger = 'scheduler';
  await runTracker({ trigger: 'scheduler' });
}

export async function startScheduler() {
  if (heartbeat) return;
  await logEvent('scheduler', 'info', `Agendador iniciado (intervalo: ${currentIntervalMinutes} min)`);

  if (config.tracker.runOnStart) {
    lastRunAt = Date.now();
    lastTrigger = 'startup';
    runTracker({ trigger: 'startup' }).catch(() => {});
  }

  heartbeat = setInterval(() => {
    tick().catch(() => {});
  }, 30 * 1000);
  if (heartbeat.unref) heartbeat.unref();
}

export function stopScheduler() {
  if (heartbeat) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
}

export function getSchedulerState() {
  const nextRunAt = lastRunAt
    ? new Date(lastRunAt + currentIntervalMinutes * 60 * 1000).toISOString()
    : null;
  return {
    running: Boolean(heartbeat),
    interval_minutes: currentIntervalMinutes,
    last_run_at: lastRunAt ? new Date(lastRunAt).toISOString() : null,
    last_trigger: lastTrigger,
    next_run_at: nextRunAt,
    capture_in_progress: isRunning(),
  };
}

export default { startScheduler, stopScheduler, getSchedulerState };
