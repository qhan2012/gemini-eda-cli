/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { hostname } from 'os';
import type { 
  EdaCommandContext, 
  EdaCommandResult, 
  EdaCommandOptions,
  EdaResult,
  EdaBaseline,
  EdaVerificationResult
} from './types.js';
import { YosysParser } from './parser.js';
import { EdaValidator } from './validation.js';
import { 
  EDA_BASELINE_FILE, 
  EDA_RESULT_FILE, 
  EDA_LOG_FILE, 
  DEFAULT_RECIPE_NAME, 
  DEFAULT_RECIPE_CONTENT,
  EDA_VERSION 
} from './types.js';

/**
 * Core EDA command implementations.
 * 
 * This module contains all the /eda:commands that can be executed
 * in the EDA REPL mode.
 */
export class EdaCommands {
  /**
   * Shows help information for EDA commands.
   */
  static async help(context: EdaCommandContext, args: string[], options: EdaCommandOptions): Promise<EdaCommandResult> {
    const helpText = `
EDA Commands:
  /eda:help                    Show this help message
  /eda:recipe:init [--force]   Create recipes/ directory and sample script
  /eda:recipe:list             List available recipe files
  /eda:run [script] [--seed N] Run Yosys with script (default: recipes/synth_resyn2.ys)
  /eda:baseline:seed           Save last run as baseline for verification
  /eda:verify                  Compare QoR metrics against baseline
  /eda:last                    Show last run result and summary

Options:
  --force    Overwrite existing files
  --seed N   Set random seed for synthesis
  --verbose  Show detailed output

Examples:
  /eda:recipe:init
  /eda:run recipes/synth_resyn2.ys --seed 1
  /eda:baseline:seed
  /eda:run recipes/synth_resyn2.ys --seed 2
  /eda:verify
`;

    return {
      success: true,
      message: helpText.trim(),
    };
  }

  /**
   * Initializes the recipes directory and creates a sample script.
   */
  static async recipeInit(context: EdaCommandContext, args: string[], options: EdaCommandOptions): Promise<EdaCommandResult> {
    try {
      // Ensure recipes directory exists
      await EdaValidator.ensureDirectories(context);

      const recipePath = join(context.recipesDir, DEFAULT_RECIPE_NAME);
      
      // Check if recipe already exists
      if (await EdaValidator.fileExists(recipePath)) {
        if (!options.force) {
          return {
            success: false,
            message: `${DEFAULT_RECIPE_NAME} already exists. Use /eda:recipe:init --force to overwrite.`,
            exitCode: 1,
          };
        }
      }

      // Create the recipe file
      await fs.writeFile(recipePath, DEFAULT_RECIPE_CONTENT, 'utf-8');

      return {
        success: true,
        message: `Created ${recipePath}`,
      };

    } catch (error) {
      return {
        success: false,
        message: `Error creating recipe: ${error}`,
        exitCode: 1,
      };
    }
  }

  /**
   * Lists available recipe files.
   */
  static async recipeList(context: EdaCommandContext, args: string[], options: EdaCommandOptions): Promise<EdaCommandResult> {
    try {
      const recipes = await EdaValidator.listRecipes(context);

      if (recipes.length === 0) {
        return {
          success: true,
          message: 'No recipe files found. Run /eda:recipe:init to create one.',
        };
      }

      const recipeList = recipes.map((recipe, index) => {
        const timestamp = recipe.lastModified.toISOString().split('T')[0];
        return `${index + 1}. ${recipe.name} (${timestamp})`;
      }).join('\n');

      return {
        success: true,
        message: `Available recipes:\n${recipeList}`,
      };

    } catch (error) {
      return {
        success: false,
        message: `Error listing recipes: ${error}`,
        exitCode: 1,
      };
    }
  }

  /**
   * Runs Yosys with the specified script.
   */
  static async run(context: EdaCommandContext, args: string[], options: EdaCommandOptions): Promise<EdaCommandResult> {
    try {
      // Determine script path
      const scriptPath = args.length > 0 ? resolve(args[0]) : join(context.recipesDir, DEFAULT_RECIPE_NAME);

      // Validate script exists
      const scriptValidation = await EdaValidator.validateRecipeFile(scriptPath);
      if (!scriptValidation.valid) {
        return {
          success: false,
          message: scriptValidation.errors.join('\n'),
          exitCode: 1,
        };
      }

      // Validate directory structure
      const dirValidation = await EdaValidator.validateDirectoryStructure(context);
      if (!dirValidation.valid) {
        return {
          success: false,
          message: dirValidation.errors.join('\n'),
          exitCode: 1,
        };
      }

      // Check if Yosys is available
      if (!(await YosysParser.isYosysAvailable())) {
        return {
          success: false,
          message: 'Yosys not found. Please install Yosys and ensure it is on your PATH.',
          exitCode: 1,
        };
      }

      // Ensure build directory exists
      await EdaValidator.ensureDirectories(context);

      // Run Yosys
      const startTime = Date.now();
      const result = await this.runYosys(scriptPath, options.seed);
      const duration = Date.now() - startTime;

      // Add duration to result
      const yosysOutput = { ...result, duration };

      // Parse metrics
      const metrics = YosysParser.parseMetrics(yosysOutput);
      if (!metrics) {
        return {
          success: false,
          message: 'Failed to parse Yosys output. Check the log file for details.',
          exitCode: 1,
        };
      }

      // Get Yosys version
      const yosysVersion = await YosysParser.getYosysVersion();

      // Create result object
      const edaResult: EdaResult = {
        provenance: {
          tool: 'yosys',
          tool_version: yosysVersion || 'unknown',
          git_commit: await this.getGitCommit(),
          timestamp_utc: new Date().toISOString(),
          host: hostname(),
          os: `${process.platform}-${process.arch}`,
          gemini_eda_version: EDA_VERSION,
        },
        run: {
          script_path: scriptPath,
          seed: options.seed || null,
          cwd: context.cwd,
          cmd: `yosys -s ${scriptPath}`,
          duration_ms: duration,
          exit_code: result.exitCode,
        },
        metrics: {
          ...metrics,
          wns_ns: null,
          tns_ns: null,
          utilization_pct: null,
        },
        artifacts: {
          log_path: join(context.logsDir, EDA_LOG_FILE),
          output_netlist: await this.extractOutputNetlist(scriptPath),
        },
      };

      // Save result
      const resultPath = join(context.lastRunDir, EDA_RESULT_FILE);
      await fs.writeFile(resultPath, JSON.stringify(edaResult, null, 2), 'utf-8');

      // Save log
      const logPath = join(context.logsDir, EDA_LOG_FILE);
      await fs.writeFile(logPath, `${result.stdout}\n\n--- STDERR ---\n${result.stderr}`, 'utf-8');

      return {
        success: true,
        message: `✅ Wrote ${resultPath}`,
        data: edaResult,
      };

    } catch (error) {
      return {
        success: false,
        message: `Error running Yosys: ${error}`,
        exitCode: 1,
      };
    }
  }

  /**
   * Saves the last run as baseline for verification.
   */
  static async baselineSeed(context: EdaCommandContext, args: string[], options: EdaCommandOptions): Promise<EdaCommandResult> {
    try {
      const resultPath = join(context.lastRunDir, EDA_RESULT_FILE);
      
      if (!(await EdaValidator.fileExists(resultPath))) {
        return {
          success: false,
          message: 'No baseline found. Run /eda:baseline:seed after a successful /eda:run.',
          exitCode: 1,
        };
      }

      const resultContent = await fs.readFile(resultPath, 'utf-8');
      const result: EdaResult = JSON.parse(resultContent);

      const baseline: EdaBaseline = {
        metrics: result.metrics,
        timestamp_utc: result.provenance.timestamp_utc,
        run_info: {
          script_path: result.run.script_path,
          seed: result.run.seed,
        },
      };

      const baselinePath = join(context.edaDir, EDA_BASELINE_FILE);
      await fs.writeFile(baselinePath, JSON.stringify(baseline, null, 2), 'utf-8');

      return {
        success: true,
        message: '✔ Baseline saved',
      };

    } catch (error) {
      return {
        success: false,
        message: `Error saving baseline: ${error}`,
        exitCode: 1,
      };
    }
  }

  /**
   * Verifies QoR metrics against baseline.
   */
  static async verify(context: EdaCommandContext, args: string[], options: EdaCommandOptions): Promise<EdaCommandResult> {
    try {
      const baselinePath = join(context.edaDir, EDA_BASELINE_FILE);
      const resultPath = join(context.lastRunDir, EDA_RESULT_FILE);

      // Check if baseline exists
      if (!(await EdaValidator.fileExists(baselinePath))) {
        return {
          success: false,
          message: 'No baseline found. Run /eda:baseline:seed after a successful /eda:run.',
          exitCode: 1,
        };
      }

      // Check if last run exists
      if (!(await EdaValidator.fileExists(resultPath))) {
        return {
          success: false,
          message: 'No last run found. Run /eda:run first.',
          exitCode: 1,
        };
      }

      // Load baseline and result
      const baselineContent = await fs.readFile(baselinePath, 'utf-8');
      const resultContent = await fs.readFile(resultPath, 'utf-8');
      
      const baseline: EdaBaseline = JSON.parse(baselineContent);
      const result: EdaResult = JSON.parse(resultContent);

      // Perform verification
      const verification = this.performVerification(baseline.metrics, result.metrics);

      return {
        success: verification.accepted,
        message: verification.message,
        data: verification,
        exitCode: verification.accepted ? 0 : 1,
      };

    } catch (error) {
      return {
        success: false,
        message: `Error during verification: ${error}`,
        exitCode: 1,
      };
    }
  }

  /**
   * Shows the last run result and summary.
   */
  static async last(context: EdaCommandContext, args: string[], options: EdaCommandOptions): Promise<EdaCommandResult> {
    try {
      const resultPath = join(context.lastRunDir, EDA_RESULT_FILE);
      
      if (!(await EdaValidator.fileExists(resultPath))) {
        return {
          success: false,
          message: 'No last run found. Run /eda:run first.',
          exitCode: 1,
        };
      }

      const resultContent = await fs.readFile(resultPath, 'utf-8');
      const result: EdaResult = JSON.parse(resultContent);

      const summary = `
Last Run Summary:
  Script: ${result.run.script_path}
  Seed: ${result.run.seed || 'N/A'}
  Duration: ${result.run.duration_ms}ms
  Exit Code: ${result.run.exit_code}
  
Metrics:
  Cells: ${result.metrics.cells}
  Levels: ${result.metrics.levels}
  Area: ${result.metrics.area_um2 ? `${result.metrics.area_um2} um²` : 'N/A'}
  Warnings: ${result.metrics.warnings || 0}
  
Timestamp: ${result.provenance.timestamp_utc}
Yosys Version: ${result.provenance.tool_version}
`.trim();

      return {
        success: true,
        message: summary,
        data: result,
      };

    } catch (error) {
      return {
        success: false,
        message: `Error reading last run: ${error}`,
        exitCode: 1,
      };
    }
  }

  /**
   * Runs Yosys with the specified script and seed.
   */
  private static async runYosys(scriptPath: string, seed?: number): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
      const args = ['-s', scriptPath];
      if (seed !== undefined) {
        args.push('-p', `abc -script +resyn2 -seed ${seed}`);
      }

      const process = spawn('yosys', args, {
        stdio: 'pipe',
        timeout: 30 * 60 * 1000, // 30 minutes
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code || 0,
        });
      });

      process.on('error', (error) => {
        resolve({
          stdout,
          stderr: error.message,
          exitCode: 1,
        });
      });
    });
  }

  /**
   * Performs QoR verification against baseline.
   */
  private static performVerification(baseline: any, current: any): EdaVerificationResult {
    const cellsDelta = current.cells - baseline.cells;
    const cellsDeltaPct = (cellsDelta / baseline.cells) * 100;
    const levelsDelta = current.levels - baseline.levels;

    // Verification rule: Accept iff levels_now ≤ levels_base and cells_now ≤ cells_base
    const levelsOk = current.levels <= baseline.levels;
    const cellsOk = current.cells <= baseline.cells;

    const accepted = levelsOk && cellsOk;

    const message = `
cells  base: ${baseline.cells}  now: ${current.cells}
levels base: ${baseline.levels}     now: ${current.levels}
${accepted ? '✅ Accepted' : '❌ Rejected'}
`.trim();

    return {
      accepted,
      cells: {
        base: baseline.cells,
        now: current.cells,
        delta: cellsDelta,
        delta_pct: cellsDeltaPct,
      },
      levels: {
        base: baseline.levels,
        now: current.levels,
        delta: levelsDelta,
      },
      message,
    };
  }

  /**
   * Gets the current git commit hash.
   */
  private static async getGitCommit(): Promise<string | null> {
    try {
      const { exec } = await import('child_process');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync('git rev-parse HEAD');
      return stdout.trim();
    } catch {
      return null;
    }
  }

  /**
   * Extracts output netlist path from script content.
   */
  private static async extractOutputNetlist(scriptPath: string): Promise<string | null> {
    try {
      const content = await fs.readFile(scriptPath, 'utf-8');
      const match = content.match(/write_verilog.*?(\S+\.v)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
}
