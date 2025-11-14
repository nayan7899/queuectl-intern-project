import { db } from '../core/db.js';

export function registerDlqCommand(program) {
  // Create the parent 'dlq' command
  const dlqCommand = program.command('dlq')
    .description('Manage the Dead Letter Queue (failed jobs)');

  // dlq list
  dlqCommand
    .command('list')
    .description('List all jobs in the DLQ')
    .action(() => {
      const listStmt = db.prepare(
        "SELECT id, command, output, updated_at FROM jobs WHERE state = 'dead' ORDER BY updated_at DESC"
      );
      
      try {
        const jobs = listStmt.all();
        if (jobs.length === 0) {
          console.log('Dead Letter Queue is empty.');
          return;
        }
        console.log('--- Dead Letter Queue Jobs ---');
        console.table(jobs);
      } catch (err) {
        console.error(`Error listing DLQ jobs: ${err.message}`);
      }
    });

  // dlq retry <job-id>
  dlqCommand
    .command('retry <jobId>')
    .description('Retry a specific job from the DLQ')
    .action((jobId) => {
      // This statement moves the job back to 'pending', resets attempts, and sets it to run immediately.
      const retryStmt = db.prepare(
        "UPDATE jobs SET state = 'pending', attempts = 0, run_at = datetime('now', 'utc'), updated_at = datetime('now', 'utc') WHERE id = ? AND state = 'dead'"
      );
      
      try {
        const info = retryStmt.run(jobId);
        
        if (info.changes > 0) {
          console.log(`✅ Job ${jobId} has been re-queued for retry.`);
        } else {
          console.error(`Error: Job ${jobId} not found in the DLQ.`);
        }
      } catch (err) {
        console.error(`Error retrying job: ${err.message}`);
      }
    });
}