import ky, { KyInstance } from "ky";

type Options = {
  url: string;
  token: string;
};

const createClient = (options: Options): KyInstance =>
  ky.extend({
    prefixUrl: options.url,
    timeout: 50_000,
    hooks: {
      beforeRequest: [
        (request) => {
          console.log({ url: request.url });
          request.headers.set("Authorization", `Bearer ${options.token}`);
        },
      ],
    },
  });

export default createClient;
