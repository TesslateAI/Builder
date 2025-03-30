// src/App.tsx
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
    SandpackProvider,
    SandpackLayout,
    SandpackPreview,
    SandpackCodeEditor,
    SandpackFileExplorer,
    SandpackFiles,
    // SandpackThemeProp, // Type hint not needed if theme isn't set explicitly
    // SandpackTheme, // Type not needed
    // githubLight, // Example theme removed
    // sandpackDark // Explicit theme removed
} from "@codesandbox/sandpack-react";
import {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
    // GenerateContentRequest, // Not directly used now
    Content,
} from "@google/generative-ai";
// Icons
import { LuPanelLeft, LuCode, LuEye, LuExternalLink, LuLoader, LuSend, LuWandSparkles, LuTriangleAlert, LuFilePenLine, LuX, LuClipboardCopy } from "react-icons/lu"; // Correct icon name

// --- Types ---

interface FileEntry {
    code: string;
    prompt: string;
}

interface FilesState {
    [key: string]: FileEntry;
}

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

// --- LLM Configuration ---

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.REACT_APP_GEMINI_API_KEY || "YOUR_API_KEY_HERE"; // <<< --- !!! REPLACE OR USE ENV VARS !!!

if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
    console.error("Error: Gemini API Key not found or placeholder used. Please set VITE_GEMINI_API_KEY or REACT_APP_GEMINI_API_KEY in your environment.");
}

const genAI = apiKey && apiKey !== "YOUR_API_KEY_HERE" ? new GoogleGenerativeAI(apiKey) : null;
const model = genAI?.getGenerativeModel({ model: "gemini-1.5-flash" });

const generationConfig = {
    temperature: 0.6,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
};

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// --- Static Sandpack Files ---

const STATIC_INDEX_HTML = `<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI React Preview</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = { darkMode: 'class' }
    </script>
    <style>
      html, body, #root { height: 100%; margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: sans-serif; background-color: #111827; color: #f3f4f6; }
      .dark body { background-color: #111827; color: #f3f4f6; }
    </style>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>`;

const STATIC_PACKAGE_JSON = JSON.stringify({
    "dependencies": { "react": "^18.2.0", "react-dom": "^18.2.0" },
    "devDependencies": { "react-scripts": "5.0.1", "@types/react": "^18.2.45", "@types/react-dom": "^18.2.18", "typescript": "^5.0.0", "tailwindcss": "^3.4.0" },
    "main": "/index.tsx", "scripts": { "start": "react-scripts start", "build": "react-scripts build" }, "browserslist": [">0.2%", "not dead", "not op_mini all"]
}, null, 2);

const STATIC_INDEX_TSX = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');
const root = ReactDOM.createRoot(rootElement);
root.render(<React.StrictMode><App /></React.StrictMode>);`;

const STATIC_TSCONFIG_JSON = JSON.stringify({
    "compilerOptions": { "target": "es6", "lib": ["dom", "dom.iterable", "esnext"], "allowJs": true, "skipLibCheck": true, "esModuleInterop": true, "allowSyntheticDefaultImports": true, "strict": true, "forceConsistentCasingInFileNames": true, "noFallthroughCasesInSwitch": true, "module": "esnext", "moduleResolution": "node", "resolveJsonModule": true, "isolatedModules": true, "noEmit": true, "jsx": "react-jsx" },
    "include": ["src", "**/*.ts", "**/*.tsx"], "exclude": ["node_modules"]
}, null, 2);

// --- Helper Function for Standalone Preview ---
const generateStandaloneHtml = (files: SandpackFiles): string => {
    const indexHtmlCode = files['/index.html']?.code || STATIC_INDEX_HTML;
    const indexTsxCode = files['/index.tsx']?.code || STATIC_INDEX_TSX;
    const appTsxCode = files['/App.tsx']?.code || 'export default function App() { return "App not found"; }';

    const scriptsToInject = `
<script type="module">
  // Basic error overlay
  window.onerror = function(message, source, lineno, colno, error) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;padding:20px;background-color:rgba(200,0,0,0.9);color:white;z-index:9999;font-family:monospace;border-bottom:2px solid black;';
    errorDiv.innerHTML = \`<h2>Runtime Error:</h2><pre>\${message}\\nSource: \${source} (\${lineno}:\${colno})\\n\${error?.stack || ''}</pre>\`;
    document.body.prepend(errorDiv); // Prepend to be more visible
    console.error("Standalone Preview Error:", message, source, lineno, colno, error);
  };

  try {
    // Simulate React/ReactDOM if not present (basic)
    if (typeof React === 'undefined') window.React = await import('https://esm.sh/react@18');
    if (typeof ReactDOM === 'undefined') window.ReactDOM = await import('https://esm.sh/react-dom@18/client');

     // This is a VERY simplified module simulation and might break easily
     const AppModule = { exports: {} };
     (function(module, exports) {
        // Attempt to execute App.tsx code, exporting the default
        try {
            ${appTsxCode.replace(/export default\s+/,'module.exports.default = ')}
        } catch(e) { console.error('Error executing App.tsx:', e); throw e; }
     })(AppModule, AppModule.exports);
     const App = AppModule.exports.default;


     // Attempt to execute index.tsx code
    (function() {
        try {
             // Replace import App with the executed version
             ${indexTsxCode.replace(/import\s+App\s+from\s+['"].\/App['"];?/,'')}
             // Ensure React and ReactDOM are available globally or via imports if index.tsx uses them
        } catch(e) { console.error('Error executing index.tsx:', e); throw e; }
    })();

  } catch (e) {
     console.error("Standalone Preview Setup Error:", e);
     window.onerror(e.message || 'Setup Error', 'Inline Script', 0, 0, e);
  }
</script>
`;
    const finalHtml = indexHtmlCode.replace('</body>', `${scriptsToInject}</body>`);
    return finalHtml;
};

// --- Robust JSON Parsing Helper (for decomposePrompt ONLY) ---
const fixControlCharsInStrings = (jsonString: string): string => {
    return jsonString.replace(/"((?:\\.|[^"\\])*)"/g, (match, group1) => {
        const cleanedGroup = group1.replace(/[\n\r](?!\\[rn"\\])/g, '\\n');
        return `"${cleanedGroup}"`;
    });
};

const extractAndParseJson = (text: string): Record<string, string> | null => {
    const fencedMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (fencedMatch && fencedMatch[1]) {
        try {
            return JSON.parse(fixControlCharsInStrings(fencedMatch[1].trim()));
        } catch (e) {
            console.warn("Failed to parse fenced JSON block, trying broader search. Error:", e);
        }
    }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const potentialJson = text.substring(firstBrace, lastBrace + 1);
        try {
            return JSON.parse(fixControlCharsInStrings(potentialJson.trim()));
        } catch (e) {
            console.warn("Failed to parse extracted JSON block { ... }, trying full text. Error:", e);
        }
    }
    try {
        return JSON.parse(fixControlCharsInStrings(text.trim()));
    } catch (e) {
        console.error("Failed to parse JSON directly from cleaned text. Error:", e);
        return null;
    }
};


// --- Main App Component ---

function App() {
    const [initialPrompt, setInitialPrompt] = useState<string>("Create a simple responsive React component using Tailwind CSS that displays a user profile card with an avatar, name, and bio.");
    const [files, setFiles] = useState<FilesState>({});
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [userChatInput, setUserChatInput] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [loadingMessage, setLoadingMessage] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [previewMode, setPreviewMode] = useState<'preview' | 'code'>('preview');
    const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({});
    const [apiConfigured, setApiConfigured] = useState<boolean>(false);
    const [sandpackKey, setSandpackKey] = useState<number>(Date.now());

    const chatHistoryRef = useRef<HTMLDivElement>(null);
    const standalonePreviewUrl = useRef<string | null>(null);

    // --- Effects ---
    useEffect(() => {
        const configured = !!(apiKey && apiKey !== "YOUR_API_KEY_HERE" && model);
        setApiConfigured(configured);
        if (!configured && !error) {
            setError("Gemini API Key missing/invalid or model failed to initialize. AI features disabled.");
        }
    }, [error]);

    useEffect(() => {
         if (chatHistoryRef.current) {
             chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
         }
     }, [chatHistory]);

    useEffect(() => {
         return () => {
             if (standalonePreviewUrl.current) URL.revokeObjectURL(standalonePreviewUrl.current);
         };
     }, []);

    // --- API Call Function ---
    const callGeminiAPI = useCallback(async (prompt: string, history?: Content[]): Promise<string> => {
        if (!model) {
            setError("Gemini model not initialized. Check API Key.");
            throw new Error("Gemini model not initialized.");
        }
        setError(null);
        console.log("Sending prompt to Gemini (length):", prompt.length);
        // console.log("Sending prompt to Gemini:", prompt); // Keep this commented unless debugging large prompts

        try {
            const chatSession = model.startChat({ generationConfig, safetySettings, history: history || [] });
            const result = await chatSession.sendMessage(prompt);
            const response = result.response;
            // console.log("Gemini API Response:", response); // Verbose

            if (!response || !response.candidates || response.candidates.length === 0) {
                const feedback = response?.promptFeedback;
                const reason = feedback?.blockReason;
                throw new Error(`API Error: No candidates returned.${reason ? ` Block Reason: ${reason}` : ''}`);
            }

            const candidate = response.candidates[0];
            if (candidate.finishReason && ['SAFETY', 'RECITATION', 'OTHER'].includes(candidate.finishReason)) {
                throw new Error(`API request failed/blocked. Finish Reason: ${candidate.finishReason}. Ratings: ${JSON.stringify(candidate.safetyRatings)}`);
            }

            const responseText = candidate.content?.parts?.map(part => part.text).join('') || "";
             if (!responseText && candidate.finishReason !== 'STOP') {
                 console.warn("API Warning: Empty response text but finishReason was not STOP.", response);
             }
             return responseText;
        } catch (e: any) {
            console.error("Error calling Gemini API:", e);
            let errorMessage = `Failed to communicate with the AI. ${e.message || ''}`;
            if (e.response?.data?.error?.message) errorMessage += ` API Error: ${e.response.data.error.message}`;
            setError(errorMessage);
            throw e;
        }
    }, []); // setError removed as dep, it's stable. Dependencies are implicitly captured.


    // --- Core Logic Functions ---

    // UNCHANGED: Expects JSON output for prompts
    const decomposePrompt = useCallback(async (userPrompt: string) => {
        if (!apiConfigured) return setError("API not configured. Cannot generate project.");
        setIsLoading(true);
        setLoadingMessage("Analyzing requirements & planning files...");
        setChatHistory([{ role: 'user', text: `Generate project: ${userPrompt}` }]);
        setFiles({});
        setEditedPrompts({});
        setError(null);

        const metaPrompt = `
You are an expert React developer using TypeScript, Tailwind CSS, and modern Hooks.
User Request: "${userPrompt}"

1.  **Analyze & Plan:** Decompose the request into logical React components and necessary config files (e.g., /App.tsx, /index.tsx, /components/..., /index.html, /package.json, /tsconfig.json). Use standard conventions. Entry point MUST be /index.tsx rendering /App.tsx.
2.  **Generate Prompts:** For EACH file: create a detailed prompt string describing EXACTLY what content that file should contain. For TSX files, specify purpose, props (TS interface), state, logic, Tailwind styling (directly in JSX), imports, exports. For HTML/JSON, specify the exact structure/content needed.
3.  **Output Format:** Respond ONLY with a valid JSON object. Keys are full file paths (e.g., "/components/Button.tsx"). Values are the detailed prompts (strings). Ensure valid JSON escaping within prompt strings. No extra text outside the JSON object.

**Example JSON Structure (ensure valid JSON escaping):**
{
  "/index.html": "Create standard HTML5 boilerplate: UTF-8, viewport, title 'AI React Preview'. Add Tailwind CDN script (<script src=\\"https://cdn.tailwindcss.com\\"></script>) and config script (tailwind.config = {darkMode:'class'}). Add <div id=\\"root\\"></div>. Style body for dark mode (bg-gray-900 text-gray-100) and root height 100%. Add 'dark' class to <html>.",
  "/package.json": "Create package.json: dependencies { react, react-dom: ^18.2.0 }. devDependencies { react-scripts, @types/react, @types/react-dom, typescript, tailwindcss }. main: /index.tsx. scripts { start, build }.",
  "/tsconfig.json": "Create standard tsconfig.json for React+TS: target es6, jsx react-jsx, module esnext, moduleResolution node, strict true, include src/**, exclude node_modules.",
  "/index.tsx": "{\\"purpose\\":\\"React entry point\\",\\"logic\\":\\"Import React, ReactDOM, App from './App'. Render <App /> in StrictMode into 'root' element.\\",\\"styling\\":\\"Global Tailwind via index.html.\\",\\"imports\\": [\\"react\\", \\"react-dom/client\\", \\"./App\\"],\\"exports\\":\\"None\\"}",
  "/App.tsx": "{\\"purpose\\":\\"Main app layout\\",\\"state\\":\\"None\\",\\"logic\\":\\"Render UserProfile component.\\",\\"styling\\":\\"Use Tailwind: main container flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4.\\",\\"imports\\": [\\"./components/UserProfile\\"],\\"exports\\":\\"Default\\"}",
  "/components/UserProfile.tsx": "{\\"purpose\\":\\"User info card\\",\\"props\\":\\"interface UserProfileProps { avatarUrl: string; name: string; bio: string; }\\",\\"logic\\":\\"Render img, h2 (name), p (bio) using props.\\",\\"styling\\":\\"Use Tailwind: Card 'bg-gray-800 rounded-lg shadow-md p-6 w-full max-w-sm'. Avatar 'w-24 h-24 rounded-full mx-auto mb-4 object-cover'. Name 'text-xl font-semibold text-white text-center'. Bio 'text-gray-400 text-center text-sm mt-2'.\\",\\"imports\\": [\\"react\\"],\\"exports\\":\\"Default\\"}"
}

Return ONLY the raw, valid JSON object.
        `;

        try {
            const response = await callGeminiAPI(metaPrompt);
            setChatHistory(prev => [...prev, { role: 'model', text: `Okay, planned the structure. Preparing files...` }]);
            const parsedPrompts = extractAndParseJson(response);

            if (!parsedPrompts) {
                 const errorMsg = "AI response for decomposition was not valid JSON. Cannot proceed. Check console.";
                 console.error(errorMsg, "Raw Response:", response);
                 setError(errorMsg);
                 setChatHistory(prev => [...prev, { role: 'model', text: `Error: ${errorMsg}` }]);
                 setIsLoading(false);
                 return;
            }

            const initialFilesState: FilesState = {};
            const initialEditedPrompts: Record<string, string> = {};
            const requiredFiles = ["/index.html", "/package.json", "/tsconfig.json", "/index.tsx", "/App.tsx"];
            requiredFiles.forEach(reqFile => {
                if (!parsedPrompts[reqFile]) {
                    console.warn(`LLM did not provide a prompt for required file: ${reqFile}. Adding placeholder.`);
                    // Add more specific placeholder prompts if needed
                    parsedPrompts[reqFile] = `Generate standard content for ${reqFile}.`;
                }
            });

            for (const filename in parsedPrompts) {
                if (Object.hasOwnProperty.call(parsedPrompts, filename)) {
                    initialFilesState[filename] = { prompt: parsedPrompts[filename], code: "// Pending Generation..." };
                    initialEditedPrompts[filename] = parsedPrompts[filename];
                }
            }
            setFiles(initialFilesState);
            setEditedPrompts(initialEditedPrompts); // Initialize edited prompts

            await generateAllFiles(initialFilesState); // Pass state

        } catch (error) {
            console.error("Decomposition process failed:", error);
             if (!error) setError("Unexpected error during project decomposition.");
             setChatHistory(prev => [...prev, { role: 'model', text: `Error during decomposition: ${error instanceof Error ? error.message : 'Unknown'}` }]);
        } finally {
            setIsLoading(false);
            setLoadingMessage("");
        }
    }, [apiConfigured, callGeminiAPI]); // setError removed


    // UPDATED: Always asks LLM for raw file content based on prompt.
    const generateCodeForFile = useCallback(async (filename: string, prompt: string): Promise<string> => {
        const codeGenPrompt = `
Generate the complete, production-ready code/content for the file named \`${filename}\` based *only* on the following prompt details.
- Output ONLY the raw code/content for the file.
- Do NOT include any explanations, comments outside the code (unless requested in the prompt), or markdown formatting (like \`\`\`tsx or \`\`\`json).
- Ensure the output is valid for the specified file type (${filename}).
- For TSX files: Use Tailwind CSS utility classes directly in the JSX as requested.
- Adhere strictly to all requirements stated in the prompt below.

Prompt for ${filename}:
---
${prompt}
---

Generate the raw file content now:
`;
        try {
            const code = await callGeminiAPI(codeGenPrompt);
            // Basic cleaning: remove potential markdown fences and trim whitespace
            return code.replace(/^```(?:tsx|typescript|javascript|jsx|html|css|json)?\s*|```$/g, '').trim();
        } catch (e) {
             console.error(`Failed to generate code for ${filename}:`, e);
             // Error state is handled by the caller (generateAllFiles/handleUpdateFile) via setError
             // Return code indicating error for display purposes
             return `/* Error generating code for ${filename}. \nPrompt:\n${prompt}\n---\nError: ${e instanceof Error ? e.message : 'Unknown error'}\n*/`;
        }
    }, [callGeminiAPI]); // Only depends on callGeminiAPI


    const generateAllFiles = useCallback(async (currentFilesState: FilesState) => {
        if (!apiConfigured) return setError("API not configured. Cannot generate files.");
        setIsLoading(true);
        setLoadingMessage("Generating code for files...");
        setChatHistory(prev => [...prev, { role: 'model', text: "Generating code for all files..." }]);
        const filenames = Object.keys(currentFilesState);
        const newFilesState = { ...currentFilesState }; // Local copy to update
        let firstErrorFile = null;
        let allSucceeded = true;

        for (const filename of filenames) {
             if (!apiConfigured) {
                 setError("API configuration lost during generation.");
                 allSucceeded = false;
                 break;
             }
             setLoadingMessage(`Generating ${filename}...`);
             const prompt = currentFilesState[filename]?.prompt;
             if (!prompt) {
                 console.warn(`Skipping ${filename}: No prompt found.`);
                 newFilesState[filename] = { ...(newFilesState[filename] || { prompt: '' }), code: `/* Error: Prompt was missing. */` };
                 if (!firstErrorFile) firstErrorFile = filename;
                 allSucceeded = false;
                 continue;
             }

             try {
                 const generatedCode = await generateCodeForFile(filename, prompt);
                 newFilesState[filename] = { ...newFilesState[filename], code: generatedCode };
                 setFiles(prev => ({ ...prev, [filename]: newFilesState[filename] })); // Update UI progressively

                 if (generatedCode.startsWith('/* Error')) {
                     if (!firstErrorFile) firstErrorFile = filename;
                     allSucceeded = false;
                     // Error message already set by callGeminiAPI -> generateCodeForFile
                     setError(`Error generating ${filename}. Check prompt/code.`); // Also set top-level error
                 }
             } catch (error) { // Catch errors from callGeminiAPI itself if generateCodeForFile re-throws
                 console.error(`API call failed for ${filename}:`, error);
                 if (!firstErrorFile) firstErrorFile = filename;
                 allSucceeded = false;
                 const errorMessage = `/* API Call Error during generation for ${filename}. Check console. */`;
                 newFilesState[filename] = { ...newFilesState[filename], code: errorMessage };
                 setFiles(prev => ({ ...prev, [filename]: newFilesState[filename] }));
                 setError(`API Error generating ${filename}. ${error instanceof Error ? error.message : ''}`); // Set top-level error
                 // Optionally break the loop: break;
             }
         }

        const finalMessage = allSucceeded
            ? "Code generation complete!"
            : `Generation finished. ${firstErrorFile ? `Error occurred generating: ${firstErrorFile}. Check file prompt/code and console.` : 'Errors occurred.'}`;

        setLoadingMessage("");
        setIsLoading(false);
        setChatHistory(prev => [...prev, { role: 'model', text: finalMessage }]);
        setSandpackKey(prev => prev + 1);
        // Keep error message if generation failed
        // if (!allSucceeded && !error) { // Only set if no specific error was already set
        //    setError(finalMessage);
        // }

    }, [generateCodeForFile, apiConfigured]); // setError removed

     const handleUpdateFile = useCallback(async (filename: string) => {
         if (!apiConfigured) return setError("API not configured. Cannot update file.");
         const promptToUse = editedPrompts[filename];
         const originalFileEntry = files[filename];

         if (!promptToUse || !originalFileEntry) return;
         if (promptToUse === originalFileEntry.prompt && !originalFileEntry.code.startsWith("/* Error")) {
             return; // No change and no error, skip
         }

         setIsLoading(true);
         setLoadingMessage(`Updating ${filename}...`);
         setChatHistory(prev => [...prev, { role: 'user', text: `Update code for: ${filename} (prompt changed)` }]);
         setFiles(prev => ({ ...prev, [filename]: { ...prev[filename], code: "// Regenerating..." } }));
         setError(null);

         try {
             const generatedCode = await generateCodeForFile(filename, promptToUse);
             setFiles(prev => ({ ...prev, [filename]: { prompt: promptToUse, code: generatedCode } }));
             setEditedPrompts(prev => ({ ...prev, [filename]: promptToUse })); // Sync edited prompt after success
             setChatHistory(prev => [...prev, { role: 'model', text: `Code for ${filename} updated.` }]);
             setSandpackKey(prev => prev + 1);
              if (generatedCode.startsWith('/* Error')) {
                  setError(`Error generating ${filename}. Check prompt/code.`); // Set top-level error
              }
         } catch (error) {
             setChatHistory(prev => [...prev, { role: 'model', text: `Error updating ${filename}. ${error instanceof Error ? error.message : ''}` }]);
             // Error state is set by callGeminiAPI -> generateCodeForFile -> setError
             // Revert code display to show error, keep edited prompt
             setFiles(prev => ({
                 ...prev,
                 [filename]: {
                     prompt: promptToUse,
                     code: `/* Error regenerating code for ${filename}. Check logs.\n---\n${originalFileEntry?.code?.includes('Error') ? '// Previous code had errors' : originalFileEntry?.code || ''}`
                 }
            }));
         } finally {
             setIsLoading(false);
             setLoadingMessage("");
         }
     }, [generateCodeForFile, editedPrompts, files, apiConfigured]); // setError removed

     const handlePromptChange = (filename: string, newPrompt: string) => {
        setEditedPrompts(prev => ({ ...prev, [filename]: newPrompt }));
    };

    const handleChatSubmit = useCallback(async () => {
         if (!userChatInput.trim() || !apiConfigured) return;
         const currentInput = userChatInput;
         setUserChatInput("");
         setIsLoading(true);
         setLoadingMessage("AI Assistant is thinking...");
         const currentUserMsg: ChatMessage = { role: 'user', text: currentInput };
         setChatHistory(prev => [...prev, currentUserMsg]);
         setError(null);

         const currentHistory = [...chatHistory, currentUserMsg]; // Use history including the new user message

         const contextPrompt = `
You are an AI assistant embedded in a web dev environment helping a user build a React/Tailwind app.
Original project goal: "${initialPrompt}"
Current files and their LATEST prompts:
${Object.entries(editedPrompts).map(([name, prompt]) => `- ${name}: ${prompt.substring(0, 150)}...`).join("\n")}

Conversation History (recent):
${currentHistory.slice(-6).map(msg => `${msg.role}: ${msg.text}`).join("\n")}

Task: Respond to the LATEST user message ("${currentInput}").
- Focus on guiding the user to modify the PROMPTS in the "File Prompts" panel to achieve their goal. Explain *why* the prompt change is needed (relate to Tailwind classes, logic, props etc.).
- **Do NOT generate raw code blocks.** Example guidance: "To make the button red, change the 'styling' in the prompt for /components/Button.tsx to include 'bg-red-600 hover:bg-red-700'".
- Answer general questions concisely. Ask for clarification if needed.

Assistant's helpful response:
         `;
          const geminiHistory: Content[] = currentHistory.slice(0, -1).map(msg => ({
              role: msg.role === 'user' ? 'user' : 'model',
              parts: [{ text: msg.text }]
          }));

         try {
             const response = await callGeminiAPI(contextPrompt, geminiHistory);
             setChatHistory(prev => [...prev, { role: 'model', text: response }]);
         } catch (error) {
              setChatHistory(prev => [...prev, { role: 'model', text: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}` }]);
              // Error state likely set by callGeminiAPI
         } finally {
             setIsLoading(false);
             setLoadingMessage("");
         }
     }, [userChatInput, chatHistory, initialPrompt, editedPrompts, files, apiConfigured, callGeminiAPI]); // Using editedPrompts now for context

    const handleOpenInNewTab = () => {
        if (!sandpackFiles) return;
        try {
            const htmlContent = generateStandaloneHtml(sandpackFiles);
            const blob = new Blob([htmlContent], { type: 'text/html' });
            if (standalonePreviewUrl.current) URL.revokeObjectURL(standalonePreviewUrl.current);
            standalonePreviewUrl.current = URL.createObjectURL(blob);
            window.open(standalonePreviewUrl.current, '_blank');
        } catch (error) {
            console.error("Error generating/opening standalone preview:", error);
            setError("Failed to create standalone preview. Check console.");
        }
    };

    const handleCopyToClipboard = async (text: string) => {
        if (!navigator.clipboard) return setError("Clipboard API unavailable.");
        try {
          await navigator.clipboard.writeText(text);
          // Optional: Show temporary success message
        } catch (err) {
          console.error("Failed to copy text: ", err);
          setError("Failed to copy text.");
        }
      };

    // --- Sandpack File Preparation ---
    const sandpackFiles = useMemo((): SandpackFiles | null => {
        const requiredKeys = ["/index.html", "/package.json", "/index.tsx", "/App.tsx"];
        const hasRequiredFiles = requiredKeys.every(key => files[key]?.code && !files[key].code.startsWith("// Pending"));

        if (Object.keys(files).length === 0) return {}; // Initial state
        if (!hasRequiredFiles) {
             // Only log error if files were expected but missing/pending
             if (Object.keys(files).length > 0) {
                console.warn("Waiting for essential Sandpack files to be generated...", files);
             }
             return null; // Indicate Sandpack cannot be initialized yet
        }

        const outputFiles: SandpackFiles = {};
        // Add all files from state, using fallbacks for core files just in case
        outputFiles['/index.html'] = { code: files['/index.html']?.code || STATIC_INDEX_HTML, hidden: true };
        outputFiles['/package.json'] = { code: files['/package.json']?.code || STATIC_PACKAGE_JSON, hidden: true };
        outputFiles['/tsconfig.json'] = { code: files['/tsconfig.json']?.code || STATIC_TSCONFIG_JSON, hidden: true };
        outputFiles['/index.tsx'] = { code: files['/index.tsx']?.code || STATIC_INDEX_TSX };
        outputFiles['/App.tsx'] = { code: files['/App.tsx']?.code || 'export default function App() { return "App.tsx not generated"; }' };

        for (const filename in files) {
            if (!outputFiles[filename]) { // Add other files
                 outputFiles[filename] = { code: files[filename]?.code || `// Error: Code missing for ${filename}` };
            }
        }

        // Set active file
        const activeFile = outputFiles['/App.tsx'] ? '/App.tsx' : '/index.tsx';
        if (outputFiles[activeFile]) {
            outputFiles[activeFile] = { ...outputFiles[activeFile], active: true };
        } else if (outputFiles['/index.tsx']) { // Fallback
            outputFiles['/index.tsx'] = { ...outputFiles['/index.tsx'], active: true };
        }

        return outputFiles;
    }, [files]);

    // --- Render ---

    const canRenderSandpack = sandpackFiles && Object.keys(sandpackFiles).length > 3;

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-gray-900 text-gray-100">
            <PanelGroup direction="horizontal" className="flex-grow">
                {/* Left Panel: Chat & Config */}
                <Panel defaultSize={25} minSize={15} maxSize={50} className="flex flex-col">
                    <div className="relative flex-grow flex flex-col bg-gray-800 border-r border-gray-700 h-full overflow-hidden">
                         {isLoading && (
                             <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
                                 <LuLoader className="animate-spin text-4xl text-blue-400 mb-3" />
                                 <p className="text-lg font-medium text-gray-200">{loadingMessage || "Processing..."}</p>
                             </div>
                         )}
                         <div className="flex-shrink-0 p-3 border-b border-gray-700 bg-gray-800 flex items-center gap-2">
                             <LuPanelLeft className="text-blue-400" />
                             <h2 className="text-lg font-semibold">Chat & Config</h2>
                         </div>
                        {error && (
                            <div className="flex-shrink-0 p-3 bg-red-900/60 border-b border-red-700 text-red-200 flex items-start gap-2 text-sm shadow-inner"> {/* Changed items-center to items-start */}
                                <LuTriangleAlert className="flex-shrink-0 text-red-400 mt-0.5" size={18}/> {/* Corrected Icon & Added margin-top */}
                                <span className="flex-grow break-words">{error}</span>
                                <button onClick={() => setError(null)} title="Dismiss Error" className="ml-2 p-1 rounded hover:bg-red-700/50 transition-colors focus:outline-none focus:ring-1 focus:ring-red-400 flex-shrink-0">
                                    <LuX size={16} />
                                 </button>
                             </div>
                         )}
                         {!apiConfigured && !error && (
                             <div className="flex-shrink-0 p-3 bg-yellow-900/60 border-b border-yellow-700 text-yellow-200 flex items-start gap-2 text-sm shadow-inner">
                                 <LuTriangleAlert className="flex-shrink-0 text-yellow-400 mt-0.5" size={18}/> {/* Corrected Icon & Added margin-top */}
                                 <span className="flex-grow break-words">API Key not configured. AI features disabled. Set VITE_GEMINI_API_KEY or REACT_APP_GEMINI_API_KEY.</span>
                             </div>
                         )}
                        {/* Chat History */}
                        <div ref={chatHistoryRef} className="flex-grow p-3 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                             {chatHistory.map((msg, index) => (
                                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                     <div className={`p-3 rounded-lg max-w-[85%] ${msg.role === 'user' ? 'bg-blue-800 text-blue-50' : 'bg-gray-700 text-gray-100'} shadow-sm`}>
                                         <strong className="block text-xs font-semibold mb-1 opacity-80 capitalize">{msg.role === 'user' ? 'You' : 'AI Assistant'}</strong>
                                         <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                                     </div>
                                 </div>
                             ))}
                         </div>
                        {/* Chat Input Area */}
                        <div className="flex-shrink-0 p-3 border-t border-gray-700 bg-gray-800">
                            <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); handleChatSubmit(); }}>
                                <textarea
                                     className="flex-grow p-2 bg-gray-700 border border-gray-600 rounded-md text-sm text-gray-100 placeholder-gray-400 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-700"
                                     placeholder={apiConfigured ? "Ask for changes or help..." : "API not configured"}
                                     value={userChatInput} onChange={(e) => setUserChatInput(e.target.value)} rows={2}
                                     disabled={isLoading || !apiConfigured}
                                     onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !isLoading) { e.preventDefault(); handleChatSubmit(); } }}
                                 />
                                 <button type="submit" className="p-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white transition-colors h-[40px] shadow focus:outline-none focus:ring-2 focus:ring-blue-400 flex-shrink-0"
                                    disabled={isLoading || !userChatInput.trim() || !apiConfigured} title="Send Message (Enter)">
                                    <LuSend size={20}/>
                                 </button>
                            </form>
                        </div>
                         {/* Initial Prompt Area */}
                        <div className="flex-shrink-0 p-3 border-t border-gray-700 bg-gray-800">
                             <h3 className="text-sm font-semibold mb-2 text-gray-300">Initial Project Prompt</h3>
                             <textarea
                                 className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-sm text-gray-100 placeholder-gray-400 resize-y mb-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-700"
                                 value={initialPrompt} onChange={(e) => setInitialPrompt(e.target.value)} rows={3}
                                 disabled={isLoading} placeholder="e.g., A Pomodoro timer app with settings"
                             />
                             <button onClick={() => decomposePrompt(initialPrompt)}
                                 disabled={isLoading || !initialPrompt.trim() || !apiConfigured}
                                 className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-all shadow focus:outline-none focus:ring-2 focus:ring-purple-400">
                                 <LuWandSparkles />
                                 {Object.keys(files).length > 0 ? 'Regenerate Project' : 'Generate Project'}
                             </button>
                         </div>
                     </div>
                </Panel>

                <PanelResizeHandle className="w-2 bg-gray-900 border-l border-r border-gray-700 hover:bg-blue-900/50 active:bg-blue-700 cursor-col-resize outline-none transition-colors duration-150" />

                {/* Middle Panel: Prompt Editor */}
                <Panel defaultSize={35} minSize={20} maxSize={60} className="flex flex-col">
                    <div className="flex-grow flex flex-col bg-gray-850 border-r border-gray-700 h-full overflow-hidden">
                        <div className="flex-shrink-0 p-3 border-b border-gray-700 bg-gray-800 flex items-center gap-2">
                            <LuFilePenLine className="text-green-400" />
                            <h2 className="text-lg font-semibold">File Prompts</h2>
                        </div>
                         {/* Scrollable Prompt List */}
                         <div className="flex-grow p-4 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                             {Object.keys(editedPrompts).length === 0 && !isLoading && (
                                <p className="text-center text-gray-500 mt-8 italic">Project prompts appear here after generation.</p>
                            )}
                             {Object.keys(editedPrompts).length === 0 && isLoading && loadingMessage.includes("Analyzing") && (
                                <p className="text-center text-gray-400 mt-8">Analyzing requirements...</p>
                            )}
                            {/* Iterate over editedPrompts to ensure UI consistency */}
                            {Object.entries(editedPrompts).map(([filename, currentPrompt]) => {
                                const fileEntry = files[filename]; // Get corresponding data (code, original prompt)
                                if (!fileEntry) return null; // Should not happen if states are synced

                                const originalPrompt = fileEntry.prompt;
                                const code = fileEntry.code;
                                const hasChanged = currentPrompt !== originalPrompt;
                                const hasError = code?.startsWith("/* Error");
                                const isPending = code?.startsWith("// Pending") || code?.startsWith("// Regenerating");

                                return (
                                <div key={filename} className={`p-4 rounded-lg border ${hasError ? 'border-red-600/50 bg-red-900/10' : 'border-gray-700 bg-gray-700/20'} relative shadow-sm transition-colors duration-150`}>
                                     {/* Status Indicators */}
                                     {hasChanged && !isLoading && !isPending && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-yellow-400 rounded-full ring-1 ring-gray-800" title="Prompt edited, needs update"></div>}
                                     {isPending && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-blue-400 rounded-full animate-pulse ring-1 ring-gray-800" title="Generation pending..."></div>}
                                     {hasError && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full ring-1 ring-gray-800" title="Error in last generation"></div>}

                                     <h4 className="flex items-center gap-2 mb-3 text-sm font-mono font-medium text-blue-300">
                                         <LuCode size={16} /> {filename}
                                         <button onClick={() => handleCopyToClipboard(currentPrompt)} title="Copy Current Prompt" className="ml-auto p-1 text-gray-400 hover:text-gray-100 rounded hover:bg-gray-600/50 transition-colors">
                                            <LuClipboardCopy size={14}/>
                                         </button>
                                     </h4>
                                     <textarea
                                         className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-xs font-mono text-gray-200 placeholder-gray-500 resize-y focus:ring-1 focus:ring-blue-500 focus:border-transparent outline-none scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
                                         value={currentPrompt} onChange={(e) => handlePromptChange(filename, e.target.value)} rows={8}
                                         disabled={isLoading || !apiConfigured} spellCheck="false"
                                     />
                                     <button onClick={() => handleUpdateFile(filename)}
                                         disabled={isLoading || !apiConfigured || isPending || (!hasChanged && !hasError)}
                                         className="mt-3 px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:text-gray-400 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow focus:outline-none focus:ring-2 focus:ring-green-400"
                                         title={!hasChanged && !hasError ? "Prompt matches generated code" : (hasError ? `Regenerate (had error)` : `Regenerate Code`)}
                                     >
                                          <LuWandSparkles size={14}/> Update Code
                                     </button>
                                     {hasError && (
                                         <p className="mt-2 text-xs text-red-400">Error during last generation.</p>
                                     )}
                                 </div>
                                );
                            })}
                         </div>
                    </div>
                </Panel>

                <PanelResizeHandle className="w-2 bg-gray-900 border-l border-r border-gray-700 hover:bg-blue-900/50 active:bg-blue-700 cursor-col-resize outline-none transition-colors duration-150" />

                {/* Right Panel: Preview & Code */}
                <Panel defaultSize={40} minSize={20} className="flex flex-col">
                     <div className="flex-grow flex flex-col bg-gray-900 h-full overflow-hidden">
                        <div className="flex-shrink-0 p-2 pl-3 border-b border-gray-700 bg-gray-800 flex items-center justify-between">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                {previewMode === 'preview' ? <LuEye className="text-purple-400" /> : <LuCode className="text-purple-400" />}
                                {previewMode === 'preview' ? 'Live Preview' : 'Generated Code'}
                            </h2>
                             <div className="flex items-center gap-1">
                                 {/* Mode Toggle */}
                                 <button onClick={() => setPreviewMode('preview')} disabled={previewMode === 'preview' || !canRenderSandpack} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${previewMode === 'preview' ? 'bg-purple-600 text-white shadow-inner' : 'text-gray-400 hover:bg-gray-700 hover:text-gray-100 disabled:opacity-50 disabled:hover:bg-transparent disabled:text-gray-600'} focus:outline-none focus:ring-1 focus:ring-purple-400`} title="Show preview">
                                     <LuEye size={14} className="inline mr-1"/> Preview
                                 </button>
                                 <button onClick={() => setPreviewMode('code')} disabled={previewMode === 'code' || !canRenderSandpack} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${previewMode === 'code' ? 'bg-purple-600 text-white shadow-inner' : 'text-gray-400 hover:bg-gray-700 hover:text-gray-100 disabled:opacity-50 disabled:hover:bg-transparent disabled:text-gray-600'} focus:outline-none focus:ring-1 focus:ring-purple-400`} title="Show code">
                                      <LuCode size={14} className="inline mr-1"/> Code
                                 </button>
                                 {/* New Tab */}
                                  {previewMode === 'preview' && canRenderSandpack && (
                                      <button onClick={handleOpenInNewTab} title="Open preview in new tab" className="p-1.5 rounded text-gray-400 hover:bg-gray-700 hover:text-gray-100 disabled:opacity-50 ml-2 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400" disabled={!canRenderSandpack} >
                                          <LuExternalLink size={16}/>
                                      </button>
                                  )}
                             </div>
                         </div>
                        {/* Sandpack Container */}
                         <div className="flex-grow bg-gray-900 min-h-0">
                             {!canRenderSandpack && (
                                 <p className="text-center text-gray-500 mt-8 italic p-4">
                                     {Object.keys(files).length === 0 ? "Generate a project first." : "Waiting for essential files..."}
                                 </p>
                             )}
                             {canRenderSandpack && sandpackFiles && (
                                <SandpackProvider
                                    key={sandpackKey}
                                    files={sandpackFiles}
                                    template="react-ts"
                                    // REMOVED: theme prop removed
                                    // theme={sandpackDark}
                                    options={{
                                        showLineNumbers: true,
                                        showInlineErrors: true,
                                        showConsoleButton: true,
                                        showConsole: true,
                                        showNavigator: previewMode === 'preview',
                                        showTabs: previewMode === 'code',
                                        closableTabs: true,
                                        recompileMode: "delayed",
                                        recompileDelay: 600, // Slightly increased delay
                                        externalResources: ["https://cdn.tailwindcss.com"], // Ensure tailwind CDN is listed
                                        // bundlerURL: "https://sandpack-bundler-beta.codesandbox.io", // Optional: try beta bundler if needed
                                        logLevel: 'warn', // Default: 'info', can be 'debug' for more verbosity
                                    }}
                                 >
                                    <SandpackLayout className="!border-0 !rounded-none !bg-transparent h-full flex flex-col overflow-hidden">
                                         {previewMode === 'preview' ? (
                                            <SandpackPreview
                                                showOpenInCodeSandbox={false}
                                                showRefreshButton={true}
                                                className="!m-0 !p-0 !bg-white dark:!bg-gray-900 h-full w-full" // Added dark:!bg-gray-900
                                                style={{ height: '100%', width: '100%', flex: '1 1 auto', minHeight: '1080px' }}
                                             />
                                         ) : (
                                            <div className="flex h-full w-full overflow-hidden">
                                                <SandpackFileExplorer
                                                    className="!bg-gray-800 !border-r !border-gray-700 select-none"
                                                    style={{ height: '100%', minWidth: '180px', maxWidth: '35%', flexShrink: 0 }}
                                                    autoHiddenFiles={false}
                                                />
                                                 <SandpackCodeEditor
                                                     style={{ height: '100%', flexGrow: 1, minWidth: 0 }}
                                                     showLineNumbers={true}
                                                     showTabs={true}
                                                     wrapContent={true}
                                                 />
                                            </div>
                                         )}
                                    </SandpackLayout>
                                 </SandpackProvider>
                             )}
                         </div>
                     </div>
                </Panel>
            </PanelGroup>
        </div>
    );
}

export default App;