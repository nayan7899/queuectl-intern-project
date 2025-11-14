import { Worker } from '../core/worker.js';
import { stopAllWorkers } from '../core/db.js';

export function registerWorkerCommand(program) {
  const workerCommand = program.command('worker')
    .description('Manage worker processes');

  workerCommand
    .command('start')
    .description('Start a new worker process (runs in foreground)')
    .action(async () => {
      // This command is long-lived
      const worker = new Worker();
      await worker.start();
    });

  workerCommand
    .command('stop')
    .description('Signal all running workers to stop gracefully')
    .action(() => {
      // This command is short-lived
      stopAllWorkers();
    });
}