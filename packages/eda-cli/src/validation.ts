/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import type { EdaCommandContext, EdaValidationResult, EdaRecipe } from './types.js';

/**
 * Validation utilities for EDA CLI operations.
 * 
 * This module provides functions to validate directory structure,
 * file existence, and recipe content for EDA operations.
 */
export class EdaValidator {
  /**
   * Validates the current directory structure for EDA operations.
   * 
   * @param context The EDA command context
   * @returns Validation result with errors and warnings
   */
  static async validateDirectoryStructure(context: EdaCommandContext): Promise<EdaValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if rtl/ directory exists
      try {
        const rtlStat = await fs.stat(context.rtlDir);
        if (!rtlStat.isDirectory()) {
          errors.push(`${context.rtlDir} exists but is not a directory`);
        }
      } catch {
        errors.push(`rtl/ directory not found. Create rtl/ and add your sources (e.g., rtl/top.v)`);
      }

      // Check if recipes/ directory exists
      try {
        const recipesStat = await fs.stat(context.recipesDir);
        if (!recipesStat.isDirectory()) {
          errors.push(`${context.recipesDir} exists but is not a directory`);
        }
      } catch {
        warnings.push(`recipes/ directory not found. Run /eda:recipe:init to create it`);
      }

      // Check if build/ directory exists (optional)
      try {
        const buildStat = await fs.stat(context.buildDir);
        if (!buildStat.isDirectory()) {
          warnings.push(`${context.buildDir} exists but is not a directory`);
        }
      } catch {
        // build/ directory is optional, no warning needed
      }

    } catch (error) {
      errors.push(`Error validating directory structure: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates that a recipe file exists and is readable.
   * 
   * @param recipePath Path to the recipe file
   * @returns Validation result
   */
  static async validateRecipeFile(recipePath: string): Promise<EdaValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const stat = await fs.stat(recipePath);
      if (!stat.isFile()) {
        errors.push(`${recipePath} exists but is not a file`);
      }
    } catch {
      errors.push(`Recipe file not found: ${recipePath}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates that a recipe file references the rtl/ directory.
   * 
   * @param recipePath Path to the recipe file
   * @returns Validation result
   */
  static async validateRecipeContent(recipePath: string): Promise<EdaValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const content = await fs.readFile(recipePath, 'utf-8');
      
      // Check if recipe references rtl/ directory
      if (!content.includes('rtl/')) {
        warnings.push(`Recipe does not reference rtl/ directory. Make sure it contains 'read_verilog rtl/...' commands`);
      }

      // Check for basic Yosys commands
      if (!content.includes('read_verilog')) {
        warnings.push(`Recipe does not contain 'read_verilog' command`);
      }

      if (!content.includes('synth')) {
        warnings.push(`Recipe does not contain 'synth' command`);
      }

      if (!content.includes('stat')) {
        warnings.push(`Recipe does not contain 'stat' command (needed for metrics)`);
      }

    } catch (error) {
      errors.push(`Error reading recipe file: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates that the baseline file exists and is valid JSON.
   * 
   * @param baselinePath Path to the baseline file
   * @returns Validation result
   */
  static async validateBaselineFile(baselinePath: string): Promise<EdaValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const content = await fs.readFile(baselinePath, 'utf-8');
      const baseline = JSON.parse(content);

      // Validate baseline structure
      if (!baseline.metrics || typeof baseline.metrics !== 'object') {
        errors.push('Baseline file is missing or invalid metrics section');
      } else {
        if (typeof baseline.metrics.cells !== 'number') {
          errors.push('Baseline metrics missing or invalid cells count');
        }
        if (typeof baseline.metrics.levels !== 'number') {
          errors.push('Baseline metrics missing or invalid levels count');
        }
      }

    } catch (error) {
      if (error instanceof SyntaxError) {
        errors.push(`Baseline file contains invalid JSON: ${error.message}`);
      } else {
        errors.push(`Error reading baseline file: ${error}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Lists all available recipe files in the recipes directory.
   * 
   * @param context The EDA command context
   * @returns Array of recipe information
   */
  static async listRecipes(context: EdaCommandContext): Promise<EdaRecipe[]> {
    const recipes: EdaRecipe[] = [];

    try {
      const files = await fs.readdir(context.recipesDir);
      
      for (const file of files) {
        if (file.endsWith('.ys')) {
          const recipePath = join(context.recipesDir, file);
          try {
            const stat = await fs.stat(recipePath);
            const content = await fs.readFile(recipePath, 'utf-8');
            
            recipes.push({
              name: file,
              path: recipePath,
              lastModified: stat.mtime,
              content,
            });
          } catch (error) {
            // Skip files that can't be read
            console.warn(`Warning: Could not read recipe file ${file}: ${error}`);
          }
        }
      }

      // Sort by last modified time (newest first)
      recipes.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

    } catch (error) {
      // recipes/ directory doesn't exist or can't be read
      console.warn(`Warning: Could not read recipes directory: ${error}`);
    }

    return recipes;
  }

  /**
   * Ensures that all required directories exist.
   * 
   * @param context The EDA command context
   * @returns Promise that resolves when directories are created
   */
  static async ensureDirectories(context: EdaCommandContext): Promise<void> {
    const directories = [
      context.edaDir,
      context.logsDir,
      context.lastRunDir,
      context.recipesDir,
      context.buildDir,
    ];

    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        throw new Error(`Failed to create directory ${dir}: ${error}`);
      }
    }
  }

  /**
   * Checks if a file exists and is readable.
   * 
   * @param filePath Path to the file
   * @returns True if file exists and is readable
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(filePath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Checks if a directory exists and is readable.
   * 
   * @param dirPath Path to the directory
   * @returns True if directory exists and is readable
   */
  static async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }
}
