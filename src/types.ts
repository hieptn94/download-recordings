type Data = {
  record_file: string;
};

type CDRData = {
  current_page: number;
  last_page: number;
  data: Data[];
};

export type Response = {
  data: {
    cdr_data: CDRData;
  };
};
