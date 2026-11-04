"use client";

import { api, when } from "../lib";
import { ErrorBox, Loading, PageHead, useLoad } from "./ui";

interface Row { id: number; user_name: string; action: string; detail: string; created_at: string }

export function Activity() {
  const { data, error, reload } = useLoad(() => api<{ activity: Row[] }>("activity"));
  if (error) return <ErrorBox text={error} retry={reload} />;
  if (!data) return <Loading />;
  return (
    <>
      <PageHead title="Activity log" sub="Who changed what, newest first (last 300 actions)." actions={<button className="adm-btn" onClick={reload}>Refresh</button>} />
      <div className="adm-table-wrap">
        <table className="adm-table compact">
          <thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead>
          <tbody>
            {data.activity.map((a) => (
              <tr key={a.id}><td>{when(a.created_at)}</td><td>{a.user_name}</td><td><b>{a.action}</b>{a.detail && <span className="adm-muted"> · {a.detail}</span>}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
