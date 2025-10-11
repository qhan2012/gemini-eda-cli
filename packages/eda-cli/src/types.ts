/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Core types for the Gemini EDA CLI package.
 * These types define the structure for EDA-specific commands and data.
 */

export interface EdaProvenance {
  tool: 'yosys';
  tool_version: string;
  git_commit: string | null;
  timestamp_utc: string; // ISO 8601
  host: string;
  os: string; // platform/arch
  gemini_eda_version: string;
}

export interface EdaRun {
  script_path: string;
  seed: number | null;
  cwd: string;
  cmd: string;
  duration_ms: number;
  exit_code: number;
}

export interface EdaMetrics {
  cells: number;
  levels: number;
  area_um2: number | null;
  warnings: number | null;
  // Reserved for future P&R
  wns_ns: number | null;
  tns_ns: number | null;
  utilization_pct: number | null;
}

export interface EdaArtifacts {
  log_path: string;
  output_netlist: string | null;
}

export interface EdaResult {
  provenance: EdaProvenance;
  run: EdaRun;
  metrics: EdaMetrics;
  artifacts: EdaArtifacts;
}

export interface EdaBaseline {
  metrics: EdaMetrics;
  timestamp_utc: string;
  run_info: {
    script_path: string;
    seed: number | null;
  };
}

export interface EdaVerificationResult {
  accepted: boolean;
  cells: {
    base: number;
    now: number;
    delta: number;
    delta_pct: number;
  };
  levels: {
    base: number;
    now: number;
    delta: number;
  };
  message: string;
}

export interface EdaCommandContext {
  cwd: string;
  edaDir: string;
  logsDir: string;
  lastRunDir: string;
  recipesDir: string;
  rtlDir: string;
  buildDir: string;
}

export interface EdaRecipe {
  name: string;
  path: string;
  lastModified: Date;
  content: string;
}

export interface EdaValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface EdaYosysOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export interface EdaParsedMetrics {
  cells: number;
  levels: number;
  area_um2: number | null;
  warnings: number | null;
}

export interface EdaCommandOptions {
  force?: boolean;
  seed?: number;
  verbose?: boolean;
}

export type EdaCommandHandler = (
  context: EdaCommandContext,
  args: string[],
  options: EdaCommandOptions
) => Promise<EdaCommandResult>;

export interface EdaCommandResult {
  success: boolean;
  message: string;
  data?: unknown;
  exitCode?: number;
}

export const EDA_DIR_NAME = '.gemini_eda';
export const EDA_LOGS_DIR = 'logs';
export const EDA_LAST_RUN_DIR = 'last_run';
export const EDA_RECIPES_DIR = 'recipes';
export const EDA_RTL_DIR = 'rtl';
export const EDA_BUILD_DIR = 'build';
export const EDA_BASELINE_FILE = 'baseline.json';
export const EDA_RESULT_FILE = 'result.json';
export const EDA_LOG_FILE = 'yosys.log';

export const DEFAULT_RECIPE_NAME = 'synth_resyn2.ys';
export const DEFAULT_RECIPE_CONTENT = `# Sample Yosys synthesis script for resyn2 optimization
# This script reads Verilog files from rtl/ and performs synthesis with resyn2

# Read Verilog files from rtl directory
read_verilog rtl/top.v

# Set top module
hierarchy -top top

# Synthesize to generic gates
synth

# Optimize with resyn2 algorithm
#abc -script +resyn2

# Print statistics
stat

# Write synthesized netlist
write_verilog -noattr build/top.synth.v

# Optional: Write JSON netlist for further processing
# write_json build/top.synth.json`;

export const EDA_VERSION = 'v0.7';
