export type CLIOptions = {
  startDate: string;
  endDate: string;
  url: string;
  output: string;
  token: string;
  verbose: boolean;
  dryRun: boolean;
};

type Data = {
  record_file: string;
};

type CDRData = {
  current_page: number;
  last_page: number;
  data: Data[];
};

export type PageData = {
  data: {
    cdr_data: CDRData;
  };
};

export type DownloadSingleOptions = {
  url: string;
  directory: string;
};

export type DownloadSingleResult =
  | {
      isError: false;
      size: number;
      url: string;
    }
  | {
      url: string;
      isError: true;
      error: Error;
    };

export type DownloadSingle = (
  options: DownloadSingleOptions,
) => Promise<DownloadSingleResult>;

export type FetchPageDataOptions = {
  startDate: string;
  endDate: string;
  page: number;
};

export type FetchPageDataResult =
  | {
      isError: false;
      options: FetchPageDataOptions;
      data: PageData;
    }
  | {
      isError: true;
      options: FetchPageDataOptions;
      error: Error;
    };

export type FetchPageData = (
  options: FetchPageDataOptions,
) => Promise<FetchPageDataResult>;
