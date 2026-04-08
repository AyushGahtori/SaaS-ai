const mermaid = "```mermaid\nflowchart TD\nA-->B\n```";
const state = { code: mermaid, mermaid: { theme: "default" } };
const jsonStr = JSON.stringify(state);
const base64Str = btoa(unescape(encodeURIComponent(jsonStr)));
const url = `https://mermaid.ink/img/${base64Str}`;
console.log("URL:", url);

fetch(url).then(res => {
    console.log("Status:", res.status);
    console.log("Content-Type:", res.headers.get("content-type"));
}).catch(console.error);
