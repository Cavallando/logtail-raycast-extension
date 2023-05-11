import { Log, LogResponse, Source } from "../lib/types";
import { LogTail } from "../lib/logtail";
import { UseLogTailFetchRenderProps, useLogTailFetch } from "../hooks/useLogTailFetch";
import { ActionPanel, List, Action, Icon, Detail } from "@raycast/api";
import { useState } from "react";
import { useDefaultSourceId } from "../hooks/useDefaultSourceId";
import { QuerySources } from "./QuerySources";
import { getLogLevelColor, removeAnsi } from "../lib/helpers";
import { useMetadataTags } from "../hooks/useMetadataTags";
import { useSavedQueries } from "../hooks/useSavedQueries";

const QueryMessageAction = ({ onSubmit }: { onSubmit: () => void }) => {
  return (
    <Action.SubmitForm
      title="Query for Message"
      icon={Icon.MagnifyingGlass}
      onSubmit={onSubmit}
      shortcut={{ modifiers: ["cmd"], key: "q" }}
    />
  );
};
const CopyMessageAction = ({ content }: { content: string }) => {
  return <Action.CopyToClipboard title="Copy Message" content={content} shortcut={{ modifiers: ["cmd"], key: "m" }} />;
};

const CopyHostAction = ({ content }: { content: string }) => {
  return <Action.CopyToClipboard title="Copy Host" content={content} shortcut={{ modifiers: ["cmd"], key: "h" }} />;
};

const SaveQueryAction = ({ onSubmit }: { onSubmit: () => void }) => {
  return (
    <Action.SubmitForm
      title="Save Query"
      icon={Icon.SaveDocument}
      shortcut={{ modifiers: ["cmd"], key: "s" }}
      onSubmit={onSubmit}
    />
  );
};

const DetailLogMetadata = ({ log }: { log: Log }) => {
  const { data } = useMetadataTags();
  const tags = data ?? [];

  const customMetadata = tags
    .map((tag) => {
      if (log[tag.key]) {
        return (
          <Detail.Metadata.TagList title={tag.label}>
            <Detail.Metadata.TagList.Item text={log[tag.key]} color={tag.color} />
          </Detail.Metadata.TagList>
        );
      }
    })
    .filter((tag) => tag !== undefined);

  return (
    <Detail.Metadata>
      <Detail.Metadata.TagList title="Log Level">
        <Detail.Metadata.TagList.Item text={log["log.level"]} color={getLogLevelColor(log["log.level"])} />
      </Detail.Metadata.TagList>
      <Detail.Metadata.Label key="app" title="LogTail App" text={log._app} />
      <Detail.Metadata.Label key="host" title="Host" text={log.host} />
      {log.dt && <Detail.Metadata.Label key="timestamp" title="Timestamp" text={new Date(log.dt).toISOString()} />}
      {!!customMetadata.length && (
        <>
          <Detail.Metadata.Separator />
          {customMetadata}
        </>
      )}
    </Detail.Metadata>
  );
};

export const QueryLogs = ({ query: _query, sourceId: _sourceId }: { query: string; sourceId?: string }) => {
  const { data } = useDefaultSourceId();
  const [sourceId, setSourceId] = useState(_sourceId ?? data);

  const getQueryString = (query?: string, sourceId?: string) => {
    if (sourceId) {
      return `${query ?? ""}&source_ids=${sourceId}&batch=10`;
    } else {
      return query ?? "";
    }
  };

  const [query, setQuery] = useState<string>(getQueryString(_query, sourceId));

  const renderComponent = ({ data, isLoading, mutate }: UseLogTailFetchRenderProps<LogResponse>) => {
    const { addQuery } = useSavedQueries();
    const handleSearchTextChange = (text: string) => {
      setQuery(text);
      mutate(LogTail.getLogs(`${text}`));
    };

    const handleSaveQuerySubmit = async () => {
      await addQuery(query);
      await mutate(LogTail.getLogs(query));
    };

    const handleQueryMessageSubmit = async (log: Log) => {
      const queryString = getQueryString(removeAnsi(log.message), sourceId);
      setQuery(queryString);
      mutate(LogTail.getLogs(queryString));
    };

    const handleQueryForSource = async (source: Source) => {
      setSourceId(source.id);
      const queryString = getQueryString(query, source.id);
      mutate(LogTail.getLogs(queryString));
    };

    // If we have no log data and no source id, show the query sources
    if (!data?.data.length && !sourceId && !isLoading) {
      return <QuerySources onSubmit={handleQueryForSource} />;
    }

    const renderLog = (log: Log, index: number) => {
      const accessories = [
        {
          tag: { value: "log-level" },
          text: { color: getLogLevelColor(log["log.level"]), value: log["log.level"] ?? "info" },
        },
        {
          tag: "host",
          text: log.host,
        },
        {
          tag: "timestamp",
          date: new Date(log.dt),
        },
      ];

      return (
        <List.Item
          key={index}
          title={removeAnsi(log.message)}
          actions={
            <ActionPanel>
              <Action.Push
                title="Show Details"
                icon={Icon.Info}
                key={`log-${index}`}
                target={
                  <Detail
                    markdown={`\`\`\`\n${removeAnsi(log.message)}\n\`\`\``}
                    actions={
                      <ActionPanel>
                        <CopyMessageAction content={removeAnsi(log.message)} />
                        <CopyHostAction content={log.host} />
                        <QueryMessageAction onSubmit={handleQueryMessageSubmit.bind(this, log)} />
                      </ActionPanel>
                    }
                    metadata={<DetailLogMetadata log={log} />}
                  />
                }
              />
              <SaveQueryAction onSubmit={handleSaveQuerySubmit} />
              <CopyHostAction content={log.host} />
              <CopyMessageAction content={removeAnsi(log.message)} />
              <QueryMessageAction onSubmit={handleQueryMessageSubmit.bind(this, log)} />
            </ActionPanel>
          }
          accessories={accessories}
        />
      );
    };
    return (
      <List searchText={query} isLoading={isLoading} onSearchTextChange={handleSearchTextChange}>
        {data?.data.map(renderLog)}

        {!data?.data.length && <List.EmptyView title="No logs found"></List.EmptyView>}
      </List>
    );
  };

  const [Component] = useLogTailFetch<LogResponse>(
    { url: `https://logtail.com/api/v1/query?query=${getQueryString(query, sourceId)}` },
    renderComponent
  );

  if (Component) {
    return <Component />;
  }

  return null;
};
