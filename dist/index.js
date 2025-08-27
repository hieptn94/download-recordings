#!/usr/bin/env node

// src/index.ts
import { Command } from "commander";
import { readFileSync } from "fs";
import { dirname, join as join2 } from "path";
import { fileURLToPath } from "url";

// src/client.ts
import ky from "ky";
var createClient = (options) => ky.extend({
  prefixUrl: options.url,
  timeout: 5e4,
  hooks: {
    beforeRequest: [
      (request) => {
        console.log({ url: request.url });
        request.headers.set("Authorization", `Bearer ${options.token}`);
      }
    ]
  }
});
var client_default = createClient;

// src/download.ts
var download = (client) => async (options) => {
  const response = await client.post("api/histories", {
    json: {
      datefilter_to: options.endDate,
      datefilter_from: options.startDate,
      typeDuration: "=",
      page: options.page,
      per_page: 10,
      search: "",
      status_call: "ANSWERED"
    }
  });
  return response.json();
};
var download_default = download;

// src/index.ts
import PQueue from "p-queue";
import ky2 from "ky";

// src/recording.ts
import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import { basename, join } from "path";
import { pipeline } from "stream/promises";
var downloadRecording = (client) => (queue) => {
  return async (downloadOptions) => {
    const { url, directory } = downloadOptions;
    return queue.add(async () => {
      try {
        const extractedFilename = basename(new URL(url).pathname);
        const filePath = join(directory, extractedFilename);
        await mkdir(directory, { recursive: true });
        const response = await client.get(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const contentLength = parseInt(
          response.headers.get("content-length") || "0"
        );
        const writeStream = createWriteStream(filePath);
        if (!response.body) throw new Error("Response body is null");
        await pipeline(response.body, writeStream);
        return {
          url,
          filePath,
          size: contentLength,
          success: true
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
          url,
          filePath: "",
          size: 0,
          success: false,
          error: errorMessage
        };
      }
    });
  };
};
var recording_default = downloadRecording;

// src/downloadRecordings.ts
var downloadRecordings = (client) => (queue) => {
  const downloadSingle = recording_default(client)(queue);
  return async (options) => {
    const { urls, directory } = options;
    try {
      const downloadPromises = urls.map(
        (url) => downloadSingle({ url, directory })
      );
      const results = await Promise.all(downloadPromises);
      const downloadResults = results.filter(
        (result) => result !== void 0
      );
      const successful = downloadResults.filter(
        (result) => result.success
      ).length;
      const failed = downloadResults.filter((result) => !result.success).length;
      const totalSize = downloadResults.filter((result) => result.success).reduce((sum, result) => sum + result.size, 0);
      const successfulUrls = downloadResults.filter((result) => result.success).map((result) => result.url);
      const failedUrls = downloadResults.filter((result) => !result.success).map((result) => result.url);
      return {
        results: downloadResults,
        successful,
        failed,
        totalSize,
        summary: {
          successfulUrls,
          failedUrls
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const failedResults = urls.map((url) => ({
        url,
        filePath: "",
        size: 0,
        success: false,
        error: errorMessage
      }));
      return {
        results: failedResults,
        successful: 0,
        failed: urls.length,
        totalSize: 0,
        summary: {
          successfulUrls: [],
          failedUrls: urls
        }
      };
    }
  };
};
var downloadRecordings_default = downloadRecordings;

// src/index.ts
import _ from "lodash";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var packageJsonPath = join2(__dirname, "..", "package.json");
var packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
var program = new Command();
program.name("download-recordings").description("Download recordings from a specified URL within a date range").version(packageJson.version);
program.command("download").description("Download recordings from a specified URL").requiredOption("-s, --start-date <date>", "start date (YYYY-MM-DD format)").requiredOption("-e, --end-date <date>", "end date (YYYY-MM-DD format)").requiredOption("-u, --url <url>", "URL to download recordings from").requiredOption("-t, --token <token>", "authentication token").option(
  "-o, --output <path>",
  "output directory for downloads",
  "./downloads"
).option("-v, --verbose", "enable verbose logging").option(
  "--dry-run",
  "show what would be downloaded without actually downloading"
).action(
  async (options) => {
    console.log(options);
    const { startDate, endDate, url, token, output, verbose, dryRun } = options;
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
      const downloadMultipleRecordings = downloadRecordings_default(ky2.extend({}))(
        queue
      );
      const client = client_default({
        url,
        token
      });
      const downloadPage = download_default(client);
      console.log("Downloading first page...");
      const firstPage = await downloadPage({
        startDate,
        endDate,
        page: 1
      });
      const firstUrls = firstPage.data.cdr_data.data.map(
        (c) => c.record_file
      );
      console.log("Downloading first page recordings...");
      await downloadMultipleRecordings({
        urls: firstUrls,
        directory: output
      });
      console.log("Downloading other pages...");
      const otherPages = _.range(1, 2400).slice(1);
      for (let i = 0; i < otherPages.length; i++) {
        const page = otherPages[i];
        try {
          console.log(`Downloading page ${page}...`);
          const response = await downloadPage({
            startDate,
            endDate,
            page
          });
          const urls = response.data.cdr_data.data.map((c) => c.record_file);
          console.log(
            `Downloaded ${urls.length} recordings from page ${page}`
          );
          await downloadMultipleRecordings({
            urls,
            directory: output
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
program.option("-v, --verbose", "enable verbose logging").option("--dry-run", "show what would be done without executing").hook("preAction", (thisCommand) => {
  const options = thisCommand.opts();
  if (options.verbose) {
    console.log("Verbose mode enabled");
  }
  if (options.dryRun) {
    console.log("Dry run mode - no changes will be made");
  }
});
program.parse();
export {
  program
};
//# sourceMappingURL=index.js.map