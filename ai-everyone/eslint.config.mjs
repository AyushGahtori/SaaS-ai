import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const reactHooksCompilerRules = {
  "react-hooks/purity": "off",
  "react-hooks/set-state-in-effect": "off",
  "react-hooks/refs": "off",
  "react-hooks/immutability": "off",
};

const config = [
  ...nextCoreWebVitals,
  {
    ignores: ["EC2/**", "new_agents/**"],
  },
  {
    files: [
      "**/*.test.{js,jsx,ts,tsx}",
      "**/*.spec.{js,jsx,ts,tsx}",
      "**/__tests__/**/*.{js,jsx,ts,tsx}",
      "scripts/**/*.{js,mjs,cjs,ts,tsx}",
    ],
    rules: reactHooksCompilerRules,
  },
  {
    files: [
      "src/components/ui/sidebar.tsx",
      "src/modules/bloom-ai/ui/components/bloom-habit-tracker-view.tsx",
      "src/modules/bloom-ai/ui/components/bloom-notes-view.tsx",
      "src/modules/chat/ui/components/VoiceBar.tsx",
      "src/modules/chat/ui/components/agent-renderers/strata-result-card.tsx",
      "src/modules/chat/ui/components/chat-message-list.tsx",
    ],
    rules: reactHooksCompilerRules,
  },
];

export default config;
