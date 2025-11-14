import { exec } from 'child_process';
import util from 'util';

// Promisify 'exec' to use it with async/await
const execPromise = util.promisify(exec);

/**
 * Executes a shell command and returns its result.
 * @param {string} command - The command to execute (e.g., "echo hello").
 * @returns {Promise<{success: boolean, output: string}>}
 */
export async function executeJob(command) {
  try {
    // This will wait for the command to finish
    const { stdout, stderr } = await execPromise(command);

    // Explicitly convert stdout/stderr (which can be Buffers) to strings
    const outStr = String(stdout || '');
    const errStr = String(stderr || '');
    const output = outStr + errStr;
    
    // Exit code 0 == success
    // We combine stdout and stderr as 'output'
    return { success: true, output: output.trim() };
    
  } catch (error) {
    // A non-zero exit code will throw an error
    // 'error' object contains stdout, stderr, and the error message
    const outStr = String(error.stdout || '');
    const errStr = String(error.stderr || '');
    const msgStr = String(error.message || '');
    const output = outStr + errStr + msgStr;
    return { success: false, output: output.trim() };
  }
}