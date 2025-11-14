import { db } from '../core/db.js';
import { program } from '../cli.js';

export function registerListCommand(program) {
  program
    .command('list')
    .description('List jobs by state')
    .option('--state <state>', 'Filter by state (pending, processing, completed, dead)', 'pending')
    .action((options) => {
      // Prepare the statement inside the action
      const listJobsStmt = db.prepare(
        'SELECT id, command, state, attempts, updated_at FROM jobs WHERE state = ? ORDER BY created_at ASC'
      );
      
      try {
        const jobs = listJobsStmt.all(options.state);
        
        if (jobs.length === 0) {
          console.log(`No jobs found with state: ${options.state}`);
          return;
        }
        
        // Log the results as a table
        console.log(`--- Jobs (${options.state}) ---`);
        console.table(jobs);

      } catch (err) {
        console.error(`Error listing jobs: ${err.message}`);
      }
    });
}