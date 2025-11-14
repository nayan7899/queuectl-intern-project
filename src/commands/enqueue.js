import { db, loadConfig } from '../core/db.js';
import { v4 as uuidv4 } from 'uuid';

export function registerEnqueueCommand(program) {
  program
    .command('enqueue <jobJson>')
    .description('Add a new job to the queue. e.g., \'{"command":"echo hello"}\'')
    .action((jobJson) => {
  
      // Changed datetime("now") to datetime('now')
      const insertJobStmt = db.prepare(
        "INSERT INTO jobs (id, command, max_retries, state, run_at) VALUES (?, ?, ?, ?, datetime('now', 'utc'))"
      );
      

      let jobData;
      try {
        jobData = JSON.parse(jobJson);
      } catch (err) {
        console.error('Error: Invalid JSON provided.');
        console.error(err.message);
        process.exit(1);
      }

      if (!jobData.command) {
        console.error('Error: The "command" field is required in the job JSON.');
        process.exit(1);
      }

      const config = loadConfig();

      const newJob = {
        id: jobData.id || uuidv4(),
        command: jobData.command,
        max_retries: jobData.max_retries || config.max_retries,
        state: 'pending',
      };

      try {
        const runInsert = db.transaction(() => {
          insertJobStmt.run(newJob.id, newJob.command, newJob.max_retries, newJob.state);
        });
        
        runInsert();
        
        console.log(`✅ Job enqueued successfully. ID: ${newJob.id}`);

      } catch (err) {
        console.error(`Error enqueuing job: ${err.message}`);
        if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
          console.error('Error: A job with this ID already exists.');
        }
        process.exit(1);
      }
    });
}