// src/App.tsx
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
// REMOVED: react-resizable-panels imports
// import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
    SandpackProvider,
    SandpackLayout,
    SandpackPreview,
    SandpackCodeEditor,
    SandpackFileExplorer,
    SandpackFiles,
} from "@codesandbox/sandpack-react";

// Icons
import { LuPanelLeft, LuCode, LuEye, LuExternalLink, LuLoader, LuSend, LuWandSparkles, LuTriangleAlert, LuFilePenLine, LuX, LuClipboardCopy } from "react-icons/lu";

// --- Types ---

interface FileEntry {
    code: string;
    prompt: string;
}

interface FilesState {
    [key: string]: FileEntry;
}

interface ChatMessage {
    role: 'user' | 'assistant'; // Changed 'model' to 'assistant' for OpenAI compatibility
    text: string;
}

// --- LLM Configuration ---

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "YOUR_API_KEY_HERE";

if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
    console.error("Error: Gemini API Key not found or placeholder used. Please set VITE_GEMINI_API_KEY in your environment.");
}

// REMOVED: OpenAI client initialization
// const openai = ... ;

// Use the model name specified in the curl command
const GEMINI_MODEL_NAME = "gemini-2.0-flash"; // Or "gemini-pro", check compatible models for this endpoint

// --- Static Sandpack Files ---
// (STATIC_INDEX_HTML, STATIC_PACKAGE_JSON, STATIC_INDEX_TSX, STATIC_TSCONFIG_JSON remain unchanged)
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
      /* Ensure preview body takes full height */
      #root { display: flex; flex-direction: column; min-height: 100%; }
    </style>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <!-- The script below will be handled by Sandpack -->
  </body>
</html>`;

const STATIC_PACKAGE_JSON = JSON.stringify({
    "dependencies": { "react": "^18.2.0", "react-dom": "^18.2.0", "tailwindcss": "^3.4.0" }, // Added tailwind explicitly
    "devDependencies": { "react-scripts": "5.0.1", "@types/react": "^18.2.45", "@types/react-dom": "^18.2.18", "typescript": "^5.0.0" }, // Removed tailwind from dev, add if postcss needed
    "main": "/index.tsx", "scripts": { "start": "react-scripts start", "build": "react-scripts build" }, "browserslist": [">0.2%", "not dead", "not op_mini all"]
}, null, 2);

const STATIC_INDEX_TSX = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css'; // Import Tailwind base styles

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');
const root = ReactDOM.createRoot(rootElement);
root.render(<React.StrictMode><App /></React.StrictMode>);`;

// NEW: Add styles.css for Tailwind directives
const STATIC_STYLES_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  /* You can add base body styles here if needed */
}`;


const STATIC_TSCONFIG_JSON = JSON.stringify({
    "compilerOptions": { "target": "es6", "lib": ["dom", "dom.iterable", "esnext"], "allowJs": true, "skipLibCheck": true, "esModuleInterop": true, "allowSyntheticDefaultImports": true, "strict": true, "forceConsistentCasingInFileNames": true, "noFallthroughCasesInSwitch": true, "module": "esnext", "moduleResolution": "node", "resolveJsonModule": true, "isolatedModules": true, "noEmit": true, "jsx": "react-jsx" },
    "include": ["src", "**/*.ts", "**/*.tsx"], "exclude": ["node_modules"]
}, null, 2);

// --- Helper Function for Standalone Preview ---
// (generateStandaloneHtml remains largely unchanged, but ensure it includes styles.css if needed or relies on CDN)
const generateStandaloneHtml = (files: SandpackFiles): string => {
    // Basic implementation assuming CDN handles most cases
    // For a more robust solution, consider bundling or inline styles/scripts
    let indexHtmlCode = files['/index.html']?.code || STATIC_INDEX_HTML;
    const appCode = files['/App.tsx']?.code || 'export default function App() { return "App not found"; }';
    const indexCode = files['/index.tsx']?.code || STATIC_INDEX_TSX;
    const stylesCode = files['/styles.css']?.code || STATIC_STYLES_CSS;

    // Extremely simplified injection - real bundling is complex
    const scriptsToInject = `
<style>${stylesCode.replace(/`/g, '\\`')}</style>
<script type="module">
  // Basic error overlay (same as before)
  window.onerror = function(message, source, lineno, colno, error) { /* ... */ };

  try {
    // Very naive simulation
    window.React = await import('https://esm.sh/react@18');
    window.ReactDOM = await import('https://esm.sh/react-dom@18/client');

    const process = { env: { NODE_ENV: 'development' } }; // Basic polyfill

    // Naive module execution (highly likely to break complex apps)
    const AppModule = { exports: {} };
    try {
      // Replace imports (very fragile)
      let modifiedAppCode = \`${appCode.replace(/`/g, '\\`')}\`;
      modifiedAppCode = modifiedAppCode.replace(/import React from ['"]react['"];?/g, '');
      // Add more import replacements if needed...
      modifiedAppCode = modifiedAppCode.replace(/export default\\s+/,'AppModule.exports.default = ');
      eval(modifiedAppCode);
    } catch(e) { console.error('Error executing App.tsx:', e); throw e; }
    const App = AppModule.exports.default;

    try {
      let modifiedIndexCode = \`${indexCode.replace(/`/g, '\\`')}\`;
      modifiedIndexCode = modifiedIndexCode.replace(/import React from ['"]react['"];?/g, '');
      modifiedIndexCode = modifiedIndexCode.replace(/import ReactDOM from ['"]react-dom\\/client['"];?/g, '');
      modifiedIndexCode = modifiedIndexCode.replace(/import App from ['"].\\/App['"];?/g, '');
      modifiedIndexCode = modifiedIndexCode.replace(/import ['"].\\/styles.css['"];?/g, ''); // Remove CSS import
      eval(modifiedIndexCode);
    } catch(e) { console.error('Error executing index.tsx:', e); throw e; }

  } catch (e) {
     console.error("Standalone Preview Setup Error:", e);
     window.onerror(e.message || 'Setup Error', 'Inline Script', 0, 0, e);
  }
</script>
`;
    // Inject before closing body
    const finalHtml = indexHtmlCode.replace('</body>', `${scriptsToInject}</body>`);
    return finalHtml;
};

// --- Robust JSON Parsing Helper ---
// (extractAndParseJson remains unchanged)
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
    const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview'); // Renamed state for clarity
    const [editedPrompts, setEditedPrompts] = useState<Record<string, string>>({});
    const [apiConfigured, setApiConfigured] = useState<boolean>(false);
    const [sandpackKey, setSandpackKey] = useState<number>(Date.now());

    const chatHistoryRef = useRef<HTMLDivElement>(null);
    const standalonePreviewUrl = useRef<string | null>(null);

    // --- Effects ---
    useEffect(() => {
        const configured = !!(apiKey && apiKey !== "YOUR_API_KEY_HERE"); // Check openai instance
        setApiConfigured(configured);
        if (!configured && !error) {
            setError("Gemini API Key missing/invalid or client failed to initialize. AI features disabled.");
        }
    }, [error]); // Removed apiKey dependency as it's checked via `openai` instance

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

     useEffect(() => {
        // apiConfigured now just checks the key directly
        const configured = !!(apiKey && apiKey !== "YOUR_API_KEY_HERE");
        setApiConfigured(configured);
        if (!configured && !error) {
            setError("Gemini API Key missing/invalid. AI features disabled.");
        }
    }, [error, apiKey]); // Added apiKey dependency

    // --- API Call Function (UPDATED for Proxy) ---
    const callGeminiAPI = useCallback(async (prompt: string, history: ChatMessage[] = []): Promise<string> => {
        // Check if API key is configured (no client instance to check now)
        if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
            setError("API Key not configured. Cannot make API calls.");
            throw new Error("API Key not configured.");
        }
        setError(null);
        console.log("Sending prompt via fetch to proxy (length):", prompt.length);
    
        // Construct the messages array in the format required by the OpenAI-compatible endpoint
        const messages = [
            // Optional: Add a system prompt if desired/supported by the endpoint
            // { role: "system", content: "You are a helpful AI assistant specializing in React, TypeScript, and Tailwind development." },
            // Map history (ensure roles match 'user' or 'assistant'/'model')
            ...history.map(msg => ({
                role: msg.role === 'assistant' ? 'assistant' : 'user', // Map internal roles
                content: msg.text,
            })),
            // Add the current user prompt
            { role: "user", content: prompt },
        ];
    
        // Define the target URL using the proxy path
        // This matches the '/gemini-api' key in vite.config.ts proxy settings
        const endpointPath = "/v1beta/models"; // Using Google's standard path structure now
        const fullProxyUrl = `/gemini-api${endpointPath}/${GEMINI_MODEL_NAME}:generateContent?key=${apiKey}`; // Use standard Google endpoint via proxy
    
        console.log(`Attempting fetch POST to: ${fullProxyUrl.replace(/key=([^&]*)/, 'key=REDACTED')}`); // Log URL safely
    
        try {
            const response = await fetch(fullProxyUrl, {
                method: 'POST',
                headers: {
                    // Use standard Content-Type for Google API
                    'Content-Type': 'application/json',
                    // REMOVED: Authorization header (using API key in query parameter now)
                    // 'Authorization': `Bearer ${apiKey}`,
                },
                // Construct body matching Google's generateContent structure
                body: JSON.stringify({
                    contents: messages.map(msg => ({
                         // Map roles back to Google's 'user' and 'model'
                        role: msg.role === 'user' ? 'user' : 'model',
                        parts: [{ text: msg.content as string }]
                     })),
                     generationConfig: { // Add relevant generation config
                        temperature: 0.6,
                        topP: 0.95,
                        topK: 64,
                        maxOutputTokens: 8192,
                     },
                     // safetySettings: [...] // Add if needed
                }),
            });
    
            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json(); // Try to parse error details from Google
                } catch (e) {
                    errorData = { error: { message: await response.text() || response.statusText } };
                }
                console.error("API Error Response (via fetch proxy):", errorData);
                // Throw a specific error message from the API response if available
                throw new Error(`API Error (${response.status}): ${errorData?.error?.message || response.statusText}`);
            }
    
            const data = await response.json();
            console.log("Gemini API Response (via fetch proxy):", data);
    
            // --- Extract content based on Google's generateContent response structure ---
            const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
            // --- Response Validation (using Google's structure) ---
            if (!responseText && data?.candidates?.[0]?.finishReason && data.candidates[0].finishReason !== 'STOP') {
                const reason = data.candidates[0].finishReason;
                const safety = data.candidates[0].safetyRatings;
                console.warn(`API Warning: Empty response text. Finish Reason: ${reason}`, safety ? `Ratings: ${JSON.stringify(safety)}` : '');
                if (reason === 'SAFETY') {
                     throw new Error(`API request blocked due to safety settings. Reason: ${reason}`);
                 }
                if (!responseText) {
                    throw new Error(`API Error: No text content received. Finish Reason: ${reason}`);
                }
            } else if (!responseText && !data?.candidates) {
                const blockReason = data?.promptFeedback?.blockReason;
                 if (blockReason) {
                     throw new Error(`API Error: Request blocked. Reason: ${blockReason}`);
                 }
                console.error("API Error: Unexpected response structure or empty candidates.", data);
                throw new Error("API Error: Received an unexpected or empty response from the AI.");
            }
    
            return responseText;
    
        } catch (e: any) {
            console.error("Error calling Gemini API via fetch proxy:", e);
            let errorMessage = `Failed to communicate with the AI via fetch proxy. ${e.message || ''}`;
            if (e instanceof TypeError && e.message === 'Failed to fetch') {
                 errorMessage += " (Network error or proxy configuration issue)";
            }
            setError(errorMessage);
            throw e; // Re-throw for calling functions (like decomposePrompt) to catch
        }
    }, [apiKey]); // Dependency is now apiKey directly


    // --- Core Logic Functions ---

    // decomposePrompt: UNCHANGED (logic relies on prompt structure, not specific SDK calls)
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

1.  **Analyze & Plan:** Decompose the request into logical React components and necessary config files (e.g., /App.tsx, /index.tsx, /styles.css, /components/..., /index.html, /package.json, /tsconfig.json). Use standard conventions. Entry point MUST be /index.tsx rendering /App.tsx. Include a basic /styles.css for Tailwind directives (@tailwind base; etc.).
2.  **Generate Prompts:** For EACH file: create a detailed prompt string describing EXACTLY what content that file should contain. For TSX files, specify purpose, props (TS interface), state, logic, Tailwind styling (directly in JSX), imports, exports. For HTML/JSON/CSS, specify the exact structure/content needed.
3.  **Output Format:** Respond ONLY with a valid JSON object. Keys are full file paths (e.g., "/components/Button.tsx"). Values are the detailed prompts (strings). Ensure valid JSON escaping within prompt strings. No extra text outside the JSON object.
Make sure the instructions for each prop or state or variable exists in the larger context so there will be no "not a function" errors.
**Example JSON Structure (ensure valid JSON escaping):**
{
  "/index.html": "Create standard HTML5 boilerplate: UTF-8, viewport, title 'AI React Preview'. Add Tailwind CDN script (<script src=\\"https://cdn.tailwindcss.com\\"></script>) and config script (tailwind.config = {darkMode:'class'}). Add <div id=\\"root\\"></div>. Style html/body/root height 100%. Add 'dark' class to <html>.",
  "/package.json": "Create package.json: dependencies { react, react-dom: ^18.2.0, tailwindcss: ^3.4.0 }. devDependencies { react-scripts, @types/react, @types/react-dom, typescript }. main: /index.tsx. scripts { start, build }.",
  "/tsconfig.json": "Create standard tsconfig.json for React+TS: target es6, jsx react-jsx, module esnext, moduleResolution node, strict true, include src/**, exclude node_modules.",
  "/styles.css": "Create styles.css with Tailwind directives: @tailwind base; @tailwind components; @tailwind utilities;",
  "/index.tsx": "{\\"purpose\\":\\"React entry point\\",\\"logic\\":\\"Import React, ReactDOM, App from './App', and './styles.css'. Render <App /> in StrictMode into 'root' element.\\",\\"imports\\": [\\"react\\", \\"react-dom/client\\", \\"./App\\", \\"./styles.css\\"],\\"exports\\":\\"None\\"}",
  "/App.tsx": "{\\"purpose\\":\\"Main app layout\\",\\"state\\":\\"None\\",\\"logic\\":\\"Render UserProfile component.\\",\\"styling\\":\\"Use Tailwind: main container flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4.\\",\\"imports\\": [\\"./components/UserProfile\\"],\\"exports\\":\\"Default\\"}",
  "/components/UserProfile.tsx": "{\\"purpose\\":\\"User info card\\",\\"props\\":\\"interface UserProfileProps { avatarUrl: string; name: string; bio: string; }\\",\\"logic\\":\\"Render img, h2 (name), p (bio) using props.\\",\\"styling\\":\\"Use Tailwind: Card 'bg-gray-800 rounded-lg shadow-md p-6 w-full max-w-sm'. Avatar 'w-24 h-24 rounded-full mx-auto mb-4 object-cover'. Name 'text-xl font-semibold text-white text-center'. Bio 'text-gray-400 text-center text-sm mt-2'.\\",\\"imports\\": [\\"react\\"],\\"exports\\":\\"Default\\"}"
}

Return ONLY the raw, valid JSON object.
        `;

        try {
            // Pass empty history for initial decomposition
            const response = await callGeminiAPI(metaPrompt, []);
            // Map 'assistant' role here if needed, but initial message is preset
            setChatHistory(prev => [...prev, { role: 'assistant', text: `Okay, planned the structure. Preparing files...` }]);
            const parsedPrompts = extractAndParseJson(response);

            if (!parsedPrompts) {
                 const errorMsg = "AI response for decomposition was not valid JSON. Cannot proceed. Check console.";
                 console.error(errorMsg, "Raw Response:", response);
                 setError(errorMsg);
                 setChatHistory(prev => [...prev, { role: 'assistant', text: `Error: ${errorMsg}` }]);
                 setIsLoading(false);
                 return;
            }

            const initialFilesState: FilesState = {};
            const initialEditedPrompts: Record<string, string> = {};
            // Added /styles.css to required files
            const requiredFiles = ["/index.html", "/package.json", "/tsconfig.json", "/styles.css", "/index.tsx", "/App.tsx"];
            requiredFiles.forEach(reqFile => {
                if (!parsedPrompts[reqFile]) {
                    console.warn(`LLM did not provide a prompt for required file: ${reqFile}. Adding placeholder.`);
                    // Add more specific placeholder prompts if needed
                    parsedPrompts[reqFile] = `Generate standard content for ${reqFile}. ${reqFile === '/styles.css' ? 'Include Tailwind directives.' : ''}`;
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
             setChatHistory(prev => [...prev, { role: 'assistant', text: `Error during decomposition: ${error instanceof Error ? error.message : 'Unknown'}` }]);
        } finally {
            setIsLoading(false);
            setLoadingMessage("");
        }
    }, [apiConfigured, callGeminiAPI]);


    // generateCodeForFile: UPDATED to pass empty history
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
             // Pass empty history for single file generation
            const code = await callGeminiAPI(codeGenPrompt, []);
            // Basic cleaning: remove potential markdown fences and trim whitespace
            return code.replace(/^```(?:tsx|typescript|javascript|jsx|html|css|json)?\s*|```$/g, '').trim();
        } catch (e) {
             console.error(`Failed to generate code for ${filename}:`, e);
             // Error state is handled by the caller (generateAllFiles/handleUpdateFile) via setError
             // Return code indicating error for display purposes
             return `/* Error generating code for ${filename}. \nPrompt:\n${prompt}\n---\nError: ${e instanceof Error ? e.message : 'Unknown error'}\n*/`;
        }
    }, [callGeminiAPI]); // Only depends on callGeminiAPI


    // generateAllFiles: UNCHANGED (logic relies on prompts/state, not specific SDK calls)
     const generateAllFiles = useCallback(async (currentFilesState: FilesState) => {
         if (!apiConfigured) return setError("API not configured. Cannot generate files.");
         setIsLoading(true);
         setLoadingMessage("Generating code for files...");
         setChatHistory(prev => [...prev, { role: 'assistant', text: "Generating code for all files..." }]);
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
                     // Error message may be set by callGeminiAPI -> generateCodeForFile
                     setError(prevError => prevError || `Error generating ${filename}. Check prompt/code.`); // Set top-level error if not already set
                 }
             } catch (error) { // Catch errors from callGeminiAPI itself if generateCodeForFile re-throws
                 console.error(`API call failed for ${filename}:`, error);
                 if (!firstErrorFile) firstErrorFile = filename;
                 allSucceeded = false;
                 const errorMessage = `/* API Call Error during generation for ${filename}. Check console. */`;
                 newFilesState[filename] = { ...newFilesState[filename], code: errorMessage };
                 setFiles(prev => ({ ...prev, [filename]: newFilesState[filename] }));
                 setError(prevError => prevError || `API Error generating ${filename}. ${error instanceof Error ? error.message : ''}`); // Set top-level error if not already set
                 // Optionally break the loop: break;
             }
         }

         const finalMessage = allSucceeded
             ? "Code generation complete!"
             : `Generation finished. ${firstErrorFile ? `Error occurred generating: ${firstErrorFile}. Check file prompt/code and console.` : 'Errors occurred.'}`;

         setLoadingMessage("");
         setIsLoading(false);
         setChatHistory(prev => [...prev, { role: 'assistant', text: finalMessage }]);
         setSandpackKey(prev => prev + 1); // Force Sandpack refresh

     }, [generateCodeForFile, apiConfigured]);

     // handleUpdateFile: UNCHANGED (logic relies on prompts/state, not specific SDK calls)
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
             setChatHistory(prev => [...prev, { role: 'assistant', text: `Code for ${filename} updated.` }]);
             setSandpackKey(prev => prev + 1); // Force Sandpack refresh
              if (generatedCode.startsWith('/* Error')) {
                  setError(`Error generating ${filename}. Check prompt/code.`); // Set top-level error
              }
         } catch (error) {
             setChatHistory(prev => [...prev, { role: 'assistant', text: `Error updating ${filename}. ${error instanceof Error ? error.message : ''}` }]);
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
     }, [generateCodeForFile, editedPrompts, files, apiConfigured]);

     // handlePromptChange: UNCHANGED
    const handlePromptChange = (filename: string, newPrompt: string) => {
        setEditedPrompts(prev => ({ ...prev, [filename]: newPrompt }));
    };

    // handleChatSubmit: UPDATED to pass history correctly to callGeminiAPI
     const handleChatSubmit = useCallback(async () => {
         if (!userChatInput.trim() || !apiConfigured) return;
         const currentInput = userChatInput;
         setUserChatInput("");
         setIsLoading(true);
         setLoadingMessage("AI Assistant is thinking...");
         const currentUserMsg: ChatMessage = { role: 'user', text: currentInput };
         setChatHistory(prev => [...prev, currentUserMsg]);
         setError(null);

         // Pass the history *before* the current user message to the API call context prompt construction
         const historyForContext = [...chatHistory];
         // Pass the history *including* the current user message to the API call itself
         const historyForApi = [...chatHistory, currentUserMsg];


         const contextPrompt = `
You are an AI assistant embedded in a web dev environment helping a user build a React/Tailwind app.
Original project goal: "${initialPrompt}"
Current files and their LATEST prompts:
${Object.entries(editedPrompts).map(([name, prompt]) => `- ${name}: ${prompt.substring(0, 150)}...`).join("\n")}

Conversation History (recent):
${historyForContext.slice(-6).map(msg => `${msg.role}: ${msg.text}`).join("\n")}

Task: Respond to the LATEST user message ("${currentInput}").
- Focus on guiding the user to modify the PROMPTS in the "File Prompts" panel to achieve their goal. Explain *why* the prompt change is needed (relate to Tailwind classes, logic, props etc.).
- **Do NOT generate raw code blocks.** Example guidance: "To make the button red, change the 'styling' in the prompt for /components/Button.tsx to include 'bg-red-600 hover:bg-red-700'".
- Answer general questions concisely. Ask for clarification if needed.

Assistant's helpful response:
         `;

         try {
              // Pass historyForContext to construct the prompt, but pass historyForApi (without the last message) to the actual API call
             const response = await callGeminiAPI(contextPrompt, historyForContext);
             setChatHistory(prev => [...prev, { role: 'assistant', text: response }]);
         } catch (error) {
              setChatHistory(prev => [...prev, { role: 'assistant', text: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}` }]);
              // Error state likely set by callGeminiAPI
         } finally {
             setIsLoading(false);
             setLoadingMessage("");
         }
     }, [userChatInput, chatHistory, initialPrompt, editedPrompts, apiConfigured, callGeminiAPI]); // files removed as dependency, context uses editedPrompts

    // handleOpenInNewTab: UNCHANGED
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

    // handleCopyToClipboard: UNCHANGED
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

    // --- Sandpack File Preparation (UPDATED to include styles.css) ---
    const sandpackFiles = useMemo((): SandpackFiles | null => {
        // Added /styles.css to required keys
        const requiredKeys = ["/index.html", "/package.json", "/index.tsx", "/App.tsx", "/styles.css"];
        const hasRequiredFiles = requiredKeys.every(key => files[key]?.code && !files[key].code.startsWith("// Pending"));

        if (Object.keys(files).length === 0) return {}; // Initial state
        if (!hasRequiredFiles) {
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
        outputFiles['/styles.css'] = { code: files['/styles.css']?.code || STATIC_STYLES_CSS }; // Add styles.css
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

    // --- Render (UPDATED Layout without Panels, using Tabs) ---

    const canRenderSandpack = sandpackFiles && Object.keys(sandpackFiles).length > 4; // Increased count due to styles.css

    return (
        // Use Flexbox for the main 3-column layout
        <div className="flex h-screen w-screen overflow-hidden bg-gray-900 text-gray-100">

            {/* Left Panel: Chat & Config (Fixed Width) */}
            <div className="w-[25%] flex-shrink-0 flex flex-col border-r border-gray-700">
                <div className="relative flex-grow flex flex-col bg-gray-800 h-full overflow-hidden">
                    {/* Loading Overlay (Unchanged) */}
                    {isLoading && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
                            <LuLoader className="animate-spin text-4xl text-blue-400 mb-3" />
                            <p className="text-lg font-medium text-gray-200">{loadingMessage || "Processing..."}</p>
                        </div>
                    )}
                    {/* Panel Header (Unchanged) */}
                    <div className="flex-shrink-0 p-3 border-b border-gray-700 bg-gray-800 flex items-center gap-2">
                        <LuPanelLeft className="text-blue-400" />
                        <h2 className="text-lg font-semibold">Chat & Config</h2>
                    </div>
                    {/* Error Display (Unchanged) */}
                    {error && (
                         <div className="flex-shrink-0 p-3 bg-red-900/60 border-b border-red-700 text-red-200 flex items-start gap-2 text-sm shadow-inner">
                             <LuTriangleAlert className="flex-shrink-0 text-red-400 mt-0.5" size={18}/>
                             <span className="flex-grow break-words">{error}</span>
                             <button onClick={() => setError(null)} title="Dismiss Error" className="ml-2 p-1 rounded hover:bg-red-700/50 transition-colors focus:outline-none focus:ring-1 focus:ring-red-400 flex-shrink-0">
                                 <LuX size={16} />
                             </button>
                         </div>
                     )}
                    {/* API Config Warning (Unchanged) */}
                    {!apiConfigured && !error && (
                        <div className="flex-shrink-0 p-3 bg-yellow-900/60 border-b border-yellow-700 text-yellow-200 flex items-start gap-2 text-sm shadow-inner">
                            <LuTriangleAlert className="flex-shrink-0 text-yellow-400 mt-0.5" size={18}/>
                            <span className="flex-grow break-words">API Key not configured. AI features disabled. Set VITE_GEMINI_API_KEY or REACT_APP_GEMINI_API_KEY.</span>
                        </div>
                    )}
                    {/* Chat History (Ensure overflow works) */}
                    <div ref={chatHistoryRef} className="flex-grow p-3 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 min-h-0">
                        {chatHistory.map((msg, index) => (
                            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`p-3 rounded-lg max-w-[85%] ${msg.role === 'user' ? 'bg-blue-800 text-blue-50' : 'bg-gray-700 text-gray-100'} shadow-sm`}>
                                    <strong className="block text-xs font-semibold mb-1 opacity-80 capitalize">{msg.role === 'user' ? 'You' : 'AI Assistant'}</strong>
                                    {/* Changed 'model' display name */}
                                    <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Chat Input Area (Unchanged) */}
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
                    {/* Initial Prompt Area (Unchanged) */}
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
            </div>

            {/* REMOVED: PanelResizeHandle */}

            {/* Middle Panel: Prompt Editor (Fixed Width) */}
            <div className="w-[35%] flex-shrink-0 flex flex-col border-r border-gray-700">
                <div className="flex-grow flex flex-col bg-gray-850 h-full overflow-hidden">
                    {/* Panel Header (Unchanged) */}
                    <div className="flex-shrink-0 p-3 border-b border-gray-700 bg-gray-800 flex items-center gap-2">
                        <LuFilePenLine className="text-green-400" />
                        <h2 className="text-lg font-semibold">File Prompts</h2>
                    </div>
                    {/* Scrollable Prompt List (Ensure overflow works) */}
                    <div className="flex-grow p-4 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 min-h-0">
                        {Object.keys(editedPrompts).length === 0 && !isLoading && (
                            <p className="text-center text-gray-500 mt-8 italic">Project prompts appear here after generation.</p>
                        )}
                        {Object.keys(editedPrompts).length === 0 && isLoading && loadingMessage.includes("Analyzing") && (
                            <p className="text-center text-gray-400 mt-8">Analyzing requirements...</p>
                        )}
                        {/* Iterate over editedPrompts (Unchanged Logic) */}
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
                                     {/* Status Indicators (Unchanged) */}
                                     {hasChanged && !isLoading && !isPending && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-yellow-400 rounded-full ring-1 ring-gray-800" title="Prompt edited, needs update"></div>}
                                     {isPending && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-blue-400 rounded-full animate-pulse ring-1 ring-gray-800" title="Generation pending..."></div>}
                                     {hasError && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full ring-1 ring-gray-800" title="Error in last generation"></div>}

                                     {/* Prompt Header & Copy (Unchanged) */}
                                     <h4 className="flex items-center gap-2 mb-3 text-sm font-mono font-medium text-blue-300">
                                         <LuCode size={16} /> {filename}
                                         <button onClick={() => handleCopyToClipboard(currentPrompt)} title="Copy Current Prompt" className="ml-auto p-1 text-gray-400 hover:text-gray-100 rounded hover:bg-gray-600/50 transition-colors">
                                            <LuClipboardCopy size={14}/>
                                         </button>
                                     </h4>
                                     {/* Prompt Textarea (Unchanged) */}
                                     <textarea
                                         className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-xs font-mono text-gray-200 placeholder-gray-500 resize-y focus:ring-1 focus:ring-blue-500 focus:border-transparent outline-none scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
                                         value={currentPrompt} onChange={(e) => handlePromptChange(filename, e.target.value)} rows={8}
                                         disabled={isLoading || !apiConfigured} spellCheck="false"
                                     />
                                     {/* Update Button (Unchanged) */}
                                     <button onClick={() => handleUpdateFile(filename)}
                                         disabled={isLoading || !apiConfigured || isPending || (!hasChanged && !hasError)}
                                         className="mt-3 px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:text-gray-400 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow focus:outline-none focus:ring-2 focus:ring-green-400"
                                         title={!hasChanged && !hasError ? "Prompt matches generated code" : (hasError ? `Regenerate (had error)` : `Regenerate Code`)}
                                     >
                                          <LuWandSparkles size={14}/> Update Code
                                     </button>
                                     {/* Error message (Unchanged) */}
                                     {hasError && (
                                         <p className="mt-2 text-xs text-red-400">Error during last generation.</p>
                                     )}
                                 </div>
                                );
                            })}
                    </div>
                </div>
            </div>

            {/* REMOVED: PanelResizeHandle */}

            {/* Right Panel: Preview & Code (Flex Grow) */}
            <div className="flex-grow flex flex-col min-w-0"> {/* Use flex-grow and min-w-0 */}
                <div className="flex-grow flex flex-col bg-gray-900 h-full overflow-hidden">
                    {/* Tab Header */}
                    <div className="flex-shrink-0 p-2 pl-3 border-b border-gray-700 bg-gray-800 flex items-center justify-between">
                         <div className="flex items-center gap-1">
                             {/* Tab Button: Preview */}
                             <button
                                 onClick={() => setActiveTab('preview')}
                                 disabled={!canRenderSandpack}
                                 className={`px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'preview' ? 'bg-purple-600 text-white shadow-inner' : 'text-gray-400 hover:bg-gray-700 hover:text-gray-100 disabled:opacity-50 disabled:hover:bg-transparent disabled:text-gray-600'} focus:outline-none focus:ring-1 focus:ring-purple-400`}
                                 title="Show preview"
                             >
                                 <LuEye size={16}/> Preview
                             </button>
                             {/* Tab Button: Code */}
                             <button
                                 onClick={() => setActiveTab('code')}
                                 disabled={!canRenderSandpack}
                                 className={`px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'code' ? 'bg-purple-600 text-white shadow-inner' : 'text-gray-400 hover:bg-gray-700 hover:text-gray-100 disabled:opacity-50 disabled:hover:bg-transparent disabled:text-gray-600'} focus:outline-none focus:ring-1 focus:ring-purple-400`}
                                 title="Show code"
                             >
                                  <LuCode size={16}/> Code
                             </button>
                         </div>
                         {/* New Tab Button (only shows in preview mode) */}
                         {activeTab === 'preview' && canRenderSandpack && (
                              <button onClick={handleOpenInNewTab} title="Open preview in new tab" className="p-1.5 rounded text-gray-400 hover:bg-gray-700 hover:text-gray-100 disabled:opacity-50 ml-2 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400" disabled={!canRenderSandpack} >
                                  <LuExternalLink size={16}/>
                              </button>
                          )}
                    </div>

                    {/* Tab Content Area */}
                    <div className="flex-grow bg-gray-900 min-h-0 relative"> {/* Added relative positioning */}
                        {!canRenderSandpack && (
                            <p className="text-center text-gray-500 mt-8 italic p-4">
                                {Object.keys(files).length === 0 ? "Generate a project first." : "Waiting for essential files..."}
                            </p>
                        )}
                        {canRenderSandpack && sandpackFiles && (
                            // SandpackProvider wraps the content area
                            <SandpackProvider
                                key={sandpackKey} // Key to force remount on major changes
                                files={sandpackFiles}
                                template="react-ts"
                                options={{
                                    showLineNumbers: true,
                                    showInlineErrors: true,
                                    showConsoleButton: true,
                                    showConsole: true,
                                    // showNavigator: activeTab === 'preview', // Controlled manually below
                                    // showTabs: activeTab === 'code', // Controlled manually below
                                    closableTabs: true,
                                    recompileMode: "delayed",
                                    recompileDelay: 600,
                                    externalResources: ["https://cdn.tailwindcss.com"],
                                    logLevel: 'warn',
                                    // Ensure bundler is appropriate if issues arise
                                    // bundlerURL: "https://sandpack-bundler-beta.codesandbox.io",
                                }}
                            >
                                {/* SandpackLayout might not be needed or needs adjustment for tabs */}
                                {/* Let's render components directly based on activeTab */}
                                <div className="absolute inset-0 flex flex-col"> {/* Use absolute positioning to fill parent */}
                                    {/* Preview Tab Content */}
                                    {activeTab === 'preview' && (
                                        <SandpackPreview
                                            showOpenInCodeSandbox={false}
                                            showRefreshButton={true}
                                            className="!m-0 !p-0 !bg-white dark:!bg-gray-900 h-full w-full" // Use h-full, remove minHeight
                                            style={{ height: '100%', width: '100%' }} // Ensure full size
                                        />
                                    )}
                                    {/* Code Tab Content */}
                                    {activeTab === 'code' && (
                                        <div className="flex h-full w-full overflow-hidden"> {/* Flex container for explorer + editor */}
                                            <SandpackFileExplorer
                                                className="!bg-gray-800 !border-r !border-gray-700 select-none flex-shrink-0" // Ensure it doesn't grow
                                                style={{ height: '100%', width: '200px' }} // Fixed width for explorer
                                                autoHiddenFiles={false}
                                            />
                                            {/* Editor takes remaining space and scrolls internally */}
                                            <SandpackCodeEditor
                                                 className="flex-grow h-full min-w-0" // flex-grow to fill space, min-w-0 prevents overflow
                                                 style={{ height: '100%' }} // Ensure full height
                                                 showLineNumbers={true}
                                                 showTabs={true} // Show file tabs within the editor pane
                                                 wrapContent={true}
                                             />
                                        </div>
                                    )}
                                </div>
                            </SandpackProvider>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;