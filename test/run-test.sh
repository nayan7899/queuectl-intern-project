#!/bin/bash

echo "--- Starting QueueCTL Core Flow Test ---"

# --- 1. SETUP: Clean state ---
echo "[1/6] Cleaning database..."
# The easiest way to reset is to just delete the db file.
rm -f ~/.queuectl/queue.db
# Re-init the db by running a simple command (like config)
queuectl config list > /dev/null
# Set retries to 1 so DLQ happens fast
queuectl config set max_retries 1

# --- 2. ENQUEUE: Add jobs for all scenarios ---
echo "[2/6] Enqueuing test jobs..."
queuectl enqueue '{"id":"test-success", "command":"echo success"}'
queuectl enqueue '{"id":"test-fail-dlq", "command":"exit 1"}'
queuectl enqueue '{"id":"test-invalid-dlq", "command":"invalid_command_asdf"}'

# --- 3. RUN: Start worker in background ---
echo "[3/6] Starting worker in background..."
# Start the worker and redirect its output to a log file
queuectl worker start > worker.log 2>&1 &
WORKER_PID=$!

# --- 4. WAIT: Give time for processing ---
# We need to wait for:
# - Job 1 to complete (0s)
# - Job 2 to fail (0s) + retry (2^1 = 2s) + fail again (0s)
# - Job 3 to fail (0s) + retry (2^1 = 2s) + fail again (0s)
# A 10-second buffer should be more than enough.
echo "[4/6] Waiting 10s for worker to process all jobs..."
sleep 10

# --- 5. VERIFY: Check the final state of all jobs ---
echo "[5/6] Verifying job states..."
TEST_PASSED=true

# Check for success job
if ! queuectl list --state completed | grep -q "test-success"; then
  echo "❌ TEST FAILED: 'test-success' job did not complete."
  TEST_PASSED=false
fi

# Check for failed job
if ! queuectl list --state dead | grep -q "test-fail-dlq"; then
  echo "❌ TEST FAILED: 'test-fail-dlq' job did not move to DLQ."
  TEST_PASSED=false
fi

# Check for invalid job
if ! queuectl list --state dead | grep -q "test-invalid-dlq"; then
  echo "❌ TEST FAILED: 'test-invalid-dlq' job did not move to DLQ."
  TEST_PASSED=false
fi

# --- 6. CLEANUP: Stop the worker ---
echo "[6/6] Stopping worker..."
queuectl worker stop
# Give it a moment to shut down
sleep 2

# Clean up log file
rm -f worker.log

# --- FINAL RESULT ---
if $TEST_PASSED; then
  echo ""
  echo "✅ All core flow tests passed!"
  exit 0
else
  echo ""
  echo "❌ One or more tests failed."
  exit 1
fi