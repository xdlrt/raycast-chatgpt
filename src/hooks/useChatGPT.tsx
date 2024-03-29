import { HttpsProxyAgent } from 'https-proxy-agent';
import { getPreferenceValues } from "@raycast/api";
import OpenAI, { ClientOptions } from "openai";
import { useState } from "react";
import { ConfigurationPreferences } from "../type";
import { getConfigUrl } from "../utils";

export function useChatGPT(): OpenAI {
  const [chatGPT] = useState(() => {
    const preferences = getPreferenceValues<ConfigurationPreferences>();
    const getConfig = function (params: ConfigurationPreferences): ClientOptions {
      return ({
        ...params,
        // baseURL: getConfigUrl(params),
      });
    };
    const config = getConfig(preferences);
    const { proxyProtocol, proxyHost, proxyPort } = preferences;
    if (proxyProtocol && proxyHost && proxyPort) {
      config.httpAgent = new HttpsProxyAgent(`${proxyProtocol}://${proxyHost}:${proxyPort}`);
    }
    return new OpenAI(config);
  });
  return chatGPT;
}

export function getConfiguration(): ConfigurationPreferences {
  return getPreferenceValues<ConfigurationPreferences>();
}
