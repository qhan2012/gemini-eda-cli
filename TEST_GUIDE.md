# EDA CLI Test Guide

## Test Directory Structure

The test fixtures are located in `test-fixtures/`:

```
test-fixtures/
├── rtl/
│   └── top.v              # Sample Verilog RTL module
├── recipes/
│   └── synth_resyn2.ys    # Sample Yosys synthesis script
└── build/                 # Output directory (created during synthesis)
```

## Manual Testing Commands

### 1. Navigate to Test Directory
```bash
cd test-fixtures
```

### 2. Start Gemini CLI
```bash
gemini
```

### 3. Run EDA Commands in Sequence

#### Basic Help and Discovery
```bash
/eda:help                    # Show EDA command help
/eda:recipe:list             # List available recipes (should be empty initially)
```

![EDA Help Output](./docs/assets/eda-help-screenshot.png)

#### Initialize EDA Environment
```bash
/eda:recipe:init             # Create recipes directory and sample script
/eda:recipe:list             # List recipes (should show synth_resyn2.ys)
```

#### Test Synthesis Workflow
```bash
/eda:run                     # Run synthesis (will fail - no RTL in current dir)
/eda:last                    # Show last run results (should show no results)
/eda:baseline:seed           # Save baseline (will fail - no successful run)
/eda:verify                  # Verify QoR (will fail - no baseline)
```

#### Test with RTL Files
```bash
# Copy RTL files to current directory
cp rtl/*.v ./

# Run synthesis again
/eda:run                     # Get Yosys command to run manually
/eda:last                    # Show synthesis results
/eda:baseline:seed           # Save as baseline
/eda:run --seed 42           # Get Yosys command with seed
/eda:verify                  # Compare against baseline
```

## Automated Testing

### Run Automated Test Suite
```bash
node test-eda-repl.js
```

This will run through all test scenarios automatically with proper delays.

### Run Individual Test Commands
```bash
# Test help command
printf "/eda:help\n/exit\n" | gemini

# Test recipe listing
printf "/eda:recipe:list\n/exit\n" | gemini

# Test recipe initialization
printf "/eda:recipe:init\n/exit\n" | gemini
```

## Expected Test Results

### ✅ Successful Tests
- `/eda:help` - Shows comprehensive help
- `/eda:recipe:init` - Creates recipes directory and sample script
- `/eda:recipe:list` - Lists available recipe files
- `/eda:run` (with RTL) - Runs synthesis and shows metrics
- `/eda:last` - Shows last run results
- `/eda:baseline:seed` - Saves baseline after successful run
- `/eda:verify` - Compares QoR against baseline

### ⚠️ Expected Failures (Error Handling)
- `/eda:run` (without RTL) - Should show "rtl/ not found" error
- `/eda:last` (no runs) - Should show "No last run found" message
- `/eda:baseline:seed` (no successful run) - Should show "No last run found" error
- `/eda:verify` (no baseline) - Should show "No baseline found" error

## Test Scenarios

### Scenario 1: Fresh Start
1. Start in empty directory
2. Run `/eda:help` - should show help
3. Run `/eda:recipe:list` - should show "No recipe files found"
4. Run `/eda:recipe:init` - should create recipes
5. Run `/eda:recipe:list` - should show created recipe

### Scenario 2: Synthesis Workflow
1. Ensure RTL files are present
2. Run `/eda:run` - should perform synthesis
3. Run `/eda:last` - should show results
4. Run `/eda:baseline:seed` - should save baseline
5. Run `/eda:run --seed 42` - should run with different seed
6. Run `/eda:verify` - should compare results

### Scenario 3: Error Handling
1. Run `/eda:run` without RTL - should show error
2. Run `/eda:last` without runs - should show "no results" message
3. Run `/eda:baseline:seed` without successful run - should show error
4. Run `/eda:verify` without baseline - should show error

## Troubleshooting

### Command Not Found
If you get "Unknown command: /eda:help", ensure:
1. The `.toml` files are in `~/.gemini/commands/eda/`
2. You're using the correct command format: `/eda:help` (not `/eda help`)

### Yosys Not Found
If synthesis fails with "Yosys not found":
1. Install Yosys: `brew install yosys` (macOS) or `apt install yosys` (Ubuntu)
2. Ensure Yosys is on PATH: `which yosys`

### Yosys Command Syntax
The correct Yosys command syntax is:
- Basic: `yosys -s recipes/synth_resyn2.ys`
- With seed: `yosys --hash-seed 42 -s recipes/synth_resyn2.ys`
- The `--hash-seed` parameter controls randomization in Yosys
- Use `-s` to specify the script file, not `--seed`

### Permission Issues
If you get permission errors:
1. Ensure the test directory is writable
2. Check that you have write permissions in the current directory
