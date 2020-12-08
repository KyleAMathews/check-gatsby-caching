"use strict";
const React = require("react");
const { Text, Box, Newline } = require("ink");
const fetch = require("node-fetch");
const parseCacheControl = require(`parse-cache-control`);
const Spinner = require(`ink-spinner`).default;
const join = require(`url-join`);
const diff = require(`jest-diff`).default;
const stripAnsi = require(`strip-ansi`);
const cheerio = require("cheerio");

const Check = ({ url, cacheControl, label, expectedCacheHeader }) => {
  let message;
  if (!cacheControl) {
    message = (
      <Text>
        <Spinner /> Validating {label} cache-control headers...
      </Text>
    );
  } else {
    const headerDiff = diff(cacheControl, expectedCacheHeader);

    let same = false;
    if (
      stripAnsi(headerDiff) === `Compared values have no visual difference.`
    ) {
      same = true;
    }

    message = (
      <Text>{same ? `✅ headers are correct!` : `❌ ${headerDiff}`}</Text>
    );
  }

  return (
    <>
      <Text underline bold>
        {label}
      </Text>
      <Text>{url}</Text>
      <Text>{message}</Text>
    </>
  );
};

const getUrl = async (url) => {
  const response = await fetch(url);
  const body = await response.text();
  const cacheControl = parseCacheControl(
    response.headers.get(`cache-control`)
  ) || { null: `No cache-control header set` };

  return [body, cacheControl];
};

const App = () => {
  const url = process.argv[2];
  const [state, setState] = React.useState({
    html: {},
    appDataJson: {},
    pageData: {},
    JSData: {},
  });
  React.useEffect(() => {
    const fetchInitialPage = async () => {
      const [body, cacheControl] = await getUrl(url);
      setState({ ...state, html: { url, cacheControl } });

      const $ = cheerio.load(body);

      // app.json
      const appDataJsonURL = join(url, `/page-data/app-data.json`);
      getUrl(appDataJsonURL).then(([body, cacheControl]) => {
        setState((prevState) => {
          return {
            ...prevState,
            appDataJson: { url: appDataJsonURL, cacheControl },
          };
        });
      });

      // page-data
      const pageDataURL = join(
        url,
        $(`link[href*="page-data.json"]`).attr(`href`)
      );
      getUrl(pageDataURL).then(([body, cacheControl]) => {
        setState((prevState) => {
          return {
            ...prevState,
            pageData: { url: pageDataURL, cacheControl },
          };
        });
      });

      // JS files
      const jsURL = join(url, $(`script[src*="webpack-runtime"]`).attr(`src`));
      getUrl(jsURL).then(([body, cacheControl]) => {
        setState((prevState) => {
          return {
            ...prevState,
            JSData: { url: jsURL, cacheControl },
          };
        });
      });
    };
    fetchInitialPage();
  }, []);
  return (
    <Box flexDirection="column">
      <Text>
        Validating headers for the Gatsby site: <Text color="green">{url}</Text>
        <Newline count={2} />
      </Text>
      <Check
        {...state.html}
        label={`HTML`}
        expectedCacheHeader={parseCacheControl(
          `public, max-age=0, must-revalidate`
        )}
      />
      <Newline count={1} />
      <Check
        {...state.appDataJson}
        label={`app-data.json`}
        expectedCacheHeader={parseCacheControl(
          `public, max-age=0, must-revalidate`
        )}
      />
      <Newline count={1} />
      <Check
        {...state.pageData}
        label={`Page Data`}
        expectedCacheHeader={parseCacheControl(
          `public, max-age=0, must-revalidate`
        )}
      />
      <Newline count={1} />
      <Check
        {...state.JSData}
        label={`JavaScript and CSS`}
        expectedCacheHeader={parseCacheControl(
          `public, max-age=31536000, immutable`
        )}
      />
    </Box>
  );
};

module.exports = App;
