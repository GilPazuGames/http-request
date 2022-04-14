const ErrorTypes = require("./errorTypes").types;
const ApiError = require("./errorTypes").ApiError;

class Request {
  constructor(options) {
    options = options || {};

    if (options.url) {
      const url = new URL(options.url);
      options.host = url.hostname;
      options.secure = url.protocol.startsWith("https");
      options.pathPrefix = url.pathname;
      options.port = url.port;
    }
    this.options = {
      host: "localhost",
      port: options.port != null ? options.port : options.secure ? 443 : 8080,
      secure: false,
      pathPrefix: "",
      ...options,
    };

    this.http = this.options.secure ? require("https") : require("http");
  }

  GET({ path, params, headers }) {
    return this.makeRequest("GET", path, params, {}, headers);
  }

  POST({ path, params, data, headers }) {
    return this.makeRequest("POST", path, params, data, headers);
  }

  PUT({ path, params, data, headers }) {
    return this.makeRequest("PUT", path, params, data, headers);
  }

  DELETE({ path, params, data, headers }) {
    return this.makeRequest("DELETE", path, params, data, headers);
  }

  makeRequest(method, path, params, data, headers) {
    return new Promise((resolve, reject) => {
      params = params || {};
      data = data || {};

      path = [this.options.pathPrefix, path].join("");

      if (!method) {
        reject(
          new ApiError(ErrorTypes.MISSING_FIELDS, {
            method: "method is missing",
          })
        );
      }

      if (!path) {
        reject(
          new ApiError(ErrorTypes.MISSING_FIELDS, {
            path: "path is missing",
          })
        );
      }

      if (path) {
        if (params instanceof URLSearchParams) {
          path = [path, params.toString()].join("?");
        } else if (Object.keys(params).length) {
          path = [path, new URLSearchParams(params)].join("?");
        }
      }

      const options = {
        host: this.options.host,
        port: this.options.port,
        auth: this.options.auth,
        path: path,
        method: method,
        headers: {
          "Content-Type": "application/json",
          ...(this.options.headers || {}),
          ...headers,
        },
      };

      if (this.options.debug) {
        console.log("<Request> options: ", options);
      }

      const req = this.http.request(options, function (res) {
        let data = "";
        res.on("data", function (d) {
          data += d.toString();
        });
        res.on("end", function () {
          const statusCode = res.statusCode;
          const shortCode = ~~(statusCode / 100);
          let jsonResponse;
          try {
            jsonResponse = JSON.parse(data);
          } catch (e) {
            console.error(e);
          }

          if (data.length && !jsonResponse) {
            return reject(new ApiError(ErrorTypes.INVALID_JSON_RESPONSE));
          }

          if ([2, 3].indexOf(shortCode) < 0) {
            return reject(data);
          } else {
            return resolve(jsonResponse);
          }
        });
      });

      req.on("error", function (error) {
        reject(
          new ApiError(ErrorTypes.REQUEST_ERROR, {
            error: error,
          })
        );
      });

      if (method != "GET" && data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }
}

module.exports = Request;
