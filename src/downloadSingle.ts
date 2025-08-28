import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import { KyInstance } from "ky";
import PQueue from "p-queue";
import { basename, join } from "path";
import { pipeline } from "stream/promises";
import { DownloadSingle, DownloadSingleResult } from "./types";

const createDownLoadSingle =
  (queue: PQueue) =>
  (client: KyInstance): DownloadSingle => {
    const downloadSingle: DownloadSingle = ({ directory, url }) => {
      const executeDownload = async (): Promise<DownloadSingleResult> => {
        try {
          const extractedFilename = basename(new URL(url).pathname);
          const filePath = join(directory, extractedFilename);
          await mkdir(directory, { recursive: true });

          const response = await client.get(url);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const contentLength = parseInt(
            response.headers.get("content-length") || "0",
          );

          const writeStream = createWriteStream(filePath);

          if (!response.body) throw new Error("Response body is null");

          await pipeline(response.body, writeStream);

          return {
            url,
            size: contentLength,
            isError: false,
          };
        } catch (e) {
          return {
            isError: true,
            error: e as Error,
            url,
          };
        }
      };

      return queue.add(executeDownload) as Promise<DownloadSingleResult>;
    };

    return downloadSingle;
  };

export default createDownLoadSingle;
