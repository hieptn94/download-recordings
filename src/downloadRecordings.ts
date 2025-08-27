import { KyInstance } from "ky";
import PQueue from "p-queue";
import downloadRecording from "./recording"; // Adjust import path as needed

type DownloadOptions = {
  url: string;
  directory: string;
};

type DownloadResult = {
  url: string;
  filePath: string;
  size: number;
  success: boolean;
  error?: string;
};

type DownloadRecordingsOptions = {
  urls: string[];
  directory: string;
};

type DownloadRecordingsResult = {
  results: DownloadResult[];
  successful: number;
  failed: number;
  totalSize: number;
  summary: {
    successfulUrls: string[];
    failedUrls: string[];
  };
};

const downloadRecordings = (client: KyInstance) => (queue: PQueue) => {
  const downloadSingle = downloadRecording(client)(queue);

  return async (
    options: DownloadRecordingsOptions
  ): Promise<DownloadRecordingsResult> => {
    const { urls, directory } = options;

    try {
      // Create download promises for all URLs
      const downloadPromises = urls.map((url) =>
        downloadSingle({ url, directory })
      );

      // Wait for all downloads to complete
      const results = await Promise.all(downloadPromises);

      // Filter out void results and ensure we have DownloadResult[]
      const downloadResults = results.filter(
        (result): result is DownloadResult => result !== undefined
      );

      // Calculate statistics
      const successful = downloadResults.filter(
        (result) => result.success
      ).length;
      const failed = downloadResults.filter((result) => !result.success).length;
      const totalSize = downloadResults
        .filter((result) => result.success)
        .reduce((sum, result) => sum + result.size, 0);

      // Create summary
      const successfulUrls = downloadResults
        .filter((result) => result.success)
        .map((result) => result.url);

      const failedUrls = downloadResults
        .filter((result) => !result.success)
        .map((result) => result.url);

      return {
        results: downloadResults,
        successful,
        failed,
        totalSize,
        summary: {
          successfulUrls,
          failedUrls,
        },
      };
    } catch (error) {
      // Handle unexpected errors
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Create failed results for all URLs
      const failedResults: DownloadResult[] = urls.map((url) => ({
        url,
        filePath: "",
        size: 0,
        success: false,
        error: errorMessage,
      }));

      return {
        results: failedResults,
        successful: 0,
        failed: urls.length,
        totalSize: 0,
        summary: {
          successfulUrls: [],
          failedUrls: urls,
        },
      };
    }
  };
};

export default downloadRecordings;
