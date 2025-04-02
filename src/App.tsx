import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
} from "@codesandbox/sandpack-react";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const getEnvVar = (key: string, defaultValue: string | number | null = null): string | number | null => {
  const envValue =
    typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env[key] : undefined;
  return envValue ?? defaultValue;
};

const API_BASE_URL = getEnvVar('VITE_API_BASE_URL', 'http://localhost:1234/v1') as string;
const API_KEY = getEnvVar('VITE_API_KEY', 'lm-studio') as string;
const MODEL_NAME = getEnvVar('VITE_MODEL_NAME', 'tessa-t1-14b') as string;
const TEMPERATURE = parseFloat(getEnvVar('VITE_TEMPERATURE', '0.7') as string);
const MAX_TOKENS = parseInt(getEnvVar('VITE_MAX_TOKENS', '4096') as string);
const TOP_P = parseFloat(getEnvVar('VITE_TOP_P', '0.95') as string);
const TOP_K = parseInt(getEnvVar('VITE_TOP_K', '40') as string);
const FREQUENCY_PENALTY = parseFloat(getEnvVar('VITE_FREQUENCY_PENALTY', '1.1') as string);
const PRESENCE_PENALTY = parseFloat(getEnvVar('VITE_PRESENCE_PENALTY', '0') as string);

const needsProxy =
  API_BASE_URL &&
  !API_BASE_URL.startsWith('http://localhost') &&
  !API_BASE_URL.startsWith('http://127.0.0.1');
const LLM_ENDPOINT = needsProxy
  ? `/llm-proxy/v1/chat/completions`
  : `${API_BASE_URL}/chat/completions`;

const sandpackIndexHTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sandpack Preview</title>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4" defer></script>
    <style>
      body { margin: 0; font-family: sans-serif; background-color: #f9fafb; }
      #root { min-height: 100vh; display: flex; flex-direction: column; }
    </style>
</head>
<body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <script type="module" src="/App.tsx"></script>
</body>
</html>`;

const sandpackAppCode = `import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import GeneratedComponent from './Component';

function App() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4';
    script.defer = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);
  return (
    <div className="p-4 bg-gradient-to-br from-slate-50 to-stone-100 min-h-screen">
      <GeneratedComponent />
    </div>
  );
}

const container = document.getElementById('root');
if (!container) {
  throw new Error("Could not find root element to mount React app.");
}
const root = ReactDOM.createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;

const defaultGeneratedCode = `import React from 'react';

export default function PlaceholderComponent() {
  return (
    <div className="p-6 border-2 border-dashed border-neutral-300 rounded-lg text-center bg-white shadow-sm">
      <p className="text-lg font-medium text-neutral-500 mb-2">
        AI Component Sandbox
      </p>
      <p className="text-sm text-neutral-400">
        Describe the React component you want in the chat.
        <br />
        The generated code (Editor tab) should use Tailwind v4 classes.
        <br />
        Result will render in the 'Preview' tab via CDN.
      </p>
    </div>
  );
}
`;

const sandpackPackageJson = JSON.stringify({
  name: "ai-react-cdn-sandbox",
  version: "0.1.0",
  private: true,
  dependencies: {
    react: "^18.2.0",
    "react-dom": "^18.2.0",
    "framer-motion": "*",
    "@heroicons/react": "*"
  },
  devDependencies: {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.0.0",
    "react-scripts": "5.0.1"
  },
  scripts: {
    start: "react-scripts start"
  },
  main: "/App.tsx",
  browserslist: {
    production: [">0.2%", "not dead", "not op_mini all"],
    development: ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
  },
}, null, 2);

function App() {
  const [prompt, setPrompt] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [generatedCode, setGeneratedCode] = useState<string>(defaultGeneratedCode);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sandpackKey, setSandpackKey] = useState<number>(Date.now());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [activeSandpackTab, setActiveSandpackTab] = useState<'editor' | 'preview'>('preview');

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = useCallback(async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!prompt.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);

    const newUserMessage: Message = { role: 'user', content: prompt };
    const apiMessages = [...messages, newUserMessage];
    setMessages(apiMessages);
    setPrompt('');

    const payload = {
      model: MODEL_NAME,
      messages: apiMessages,
      temperature: TEMPERATURE,
      max_tokens: 40000,
      top_p: TOP_P,
      top_k: TOP_K,
      repetition_penalty: 1.1,
      presence_penalty: PRESENCE_PENALTY,
      stream: false,
    };

    let rawCode: string | undefined;
    try {
      const response = await fetch(LLM_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(API_KEY && API_KEY !== "lm-studio" ? { 'Authorization': `Bearer ${API_KEY}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.choices && data.choices.length > 0 && data.choices[0].message?.content) {
        rawCode = data.choices[0].message.content;
      } else {
        throw new Error('Invalid response structure from LLM API.');
      }

      const startMarker = '<|im_start|>answer';
      const startMarkerIndex = rawCode.indexOf(startMarker);
      let extractedCode: string;

      if (startMarkerIndex !== -1) {
        extractedCode = rawCode.substring(startMarkerIndex + startMarker.length).trim();
        const endMarkerIM = "<|im_end|>";
        if (extractedCode.endsWith(endMarkerIM)) {
          extractedCode = extractedCode.substring(0, extractedCode.length - endMarkerIM.length).trim();
        }
      } else {
        extractedCode = rawCode
          .replace(/<\|begin_of_thought\|>[\s\S]*<\|end_of_thought\|>/, '')
          .replace(/^```(?:tsx|jsx|javascript|typescript)\s*/, '')
          .replace(/```$/, '')
          .replace(/^(Okay|Sure|Here is|Certainly).*\n?/, '')
          .trim();
      }

      if (extractedCode && !extractedCode.match(/export\s+default\s+/)) {
        const match = extractedCode.match(/(?:function|const)\s+([A-Z]\w*)\s*[=(<{]/);
        if (match && match[1]) {
          extractedCode += `\n\nexport default ${match[1]};`;
        }
      }

      if (!extractedCode) {
        extractedCode = `export default function ErrorComponent() {
          return <div className="text-red-500 p-4 font-semibold">
            Error: Code generation failed or response was empty.
          </div>;
        }`;
        setError("Code generation failed or response was empty.");
      }

      const assistantMessage: Message = { role: 'assistant', content: extractedCode };
      setMessages(prev => [...prev, assistantMessage]);
      setGeneratedCode(extractedCode);
      setSandpackKey(prev => prev + 1);
      setActiveSandpackTab('preview');
    } catch (err: any) {
      const errorMsg = `Error: ${err.message || 'An unknown error occurred.'}`;
      setError(errorMsg);
      const assistantErrorMessage: Message = {
        role: 'assistant',
        content: `Sorry, an error occurred:\n${errorMsg}`
      };
      setMessages(prev => [...prev, assistantErrorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [prompt, messages, isLoading]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const sandpackFiles = useMemo(() => ({
    '/index.html': {
      code: sandpackIndexHTML,
      hidden: true,
    },
    '/App.tsx': {
      code: sandpackAppCode,
      hidden: false,
    },
    '/Component.tsx': {
      code: generatedCode,
      active: true,
    },
    '/package.json': {
      code: sandpackPackageJson,
      hidden: true,
    },
  }), [generatedCode]);

  const baseSandpackOptions = useMemo(() => ({
    entry: '/index.html',
    showLineNumbers: true,
    showInlineErrors: true,
    showConsole: true,
    showConsoleButton: true,
    showTabs: true,
    closableTabs: true,
    visibleFiles: ['/Component.tsx', '/App.tsx', '/index.html'],
    activeFile: '/Component.tsx',
  }), []);

  return (
    <div className="flex h-screen bg-zinc-100 text-sm font-sans">
      {}
      <div className="w-3/5 h-full flex flex-col border-r border-neutral-300 bg-white">
        <div className="flex border-b border-neutral-200 flex-shrink-0">
          <button
            onClick={() => setActiveSandpackTab('editor')}
            className={`px-4 py-2 text-sm font-medium focus:outline-none ${
              activeSandpackTab === 'editor'
                ? 'border-b-2 border-sky-500 text-sky-600 bg-sky-50'
                : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            Editor
          </button>
          <button
            onClick={() => setActiveSandpackTab('preview')}
            className={`px-4 py-2 text-sm font-medium focus:outline-none ${
              activeSandpackTab === 'preview'
                ? 'border-b-2 border-sky-500 text-sky-600 bg-sky-50'
                : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setSandpackKey(Date.now())}
            title="Force Sandpack Refresh"
            className="ml-auto mr-2 px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 rounded focus:outline-none"
          >
            🔄
          </button>
        </div>

        <div className="flex-grow overflow-hidden relative">
          <SandpackProvider
            key={sandpackKey}
            template="react-ts"
            files={sandpackFiles}
            theme="dark"
            options={baseSandpackOptions}
          >
            <SandpackLayout style={{ height: '100%' }} theme="dark">
              <div
                style={{
                  display: activeSandpackTab === 'editor' ? 'block' : 'none',
                  height: '100%',
                }}
              >
                <SandpackCodeEditor
                  style={{ height: '100%' }}
                  showLineNumbers
                  showTabs
                  closableTabs
                />
              </div>
              <div
                style={{
                  display: activeSandpackTab === 'preview' ? 'block' : 'none',
                  height: '100%',
                }}
              >
                <SandpackPreview
                  className="custom-preview"
                  style={{ height: '900px', width: '1150px' }}
                  showNavigator={true}
                  showRefreshButton={true}
                  showOpenInCodeSandbox={false}
                />
              </div>
            </SandpackLayout>
          </SandpackProvider>
        </div>
      </div>

      {}
      <div className="w-2/5 h-full flex flex-col bg-white shadow-lg">
        <div className="p-3 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between flex-shrink-0">
          <h2 className="text-base font-semibold text-neutral-700">Tesslate Studio Lite</h2>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            isLoading ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-emerald-100 text-emerald-700'
          }`}>
            {isLoading ? 'Generating...' : 'Ready'}
          </span>
        </div>

        <div className="flex-grow p-4 overflow-y-auto space-y-4 bg-gradient-to-b from-white to-neutral-50">
          {messages.map((msg, index) => (
            <div key={`${msg.role}-${index}`} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <span className={`text-xs mb-1 font-medium ${msg.role === 'user' ? 'text-blue-600 mr-2' : 'text-purple-600 ml-2'}`}>
                {msg.role === 'user' ? 'You' : 'Assistant'}
              </span>
              <div className={`px-3 py-2 rounded-lg max-w-[90%] shadow-sm text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white rounded-br-none'
                  : 'bg-neutral-100 text-neutral-800 border border-neutral-200 rounded-bl-none'
              }`}>
                {msg.role === 'assistant' ? (
                  <pre className="whitespace-pre-wrap font-mono text-xs">
                    <code>{msg.content}</code>
                  </pre>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}
          {error && !isLoading && (
            <div className="flex flex-col items-start mt-2">
              <span className="text-xs mb-1 text-red-600 ml-2 font-semibold">System Error</span>
              <div className="p-2 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs max-w-[90%]">
                {error}
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 border-t border-neutral-200 bg-neutral-100 flex-shrink-0">
          <form onSubmit={handleSubmit} className="flex space-x-2 items-center">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe a component (e.g., loading spinner)"
              className="flex-grow px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm disabled:bg-neutral-200"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !prompt.trim()}
              className={`px-4 py-2 rounded-md text-white text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                isLoading || !prompt.trim() ? 'bg-neutral-400 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-700 focus:ring-sky-500'
              }`}
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;