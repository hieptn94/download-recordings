#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import createClient from "./client";
import download from "./download";
import PQueue from "p-queue";
import ky from "ky";
import downloadRecordings from "./downloadRecordings";
import _ from "lodash";
import execute from "./execute";

// Get package.json for version info
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

// Create the main program
const program = new Command();

// Configure the program
program
  .name("download-recordings")
  .description("Download recordings from a specified URL within a date range")
  .version(packageJson.version);

// Add the download-recordings command
program
  .command("download")
  .description("Download recordings from a specified URL")
  .requiredOption("-s, --start-date <date>", "start date (YYYY-MM-DD format)")
  .requiredOption("-e, --end-date <date>", "end date (YYYY-MM-DD format)")
  .requiredOption("-u, --url <url>", "URL to download recordings from")
  .requiredOption("-t, --token <token>", "authentication token")
  .option(
    "-o, --output <path>",
    "output directory for downloads",
    "./downloads",
  )
  .option("-v, --verbose", "enable verbose logging")
  .option(
    "--dry-run",
    "show what would be downloaded without actually downloading",
  )
  .action(
    async (options: {
      startDate: string;
      endDate: string;
      url: string;
      output: string;
      token: string;
      verbose: boolean;
      dryRun: boolean;
    }) => {
      console.log(options);
      const { startDate, endDate, url, token, output, verbose, dryRun } =
        options;

      if (verbose) {
        console.log("Download Recordings CLI");
        console.log("======================");
        console.log(`Start Date: ${startDate}`);
        console.log(`End Date: ${endDate}`);
        console.log(`URL: ${url}`);
        console.log(`Token: ${token.substring(0, 8)}...`);
        console.log(`Output Directory: ${output}`);
        console.log(`Dry Run: ${dryRun ? "Yes" : "No"}`);
        console.log("");
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        console.error("Error: start-date must be before end-date");
        process.exit(1);
      }

      try {
        if (dryRun) {
          console.log("DRY RUN: Would download recordings from:");
          console.log(`  URL: ${url}`);
          console.log(`  Date Range: ${startDate} to ${endDate}`);
          console.log(`  Output Directory: ${output}`);
          return;
        }
        execute(options);
      } catch (error) {
        console.error("Error during download:", error);
        process.exit(1);
      }
    },
  );

// Global options
program
  .option("-v, --verbose", "enable verbose logging")
  .option("--dry-run", "show what would be done without executing")
  .hook("preAction", (thisCommand) => {
    const options = thisCommand.opts();
    if (options.verbose) {
      console.log("Verbose mode enabled");
    }
    if (options.dryRun) {
      console.log("Dry run mode - no changes will be made");
    }
  });

// Parse arguments
program.parse();

// Export for testing
export { program };
