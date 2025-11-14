import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';

// 1. Define paths
const APP_DIR = path.join(os.homedir(), '.queuectl');
const DB_PATH = path.join(APP_DIR, 'queue.db');
const CONFIG_PATH = path.join(APP_DIR, 'config.json');

// 2. Ensure the app directory exists
fs.mkdirSync(APP_DIR, { recursive: true });

// 3. Default configuration
const DEFAULT_CONFIG = {
  max_retries: 3,
  backoff_base: 2,
};

// 4. Initialize and export the database connection
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// 5. Function to initialize the database schema
export function initDb() {
  const createJobsTable = `
    CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        command TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL,
        created_at DATETIME DEFAULT (datetime('now', 'utc')),
        updated_at DATETIME DEFAULT (datetime('now', 'utc')),
        worker_id TEXT,
        run_at DATETIME DEFAULT (datetime('now', 'utc')),
        output TEXT
    );
  `;
  
  const createWorkersTable = `
    CREATE TABLE IF NOT EXISTS workers (
        worker_id TEXT PRIMARY KEY,
        pid INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        last_heartbeat DATETIME DEFAULT (datetime('now', 'utc'))
    );
  `;
  
  const createJobIndex = `
    CREATE INDEX IF NOT EXISTS idx_job_state_run_at 
    ON jobs (state, run_at);
  `;
  
  db.exec(createJobsTable);
  db.exec(createWorkersTable);
  db.exec(createJobIndex);
}

// 6. Function to load configuration
export function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
  try {
    const configData = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(configData) };
  } catch (err) {
    console.error('Error loading config, using defaults:', err);
    return DEFAULT_CONFIG;
  }
}

// 7. Function to save configuration
export function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('Error saving config:', err);
  }
}

// 8. Export the db instance
export { db };


// --- FUNCTIONS WITH MOVED STATEMENTS ---

/**
 * Atomically claims the next available job.
 * @param {string} workerId - The ID of the worker claiming the job.
 * @returns {object | undefined} The job object if one was claimed, otherwise undefined.
 */
export function claimJob(workerId) {
  // MOVED from top level
  const claimJobStmt = db.prepare(
    `UPDATE jobs
     SET state = 'processing', worker_id = ?, updated_at = datetime('now', 'utc')
     WHERE id = (
         SELECT id
         FROM jobs
         WHERE state = 'pending'
         AND run_at <= datetime('now', 'utc')
         ORDER BY created_at ASC
         LIMIT 1
     )
     RETURNING *`
  );
  return claimJobStmt.get(workerId);
}

export function registerWorker(workerId, pid) {
  // MOVED from top level
  const registerWorkerStmt = db.prepare(
    "INSERT INTO workers (worker_id, pid, status) VALUES (?, ?, 'running')"
  );
  registerWorkerStmt.run(workerId, pid);
}

export function getWorkerStatus(workerId) {
  // MOVED from top level
  const getWorkerStatusStmt = db.prepare("SELECT status FROM workers WHERE worker_id = ?");
  return getWorkerStatusStmt.get(workerId)?.status;
}

export function removeWorker(workerId) {
  // MOVED from top level
  const removeWorkerStmt = db.prepare("DELETE FROM workers WHERE worker_id = ?");
  removeWorkerStmt.run(workerId);
}

export function stopAllWorkers() {
  // MOVED from top level
  const stopAllWorkersStmt = db.prepare("UPDATE workers SET status = 'stopping' WHERE status = 'running'");
  stopAllWorkersStmt.run();
  console.log('Signal sent to all workers to stop gracefully.');
}