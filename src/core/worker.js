import { v4 as uuidv4 } from 'uuid';
import { db, registerWorker, getWorkerStatus, removeWorker, claimJob } from './db.js';
import { executeJob } from './runner.js';
import { finalizeJob } from './manager.js';

// Helper function for sleeping
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class Worker {
  constructor() {
    this.workerId = uuidv4();
    this.pid = process.pid;
    this.isShuttingDown = false;
    this.isBusy = false; // Tracks if currently processing a job
    
    console.log(`[Worker ${this.workerId}] Starting up (PID: ${this.pid})...`);
  }

  // Main entry point
  async start() {
    try {
      registerWorker(this.workerId, this.pid);
      this.setupSignalHandlers();
      await this.pollLoop();
    } catch (err) {
      console.error(`[Worker ${this.workerId}] Unhandled error:`, err);
    } finally {
      await this.shutdown();
    }
  }

  // The main loop
  async pollLoop() {
    console.log(`[Worker ${this.workerId}] Polling for jobs...`);
    
    while (!this.isShuttingDown) {
      // 1. Check for shutdown signal from 'worker stop' command
      const status = getWorkerStatus(this.workerId);
      if (status === 'stopping') {
        this.isShuttingDown = true;
        continue; // Go to end of loop
      }

      // 2. Try to claim a job (ATOMIC)
      this.isBusy = true;
      let job;
      try {
        job = claimJob(this.workerId);
      } catch (err) {
        console.error(`[Worker ${this.workerId}] Error claiming job:`, err);
        job = undefined; // Ensure job is undefined on error
      }
      this.isBusy = false;

      if (job) {
        // 3. We got a job! Process it.
        console.log(`[Worker ${this.workerId}] Claimed job ${job.id}: ${job.command}`);
        this.isBusy = true;
        const result = await executeJob(job.command);
        
        // 4. Finalize the job (success, fail, or dlq)
        finalizeJob(job, result);
        this.isBusy = false;
        
      } else {
        // 5. No jobs found. Sleep to prevent busy-looping.
        await sleep(2000); // Poll every 2 seconds
      }
    }
    
    console.log(`[Worker ${this.workerId}] Shutdown signal received.`);
  }

  // Handle Ctrl+C (SIGINT)
  setupSignalHandlers() {
    process.on('SIGINT', () => {
      console.log(`[Worker ${this.workerId}] SIGINT received. Shutting down...`);
      this.isShuttingDown = true;
    });
    process.on('SIGTERM', () => {
      console.log(`[Worker ${this.workerId}] SIGTERM received. Shutting down...`);
      this.isShuttingDown = true;
    });
  }

  // Cleanup
  async shutdown() {
    // If we were busy, the loop already exited.
    // If we were idle, this ensures we stop.
    if (this.isShuttingDown) {
      console.log(`[Worker ${this.workerId}] Cleaning up and exiting.`);
      removeWorker(this.workerId);
      process.exit(0);
    }
  }
}