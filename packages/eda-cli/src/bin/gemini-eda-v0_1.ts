#!/usr/bin/env node

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Global command entry point for gemini-eda-v0_1
 * 
 * This script provides an EDA extension to the main Gemini CLI that can be 
 * installed globally and invoked directly as `gemini-eda-v0_1`.
 */

import { spawn } from 'child_process';

/**
 * Main entry point that launches Gemini CLI with EDA mode enabled
 */
async function main(): Promise<void> {
  try {
    // Set environment variable to indicate EDA mode
    process.env['GEMINI_EDA_MODE'] = 'true';
    
    // Set a custom title to indicate EDA mode
    process.env['GEMINI_CLI_TITLE'] = 'Gemini EDA CLI';
    
    console.log('Starting Gemini EDA CLI with environment:', {
      GEMINI_EDA_MODE: process.env['GEMINI_EDA_MODE'],
      CLI_TITLE: process.env['GEMINI_CLI_TITLE']
    });
    
    // Launch the main Gemini CLI with EDA commands available
    const geminiProcess = spawn('npx', ['@google/gemini-cli'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        GEMINI_EDA_MODE: 'true',
        CLI_TITLE: 'Gemini EDA CLI'
      }
    });
    
    geminiProcess.on('close', (code) => {
      process.exit(code || 0);
    });
    
    geminiProcess.on('error', (error) => {
      console.error(`Error starting Gemini CLI: ${error}`);
      process.exit(1);
    });
    
  } catch (error) {
    console.error(`Error starting Gemini EDA CLI: ${error}`);
    process.exit(1);
  }
}

// Run the main function
main().catch((error) => {
  console.error(`Unhandled error: ${error}`);
  process.exit(1);
});
