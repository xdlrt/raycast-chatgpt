import { clearSearchBar, getPreferenceValues, showToast, Toast } from "@raycast/api";
import { useCallback, useMemo, useState } from "react";
import say from "say";
import { v4 as uuidv4 } from "uuid";
import { Chat, ChatHook, Model } from "../type";
import { chatTransfomer } from "../utils";
import { useAutoTTS } from "./useAutoTTS";
import { getConfiguration, useChatGPT } from "./useChatGPT";
import { useHistory } from "./useHistory";
import OpenAI from "openai";

export function useChat<T extends Chat>(props: T[]): ChatHook {
  const [data, setData] = useState<Chat[]>(props);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isLoading, setLoading] = useState<boolean>(false);
  const [useStream] = useState<boolean>(() => {
    return getPreferenceValues<{
      useStream: boolean;
    }>().useStream;
  });
  const [streamData, setStreamData] = useState<Chat | undefined>();

  const [isHistoryPaused] = useState<boolean>(() => {
    return getPreferenceValues<{
      isHistoryPaused: boolean;
    }>().isHistoryPaused;
  });

  const history = useHistory();
  const isAutoTTS = useAutoTTS();
  const chatGPT = useChatGPT();

  async function ask(question: string, model: Model) {
    clearSearchBar();

    setLoading(true);
    const toast = await showToast({
      title: "Getting your answer...",
      style: Toast.Style.Animated,
    });

    let chat: Chat = {
      id: uuidv4(),
      question,
      answer: "",
      created_at: new Date().toISOString(),
    };

    setData((prev) => {
      return [...prev, chat];
    });

    setTimeout(async () => {
      setSelectedChatId(chat.id);
    }, 50);

    const getHeaders = function () {
      const config = getConfiguration();
      if (!config.useAzure) {
        return { apiKey: "", params: {} };
      }
      return {
        apiKey: config.apiKey,
        params: { "api-version": "2023-03-15-preview" },
      };
    };

    try {
      if (useStream) {
        const stream = await chatGPT
          .chat.completions.create(
            {
              model: model.option,
              temperature: Number(model.temperature),
              messages: [...chatTransfomer(data.reverse(), model.prompt), { role: "user", content: question }],
              stream: true,
            },
          );
        for await (const part of stream) {
          const content = part.choices[0].delta?.content;
          if (content) {
            chat.answer += part.choices[0].delta.content;
            setStreamData({ ...chat, answer: chat.answer });
          }
        }
        setData((prev) => {
          return prev.map((a) => {
            if (a.id === chat.id) {
              return chat;
            }
            return a;
          });
        });

        setTimeout(async () => {
          setStreamData(undefined);
        }, 5);

        setLoading(false);

        toast.title = "Got your answer!";
        toast.style = Toast.Style.Success;

        if (!isHistoryPaused) {
          history.add(chat);
        }
      } else {
        const completion = await chatGPT
          .chat.completions.create(
            {
              model: model.option,
              temperature: Number(model.temperature),
              messages: [...chatTransfomer(data.reverse(), model.prompt), { role: "user", content: question }],
            },
          );

        chat = { ...chat, answer: completion.choices.map((x) => x.message)[0]?.content ?? "" };

        if (typeof chat.answer === "string") {
          setLoading(false);

          toast.title = "Got your answer!";
          toast.style = Toast.Style.Success;

          if (isAutoTTS) {
            say.stop();
            say.speak(chat.answer);
          }

          setData((prev) => {
            return prev.map((a) => {
              if (a.id === chat.id) {
                return chat;
              }
              return a;
            });
          });

          if (!isHistoryPaused) {
            history.add(chat);
          }
        }
      }
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        if (error.status === 429) {
          toast.title = "You've reached your API limit";
          toast.message = "Please upgrade to pay-as-you-go";
        } else {
          toast.title = "Error";
          toast.message = error.message;
        }
      } else {
        toast.title = "Error";
        toast.message = error?.message;
      }
      toast.style = Toast.Style.Failure;
      setLoading(false);
    }
  }

  const clear = useCallback(async () => {
    setData([]);
  }, [setData]);

  return useMemo(
    () => ({ data, setData, isLoading, setLoading, selectedChatId, setSelectedChatId, ask, clear, streamData }),
    [data, setData, isLoading, setLoading, selectedChatId, setSelectedChatId, ask, clear, streamData]
  );
}
