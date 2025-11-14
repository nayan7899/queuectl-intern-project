import { Command } from 'commander';

// 1. Import all your command-registering functions FIRST.
// These are just function definitions, so it's safe.
import { registerEnqueueCommand } from './commands/enqueue.js';
import { registerWorkerCommand } from './commands/worker.js';
// (You will add the others here)
import { registerStatusCommand } from './commands/status.js';
import { registerListCommand } from './commands/list.js';
import { registerDlqCommand } from './commands/dlq.js';
import { registerConfigCommand } from './commands/config.js';


// 2. Now, create and export the program.
// This line MUST be before you call the register functions.
export const program = new Command();

program
  .name('queuectl')
  .description('A CLI based background job queue system')
  .version('1.0.0');


// 3. Finally, call all the functions to attach the commands.
registerEnqueueCommand(program);
registerWorkerCommand(program);
registerStatusCommand(program);
registerListCommand(program);
registerDlqCommand(program);
registerConfigCommand(program);