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
    "./downloads"
  )
  .option("-v, --verbose", "enable verbose logging")
  .option(
    "--dry-run",
    "show what would be downloaded without actually downloading"
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

        console.log("Starting download process...");

        const queue = new PQueue({ concurrency: 10 });
        const downloadMultipleRecordings = downloadRecordings(ky.extend({}))(
          queue
        );

        const client = createClient({
          url,
          token,
        });
        const downloadPage = download(client);

        console.log("Downloading first page...");
        const firstPage = await downloadPage({
          startDate,
          endDate,
          page: 1,
        });

        const firstUrls = firstPage.data.cdr_data.data.map(
          (c) => c.record_file
        );

        console.log("Downloading first page recordings...");
        await downloadMultipleRecordings({
          urls: firstUrls,
          directory: output,
        });

        console.log("Downloading other pages...");
        console.log("Total pages", firstPage.data.cdr_data.last_page);
        const otherPages = _.range(
          1,
          firstPage.data.cdr_data.last_page ?? 0
        ).slice(1);
        for (let i = 0; i < otherPages.length; i++) {
          const page = otherPages[i];
          try {
            console.log(`Downloading page ${page}...`);
            const response = await downloadPage({
              startDate,
              endDate,
              page,
            });
            const urls = response.data.cdr_data.data.map((c) => c.record_file);
            console.log(
              `Downloaded ${urls.length} recordings from page ${page}`
            );
            await downloadMultipleRecordings({
              urls,
              directory: output,
            });
          } catch (error) {
            console.error(`Error downloading page ${page}:`, error);
          }
        }

        console.log("Download completed successfully!");
        console.log("Downloaded recordings:");
        console.log(firstUrls);
        console.log(otherPages);
      } catch (error) {
        console.error("Error during download:", error);
        process.exit(1);
      }
    }
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
