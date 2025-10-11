/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { EdaCli } from './eda-cli.js';

describe('EdaCli Integration', () => {
  describe('createEdaSlashCommand', () => {
    it('should create a valid slash command', () => {
      const command = EdaCli.createEdaSlashCommand();
      
      expect(command).toBeDefined();
      expect(command.name).toBe('eda');
      expect(command.description).toContain('EDA synthesis');
      expect(command.kind).toBe('built-in');
      expect(command.action).toBeDefined();
      expect(command.subCommands).toBeDefined();
      expect(command.subCommands).toHaveLength(6);
    });
  });

  describe('createEdaModeCommand', () => {
    it('should create a valid mode command', () => {
      const command = EdaCli.createEdaModeCommand();
      
      expect(command).toBeDefined();
      expect(command.name).toBe('gemini-eda-v0_1');
      expect(command.description).toContain('EDA synthesis REPL');
      expect(command.kind).toBe('built-in');
      expect(command.action).toBeDefined();
    });
  });

  describe('parseArgs', () => {
    it('should parse simple commands', () => {
      const result = EdaCli.parseArgs('help');
      expect(result.command).toBe('help');
      expect(result.args).toEqual([]);
      expect(result.options).toEqual({});
    });

    it('should parse commands with arguments', () => {
      const result = EdaCli.parseArgs('run script.ys --seed 42');
      expect(result.command).toBe('run');
      expect(result.args).toEqual(['script.ys']);
      expect(result.options.seed).toBe(42);
    });

    it('should parse force option', () => {
      const result = EdaCli.parseArgs('recipe init --force');
      expect(result.command).toBe('recipe');
      expect(result.args).toEqual(['init']);
      expect(result.options.force).toBe(true);
    });
  });
});


