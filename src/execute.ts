import ky from "ky";
import _ from "lodash";
import PQueue from "p-queue";
import path from "path";
import createClient from "./client";
import createFetchPageData from "./downloadPageData";
import createDownLoadSingle from "./downloadSingle";
import { CLIOptions, FetchPageDataResult } from "./types";

type Progress = Record<
  string,
  {
    isSuccess: boolean;
    urls: {
      url: string;
      isSuccess: boolean;
    }[];
  }
>;

const execute = async (options: CLIOptions) => {
  const fetchPageDataQueue = new PQueue({
    concurrency: 4,
  });
  const downloadSingleQueue = new PQueue({
    concurrency: 4,
  });

  const fetchClient = createClient({
    url: options.url,
    token: options.token,
  });

  const fetchPageData = createFetchPageData(fetchPageDataQueue)(fetchClient);

  const downloadSingle = createDownLoadSingle(downloadSingleQueue)(
    ky.extend({}),
  );

  const progress: Progress = {};

  console.log("Fetch 1st page data...");
  const firstPage = await fetchPageData({
    page: 1,
    startDate: options.startDate,
    endDate: options.endDate,
  });

  if (firstPage.isError) {
    console.log("Error when fetching first page", firstPage.error);
    progress[firstPage.options.page] = {
      isSuccess: false,
      urls: [],
    };
    return;
  }

  const executeDownload = async (pageData: FetchPageDataResult) => {
    console.log(`Download records for page ${pageData.options.page}`);
    if (pageData.isError) {
      progress[firstPage.options.page] = {
        isSuccess: false,
        urls: [],
      };
      return;
    }
    const results = await Promise.all(
      pageData.data.data.cdr_data.data.map((c) =>
        downloadSingle({
          directory: path.join(options.output, `${pageData.options.page}`),
          url: c.record_file,
        }),
      ),
    );
    results.forEach((res) => {
      const { page } = pageData.options;
      const current = progress[page] ?? {
        isSuccess: true,
        urls: [],
      };

      if (res.isError) {
        progress[page] = {
          ...current,
          isSuccess: false,
          urls: [
            ...current.urls,
            {
              isSuccess: false,
              url: res.url,
            },
          ],
        };
        return;
      }
      progress[page] = {
        ...current,
        urls: [
          ...current.urls,
          {
            isSuccess: true,
            url: res.url,
          },
        ],
      };
    });
  };

  await executeDownload(firstPage);

  console.log("First page success", firstPage.data);

  await Promise.all(
    _.range(1, firstPage.data.data.cdr_data.last_page ?? 0)
      .slice(1)
      .map(async (page) => {
        const pageData = await fetchPageData({
          page,
          startDate: options.startDate,
          endDate: options.endDate,
        });
        return executeDownload(pageData);
      }),
  );

  console.log(progress);
};

export default execute;
