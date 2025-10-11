/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { EdaValidator } from './validation.js';
import type { EdaCommandContext } from './types.js';

// Mock fs
vi.mock('fs', () => ({
  promises: {
    stat: vi.fn(),
    readdir: vi.fn(),
    readFile: vi.fn(),
  },
}));

describe('EdaValidator', () => {
  const mockContext: EdaCommandContext = {
    cwd: '/test',
    edaDir: '/test/.gemini_eda',
    logsDir: '/test/.gemini_eda/logs',
    lastRunDir: '/test/.gemini_eda/last_run',
    recipesDir: '/test/recipes',
    rtlDir: '/test/rtl',
    buildDir: '/test/build',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateDirectoryStructure', () => {
    it('should pass when all directories exist', async () => {
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

      const result = await EdaValidator.validateDirectoryStructure(mockContext);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when rtl directory is missing', async () => {
      vi.mocked(fs.stat)
        .mockRejectedValueOnce(new Error('ENOENT')) // rtl directory doesn't exist
        .mockResolvedValue({ isDirectory: () => true } as any); // others

      const result = await EdaValidator.validateDirectoryStructure(mockContext);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('rtl/ directory not found. Create rtl/ and add your sources (e.g., rtl/top.v)');
    });
  });

  describe('validateRecipeFile', () => {
    it('should pass when file exists', async () => {
      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);

      const result = await EdaValidator.validateRecipeFile('/test/recipe.ys');

      expect(result.valid).toBe(true);
    });

    it('should fail when file does not exist', async () => {
      vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));

      const result = await EdaValidator.validateRecipeFile('/test/recipe.ys');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Recipe file not found: /test/recipe.ys');
    });
  });
});
