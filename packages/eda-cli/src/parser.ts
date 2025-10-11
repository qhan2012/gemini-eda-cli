/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EdaParsedMetrics, EdaYosysOutput } from './types.js';

/**
 * Parses Yosys output to extract synthesis metrics.
 * 
 * This parser looks for specific patterns in Yosys output to extract:
 * - Number of cells
 * - Number of levels (logic depth)
 * - Area in um² (if available)
 * - Warning count
 */
export class YosysParser {
  private static readonly CELLS_PATTERN = /Number of cells:\s*(\d+)/i;
  private static readonly LEVELS_PATTERN = /Longest path \(levels\):\s*(\d+)/i;
  private static readonly AREA_PATTERN = /Chip area for module.*?:\s*(\d+(?:\.\d+)?)\s*um²/i;
  private static readonly WARNINGS_PATTERN = /Warning:\s*(\d+)/gi;

  /**
   * Parses Yosys output and extracts synthesis metrics.
   * 
   * @param output The Yosys output containing stdout and stderr
   * @returns Parsed metrics or null if parsing fails
   */
  static parseMetrics(output: EdaYosysOutput): EdaParsedMetrics | null {
    const combinedOutput = `${output.stdout}\n${output.stderr}`;
    
    try {
      const cells = this.extractCells(combinedOutput);
      const levels = this.extractLevels(combinedOutput);
      const area_um2 = this.extractArea(combinedOutput);
      const warnings = this.extractWarnings(combinedOutput);

      // Cells and levels are required metrics
      if (cells === null || levels === null) {
        return null;
      }

      return {
        cells,
        levels,
        area_um2,
        warnings,
      };
    } catch (error) {
      console.error('Error parsing Yosys output:', error);
      return null;
    }
  }

  /**
   * Extracts the number of cells from Yosys output.
   */
  private static extractCells(output: string): number | null {
    const match = output.match(this.CELLS_PATTERN);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Extracts the number of levels (logic depth) from Yosys output.
   */
  private static extractLevels(output: string): number | null {
    const match = output.match(this.LEVELS_PATTERN);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Extracts the chip area in um² from Yosys output.
   * This is optional and may not be present in all outputs.
   */
  private static extractArea(output: string): number | null {
    const match = output.match(this.AREA_PATTERN);
    return match ? parseFloat(match[1]) : null;
  }

  /**
   * Counts the number of warnings in Yosys output.
   */
  private static extractWarnings(output: string): number | null {
    const matches = output.matchAll(this.WARNINGS_PATTERN);
    let count = 0;
    for (const match of matches) {
      count += parseInt(match[1], 10);
    }
    return count;
  }

  /**
   * Validates that Yosys is available on the system.
   * 
   * @returns Promise that resolves to true if Yosys is available, false otherwise
   */
  static async isYosysAvailable(): Promise<boolean> {
    try {
      const { spawn } = await import('child_process');
      const { promisify } = await import('util');
      const exec = promisify(spawn);
      
      const result = await exec('yosys', ['-V'], { 
        stdio: 'pipe',
        timeout: 5000 
      }) as any;
      
      return result.exitCode === 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets the Yosys version string.
   * 
   * @returns Promise that resolves to the version string or null if unavailable
   */
  static async getYosysVersion(): Promise<string | null> {
    try {
      const { spawn } = await import('child_process');
      const { promisify } = await import('util');
      const exec = promisify(spawn);
      
      const result = await exec('yosys', ['-V'], { 
        stdio: 'pipe',
        timeout: 5000 
      }) as any;
      
      if (result.exitCode === 0 && result.stdout) {
        return result.stdout.toString().trim();
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
}
