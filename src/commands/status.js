import { db } from '../core/db.js';
import { program } from '../cli.js';

export function registerStatusCommand(program) {
  program
    .command('status')
    .description('Show a summary of all job states and active workers')
    .action(() => {
      // Prepare statements inside the action
      const jobSummaryStmt = db.prepare(
        'SELECT state, COUNT(id) as count FROM jobs GROUP BY state'
      );
      const workerSummaryStmt = db.prepare(
        'SELECT status, COUNT(worker_id) as count FROM workers GROUP BY status'
      );
      
      try {
        // Get Job Summary
        const jobCounts = jobSummaryStmt.all();
        console.log('--- Job Summary ---');
        if (jobCounts.length === 0) {
          console.log('No jobs in the queue.');
        } else {
          console.table(jobCounts);
        }

        // Get Worker Summary
        const workerCounts = workerSummaryStmt.all();
        console.log('\n--- Worker Summary ---');
        if (workerCounts.length === 0) {
          console.log('No active workers.');
        } else {
          console.table(workerCounts);
        }

      } catch (err) {
        console.error(`Error fetching status: ${err.message}`);
      }
    });
}