const mermaid = "```mermaid\nflowchart TD\nA-->B\n```";

let cleanMermaid = mermaid.trim();
if (cleanMermaid.startsWith("```mermaid")) {
    cleanMermaid = cleanMermaid.replace(/^```mermaid\n?/, "").replace(/\n?```$/, "");
} else if (cleanMermaid.startsWith("```")) {
    cleanMermaid = cleanMermaid.replace(/^```\n?/, "").replace(/\n?```$/, "");
}

const state = { code: cleanMermaid, mermaid: { theme: "default" } };
const jsonStr = JSON.stringify(state);
const base64Str = btoa(unescape(encodeURIComponent(jsonStr)));
const url = `https://mermaid.ink/img/${base64Str}`;

fetch(url).then(res => {
    console.log("Clean string:", JSON.stringify(cleanMermaid));
    console.log("Status:", res.status);
}).catch(console.error);
