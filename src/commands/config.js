import { loadConfig, saveConfig } from '../core/db.js';

export function registerConfigCommand(program) {
  // Create the parent 'config' command
  const configCommand = program.command('config')
    .description('Manage system configuration');

  // config set <key> <value>
  configCommand
    .command('set <key> <value>')
    .description('Set a configuration value (e.g., max_retries, backoff_base)')
    .action((key, value) => {
      let config = loadConfig();

      
      
      // Check if the key is valid
      if (key !== 'max_retries' && key !== 'backoff_base' && key !== 'poll_interval_ms') {
        console.error(`Error: Unknown config key "${key}".`);
        console.log('Valid keys are: max_retries, backoff_base, poll_interval_ms');
        return;
      }
      
      // Convert value to a number if it's one of our known keys
      const numericValue = parseInt(value, 10);
      if (isNaN(numericValue)) {
        console.error(`Error: Value for "${key}" must be a number.`);
        return;
      }

      config[key] = numericValue;
      saveConfig(config);
      
      console.log(`✅ Config updated: ${key} = ${numericValue}`);
    });
  
  // config list (or 'status')
  configCommand
    .command('list')
    .description('Show the current configuration')
    .action(() => {
      const config = loadConfig();
      console.log('--- Current Configuration ---');
      console.table(config);
    });
}