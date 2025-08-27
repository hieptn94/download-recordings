import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import { KyInstance } from "ky";
import PQueue from "p-queue";
import { basename, join } from "path";
import { pipeline } from "stream/promises";

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

const downloadRecording = (client: KyInstance) => (queue: PQueue) => {
  return async (
    downloadOptions: DownloadOptions
  ): Promise<DownloadResult | void> => {
    const { url, directory } = downloadOptions;

    return queue.add(async (): Promise<DownloadResult | void> => {
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
          success: true,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        return {
          url,
          filePath: "",
          size: 0,
          success: false,
          error: errorMessage,
        };
      }
    });
  };
};

export default downloadRecording;
