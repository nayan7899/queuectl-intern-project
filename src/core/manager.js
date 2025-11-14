import { db, loadConfig } from './db.js';

/**
 * Finalizes a job after execution, marking it complete, dead, or scheduling a retry.
 * @param {object} job - The job object from the database.
 *S* @param {object} result - The result from executeJob ({success, output}).
 */
export function finalizeJob(job, result) {
  // --- STATEMENTS MOVED FROM TOP LEVEL ---
  const updateCompleteStmt = db.prepare(
    "UPDATE jobs SET state = 'completed', output = ?, worker_id = NULL, updated_at = datetime('now', 'utc') WHERE id = ?"
  );
  const updateDeadStmt = db.prepare(
    "UPDATE jobs SET state = 'dead', output = ?, worker_id = NULL, updated_at = datetime('now', 'utc') WHERE id = ?"
  );
  const scheduleRetryStmt = db.prepare(
    "UPDATE jobs SET state = 'pending', attempts = ?, run_at = ?, output = ?, worker_id = NULL, updated_at = datetime('now', 'utc') WHERE id = ?"
  );
  // --- END MOVED STATEMENTS ---

  const config = loadConfig();

  const outputToBind = (result.output === undefined) ? null : result.output;

  try {
    if (result.success) {
      // 1. SUCCESS: Mark as 'completed'
      updateCompleteStmt.run(outputToBind, job.id);
      console.log(`[Worker] Job ${job.id} completed successfully.`);

    } else {
      // 2. FAILURE: Check retry logic
      const newAttempts = job.attempts + 1;
      
      if (newAttempts >= job.max_retries) {
        // 3. MOVE TO DLQ: Max retries exceeded
        updateDeadStmt.run(outputToBind, job.id);
        console.log(`[Worker] Job ${job.id} failed permanently (moved to DLQ).`);
      } else {
        // 4. RETRY: Schedule with exponential backoff
        const delayInSeconds = Math.pow(config.backoff_base, newAttempts);
        const newRunAt = new Date(Date.now() + delayInSeconds * 1000);
        
        const newRunAtString = newRunAt.toISOString()
          .slice(0, 19)
          .replace('T', ' ');
            
        scheduleRetryStmt.run(newAttempts, newRunAtString, outputToBind, job.id);
        console.log(`[Worker] Job ${job.id} failed. Retrying in ${delayInSeconds}s (attempt ${newAttempts}).`);
      }
    }
  } catch (err) {
    console.error(`[Worker] CRITICAL: Failed to update job ${job.id} status.`, err);
  }
}