import { KyInstance } from "ky";
import PQueue from "p-queue";
import { FetchPageData, FetchPageDataResult, PageData } from "./types";

const createFetchPageData =
  (queue: PQueue) =>
  (client: KyInstance): FetchPageData => {
    const fetchPageData: FetchPageData = async (options) => {
      const executeFetching = async (): Promise<FetchPageDataResult> => {
        const { startDate, endDate, page } = options;
        try {
          const response = await client.post("api/histories", {
            json: {
              datefilter_to: endDate,
              datefilter_from: startDate,
              typeDuration: "=",
              page: page,
              per_page: 10,
              search: "",
              status_call: "ANSWERED",
            },
          });

          const data = await response.json<PageData>();
          return {
            isError: false,
            options,
            data,
          };
        } catch (e) {
          return {
            isError: true,
            options,
            error: e as Error,
          };
        }
      };

      return queue.add(executeFetching) as Promise<FetchPageDataResult>;
    };

    return fetchPageData;
  };

export default createFetchPageData;
