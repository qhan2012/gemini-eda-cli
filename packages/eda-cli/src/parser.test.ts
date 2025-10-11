/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { YosysParser } from './parser.js';

describe('YosysParser', () => {
  describe('parseMetrics', () => {
    it('should parse valid Yosys output', () => {
      const output = {
        stdout: `
=== top ===

   Number of cells:                15432
   Longest path (levels):         27
   Chip area for module 'top':    1234.5 um²
`,
        stderr: 'Warning: 3',
        exitCode: 0,
        duration: 1000,
      };

      const result = YosysParser.parseMetrics(output);

      expect(result).toEqual({
        cells: 15432,
        levels: 27,
        area_um2: 1234.5,
        warnings: 3,
      });
    });

    it('should handle missing optional metrics', () => {
      const output = {
        stdout: `
=== top ===

   Number of cells:                15432
   Longest path (levels):         27
`,
        stderr: '',
        exitCode: 0,
        duration: 1000,
      };

      const result = YosysParser.parseMetrics(output);

      expect(result).toEqual({
        cells: 15432,
        levels: 27,
        area_um2: null,
        warnings: 0,
      });
    });

    it('should return null for invalid output', () => {
      const output = {
        stdout: 'Invalid output',
        stderr: '',
        exitCode: 0,
        duration: 1000,
      };

      const result = YosysParser.parseMetrics(output);

      expect(result).toBeNull();
    });
  });
});
