/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { join } from 'path';
import type { EdaCommandContext, EdaCommandOptions } from './types.js';
import { EdaCommands } from './commands.js';
import { EDA_DIR_NAME, EDA_LOGS_DIR, EDA_LAST_RUN_DIR, EDA_RECIPES_DIR, EDA_RTL_DIR, EDA_BUILD_DIR } from './types.js';

/**
 * Main EDA CLI integration module.
 * 
 * This module provides the integration between the EDA CLI functionality
 * and the main Gemini CLI, including command registration and REPL mode activation.
 */
export class EdaCli {
  private static isEdaMode = false;

  /**
   * Activates EDA REPL mode.
   * This should be called when the user runs `gemini gemini-eda-v0_1`.
   */
  static async activateEdaMode(): Promise<void> {
    this.isEdaMode = true;
    console.log('Welcome to gemini-eda (synthesis-only REPL mode). Type /help for commands.');
  }

  /**
   * Checks if EDA mode is currently active.
   */
  static isEdaModeActive(): boolean {
    return this.isEdaMode;
  }

  /**
   * Creates the EDA command context for the current directory.
   */
  static async createEdaContext(cwd: string): Promise<EdaCommandContext> {
    const edaDir = join(cwd, EDA_DIR_NAME);
    const logsDir = join(edaDir, EDA_LOGS_DIR);
    const lastRunDir = join(edaDir, EDA_LAST_RUN_DIR);
    const recipesDir = join(cwd, EDA_RECIPES_DIR);
    const rtlDir = join(cwd, EDA_RTL_DIR);
    const buildDir = join(cwd, EDA_BUILD_DIR);

    return {
      cwd,
      edaDir,
      logsDir,
      lastRunDir,
      recipesDir,
      rtlDir,
      buildDir,
    };
  }

  /**
   * Parses command arguments and options.
   */
  static parseArgs(args: string): { command: string; args: string[]; options: EdaCommandOptions } {
    const parts = args.trim().split(/\s+/);
    const command = parts[0] || '';
    const remaining = parts.slice(1);
    
    const parsedArgs: string[] = [];
    const options: EdaCommandOptions = {};

    for (let i = 0; i < remaining.length; i++) {
      const arg = remaining[i];
      
      if (arg === '--force') {
        options.force = true;
      } else if (arg === '--verbose') {
        options.verbose = true;
      } else if (arg === '--seed' && i + 1 < remaining.length) {
        options.seed = parseInt(remaining[i + 1], 10);
        i++; // Skip the next argument as it's the seed value
      } else if (arg.startsWith('--seed=')) {
        options.seed = parseInt(arg.split('=')[1], 10);
      } else {
        parsedArgs.push(arg);
      }
    }

    return { command, args: parsedArgs, options };
  }

  /**
   * Handles EDA commands in the REPL.
   */
  static async handleEdaCommand(context: any, args: string): Promise<void> {
    const edaContext = await this.createEdaContext(context.services.config?.getCwd() || process.cwd());
    const { command, args: commandArgs, options } = this.parseArgs(args);

    let result;
    
    switch (command) {
      case 'help':
        result = await EdaCommands.help(edaContext, commandArgs, options);
        break;
      case 'recipe':
        if (commandArgs[0] === 'init') {
          result = await EdaCommands.recipeInit(edaContext, commandArgs.slice(1), options);
        } else if (commandArgs[0] === 'list') {
          result = await EdaCommands.recipeList(edaContext, commandArgs.slice(1), options);
        } else {
          result = {
            success: false,
            message: 'Unknown recipe command. Use /eda:recipe:init or /eda:recipe:list.',
            exitCode: 1,
          };
        }
        break;
      case 'run':
        result = await EdaCommands.run(edaContext, commandArgs, options);
        break;
      case 'baseline':
        if (commandArgs[0] === 'seed') {
          result = await EdaCommands.baselineSeed(edaContext, commandArgs.slice(1), options);
        } else {
          result = {
            success: false,
            message: 'Unknown baseline command. Use /eda:baseline:seed.',
            exitCode: 1,
          };
        }
        break;
      case 'verify':
        result = await EdaCommands.verify(edaContext, commandArgs, options);
        break;
      case 'last':
        result = await EdaCommands.last(edaContext, commandArgs, options);
        break;
      default:
        result = {
          success: false,
          message: `Unknown EDA command: ${command}. Use /eda:help for available commands.`,
          exitCode: 1,
        };
    }

    // Display result
    if (result.message) {
      context.ui.addItem({
        type: result.success ? 'info' : 'error',
        text: result.message,
      }, Date.now());
    }

    // Set exit code if command failed
    if (!result.success && result.exitCode) {
      process.exitCode = result.exitCode;
    }
  }

  /**
   * Creates the EDA slash command for integration with Gemini CLI.
   */
  static createEdaSlashCommand(): any {
    return {
      name: 'eda',
      description: 'EDA synthesis commands (run, verify, recipe management)',
      kind: 'built-in',
      action: async (context: any, args: string) => {
        // Extract the subcommand and arguments
        const trimmedArgs = args.trim();
        if (!trimmedArgs) {
          // Show help if no arguments
          await this.handleEdaCommand(context, 'help');
          return;
        }

        await this.handleEdaCommand(context, trimmedArgs);
      },
      subCommands: [
        {
          name: 'help',
          description: 'Show EDA command help',
          kind: 'built-in',
          action: async (context: any, args: string) => {
            await this.handleEdaCommand(context, 'help');
          },
        },
        {
          name: 'recipe',
          description: 'Manage synthesis recipes',
          kind: 'built-in',
          subCommands: [
            {
              name: 'init',
              description: 'Create recipes directory and sample script',
              kind: 'built-in',
              action: async (context: any, args: string) => {
                await this.handleEdaCommand(context, `recipe init ${args}`);
              },
            },
            {
              name: 'list',
              description: 'List available recipe files',
              kind: 'built-in',
              action: async (context: any, args: string) => {
                await this.handleEdaCommand(context, 'recipe list');
              },
            },
          ],
        },
        {
          name: 'run',
          description: 'Run Yosys synthesis',
          kind: 'built-in',
          action: async (context: any, args: string) => {
            await this.handleEdaCommand(context, `run ${args}`);
          },
        },
        {
          name: 'baseline',
          description: 'Manage QoR baselines',
          kind: 'built-in',
          subCommands: [
            {
              name: 'seed',
              description: 'Save last run as baseline',
              kind: 'built-in',
              action: async (context: any, args: string) => {
                await this.handleEdaCommand(context, 'baseline seed');
              },
            },
          ],
        },
        {
          name: 'verify',
          description: 'Verify QoR against baseline',
          kind: 'built-in',
          action: async (context: any, args: string) => {
            await this.handleEdaCommand(context, 'verify');
          },
        },
        {
          name: 'last',
          description: 'Show last run results',
          kind: 'built-in',
          action: async (context: any, args: string) => {
            await this.handleEdaCommand(context, 'last');
          },
        },
      ],
    };
  }

  /**
   * Creates a sub-command for activating EDA mode.
   * This should be registered as a sub-command in the main CLI.
   */
  static createEdaModeCommand(): any {
    return {
      name: 'gemini-eda-v0_1',
      description: 'Activate EDA synthesis REPL mode',
      kind: 'built-in',
      action: async (context: any, args: string) => {
        await this.activateEdaMode();
        
        // Add the EDA command to the available commands
        context.ui.reloadCommands();
        
        context.ui.addItem({
          type: 'info',
          text: 'EDA mode activated. Use /eda:commands for synthesis operations.',
        }, Date.now());
      },
    };
  }
}
