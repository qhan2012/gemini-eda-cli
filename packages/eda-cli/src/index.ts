/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Gemini EDA CLI Package
 * 
 * This package provides EDA synthesis functionality as an extension to the main Gemini CLI.
 * It includes Yosys integration, QoR verification, and recipe management.
 */

export { EdaCli } from './eda-cli.js';
export { EdaCommands } from './commands.js';
export { EdaValidator } from './validation.js';
export { YosysParser } from './parser.js';
export * from './types.js';

