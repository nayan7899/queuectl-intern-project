QueueCTL - A CLI Background Job Queue System

QueueCTL is a minimal, production-grade background job queue system built with Node.js. It manages background jobs via CLI commands, runs worker processes to execute shell commands, handles automatic retries with exponential backoff, and maintains a Dead Letter Queue (DLQ) for permanently failed jobs.

This project was built as a solution for a backend developer internship assignment.

Features

Persistent Job Storage: Uses SQLite to ensure jobs and state persist across restarts.

Multiple Worker Support: Run multiple workers in parallel to process jobs.

Concurrency Safe: Workers use atomic database operations to claim jobs, preventing race conditions.

Retry & Backoff: Automatically retries failed jobs with configurable exponential backoff.

Dead Letter Queue (DLQ): Failed jobs are moved to a DLQ after exhausting all retries.

CLI Interface: All operations are managed via a clean, commander-based CLI.

Graceful Shutdown: Workers can be signaled to stop gracefully, finishing their current job before exiting.

CLI Demo

(Required)

[Click here to watch a live demo of QueueCTL in action](Paste your screen recording link here - e.g., Google Drive, Loom, YouTube)

🏛️ Architecture Overview

QueueCTL is built around a central SQLite database (queue.db) which acts as the single source of truth for all jobs, workers, and system state. This file-based database provides full ACID compliance, which is the key to managing concurrency.

Core Components

The CLI (queuectl): This is the user's entry point, built with commander. It's a stateless application. Short-lived commands (enqueue, list, status) connect to the database, perform an atomic operation, and exit.

The Database (queue.db): A single SQLite file stored in ~/.queuectl/queue.db. It contains a jobs table for the queue and a workers table to track active processes. Using SQLite's WAL (Write-Ahead Logging) mode allows for high read/write concurrency.

The Worker (queuectl worker start): This is a long-lived, stateful process. Each worker runs an independent poll loop.

Job Claiming: A worker "claims" a job using a single, atomic UPDATE ... WHERE id = (SELECT ... LIMIT 1) RETURNING * query. This finds the next available job and assigns the worker's ID in one operation, making it impossible for two workers to grab the same job.

Execution: The worker executes the job's command using Node.js's child_process.

Finalization: Based on the command's exit code, the worker updates the job's state to completed, failed (for retry), or dead (for DLQ).

Job Lifecycle

A job moves through a simple, robust state machine:

pending: The initial state. The job is waiting to be picked up.

processing: A worker has atomically "claimed" the job and is currently executing its command.

failed: The job's command exited with a non-zero code. It is put back into the pending state, but its attempts count is incremented and run_at is set to a future time based on exponential backoff (delay = base ^ attempts).

completed: The job's command exited with code 0. The lifecycle for this job is complete.

dead: The job failed and exhausted all max_retries. It is moved here to be inspected manually.

🚀 Setup and Installation

Prerequisites

Node.js (v18+ recommended)

npm (v9+)

(Optional) Git Bash for a Linux-like shell on Windows, which handles single-quotes for JSON correctly.

Installation

Clone the repository:

git clone [https://github.com/YOUR_USERNAME/queuectl.git](https://github.com/YOUR_USERNAME/queuectl.git)
cd queuectl


Install dependencies:

npm install


Link the CLI for global use:
This step creates a symbolic link, allowing you to run the queuectl command from anywhere in your terminal.

npm link


This will also install a queue.db file and config.json in your home directory (~/.queuectl/).

💻 Usage Examples

1. Enqueueing Jobs

Add new jobs to the queue. The only required field is "command".

# Enqueue a simple "echo" command
$ queuectl enqueue '{"command":"echo Hello World"}'
✅ Job enqueued successfully. ID: 8a4b...

# Enqueue a job that takes time
$ queuectl enqueue '{"command":"sleep 3"}'
✅ Job enqueued successfully. ID: 9b2c...

# Enqueue a job that will fail, with a custom ID and retry limit
$ queuectl enqueue '{"id":"job-fail-123", "command":"exit 1", "max_retries": 2}'
✅ Job enqueued successfully. ID: job-fail-123

# Enqueue an invalid command that will also fail
$ queuectl enqueue '{"command":"this_command_does_not_exist"}'
✅ Job enqueued successfully. ID: 4d5e...


Note: Windows PowerShell users must escape quotes: queuectl enqueue "{\"command\":\"echo hello\"}"

2. Starting and Stopping Workers

You must have at least one worker running to process jobs.

Terminal 1:

# Start a worker. It runs in the foreground.
$ queuectl worker start
[Worker 7866...] Starting up (PID: 1234)...
[Worker 7866...] Polling for jobs...

# (It will start processing jobs from step 1)
[Worker 7866...] Claimed job 8a4b...: echo Hello World
[Worker] Job 8a4b... completed successfully.
[Worker 7866...] Polling for jobs...
[Worker 7866...] Claimed job 9b2c...: sleep 3
...


To run multiple workers, simply open a new terminal and run queuectl worker start again.

Terminal 2:

# Signal all running workers to stop gracefully
$ queuectl worker stop
Signal sent to all workers to stop gracefully.


The worker in Terminal 1 will finish its current job, print a shutdown message, and exit.

3. Checking System Status

Get a high-level overview of the queue.

$ queuectl status
--- Job Summary ---
┌─────────┬───────┐
│ (index) │ count │
├─────────┼───────┤
│ pending │   2   │
│ dead    │   1   │
│ completed │ 1   │
└─────────┴───────┘

--- Worker Summary ---
┌─────────┬───────┐
│ (index) │ count │
├─────────┼───────┤
│ running │   1   │
└─────────┴───────┘


4. Listing Jobs

List all jobs in a specific state (defaults to pending).

# List completed jobs
$ queuectl list --state completed
--- Jobs (completed) ---
┌────────┬─────────────┬───────────┬──────────┬──────────────────────┐
│   id   │   command   │   state   │ attempts │      updated_at      │
├────────┼─────────────┼───────────┼──────────┼──────────────────────┤
│ 8a4b...│ echo Hello  │ completed │    0     │ 2025-11-11 10:30:01  │
│ 9b2c...│ sleep 3     │ completed │    0     │ 2025-11-11 10:30:04  │
└────────┴─────────────┴───────────┴──────────┴──────────────────────┘


5. Managing the Dead Letter Queue (DLQ)

Inspect and retry permanently failed jobs.

# First, list the jobs that failed
$ queuectl dlq list
--- Dead Letter Queue Jobs ---
┌─────────────┬───────────────────────────┬──────────────────────┬──────────────────────┐
│     id      │          command          │        output        │      updated_at      │
├─────────────┼───────────────────────────┼──────────────────────┼──────────────────────┤
│ job-fail-123│ exit 1                    │                      │ 2025-11-11 10:30:08  │
│ 4d5e...     │ this_command_does_not_exist │ /bin/sh: line 1: ... │ 2025-11-11 10:30:12  │
└─────────────┴───────────────────────────┴──────────────────────┴──────────────────────┘

# Retry one of the failed jobs
$ queuectl dlq retry job-fail-123
✅ Job job-fail-123 has been re-queued for retry.


Your running worker will now pick up job-fail-123 again.

6. Managing Configuration

View or update system configuration.

# See the current settings
$ queuectl config list
--- Current Configuration ---
┌──────────────┬────────┐
│   (index)    │ (value)│
├──────────────┼────────┤
│ max_retries  │    3   │
│ backoff_base │    2   │
└──────────────┴────────┘

# Change the number of max retries for new jobs
$ queuectl config set max_retries 5
✅ Config updated: max_retries = 5


🧪 Testing

A simple test script is provided to validate the core system flow.

Make sure no workers are running (queuectl worker stop).

Run the test script (requires Git Bash or a UNIX-like shell):

./test/run-test.sh


This script will:

Clear the database.

Enqueue a successful job, a job that retries then fails, and an invalid job.

Start a worker in the background.

Wait 10 seconds for all jobs to be processed.

Check the completed and dead lists to verify the jobs ended in the correct state.

Stop the background worker.

⚖️ Assumptions & Trade-offs

Database: SQLite was chosen for its simplicity and persistence. It provides excellent transaction support for atomic operations. The trade-off is that it's less suitable for massive-scale distributed systems than Redis or Kafka, but perfect for this assignment.

Worker Polling: Workers use a 2-second poll loop. This is simple to implement but may have up to a 2-second delay in job pickup. A more advanced system might use NOTIFY/LISTEN (e.g., in Postgres) or long-polling.

Job Output: Job output (stdout/stderr) is stored in the database. This is fine for small outputs but could be problematic for commands that generate gigabytes of logs.

Graceful Shutdown: worker stop sends a "stop" signal via the database. This works well but requires workers to be polling to see the signal. A SIGINT (Ctrl+C) to a specific worker will also trigger a graceful shutdown for that worker.