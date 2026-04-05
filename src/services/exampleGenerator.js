const WORKER_URL = "https://openaiproxy.sergeisu00.workers.dev/";
const MODEL = "gpt-5.4";

export async function askGpt(messages) {
  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      messages
    })
  });

  const data = await res.json();

  if (!res.ok) {
    throw data;
  }

  return data.text;
}
