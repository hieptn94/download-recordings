import { KyInstance } from "ky";
import { PageData } from "./types";

type Options = {
  startDate: string;
  endDate: string;
  page: number;
};

const download =
  (client: KyInstance) =>
  async (options: Options): Promise<PageData> => {
    const response = await client.post("api/histories", {
      json: {
        datefilter_to: options.endDate,
        datefilter_from: options.startDate,
        typeDuration: "=",
        page: options.page,
        per_page: 10,
        search: "",
        status_call: "ANSWERED",
      },
    });

    return response.json<PageData>();
  };

export default download;
