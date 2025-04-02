# Tesslate Builder Lite

[![React](https://img.shields.io/badge/React-18.2.0-blue?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-Fast-yellowgreen?logo=vite)](https://vitejs.dev/)
[![Sandpack](https://img.shields.io/badge/Sandpack-Live%20Sandbox-orange)](https://sandpack.codesandbox.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4%20(CDN)-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

A web application that allows you to generate React components using an AI chat interface and view/edit them live in a Sandpack sandbox environment. Describe the component you need, and the AI will attempt to generate the code, which is then rendered instantly for preview.

## ✨ Features

*   **Live Sandbox Environment:** Uses `@codesandbox/sandpack-react` to provide an instant preview and code editor for the generated component.
*   **Real-time Preview:** See the generated component rendered immediately in the 'Preview' tab.
*   **Integrated Code Editor:** View and modify the generated `Component.tsx` code directly in the 'Editor' tab.
*   **Tailwind CSS Support:** The sandbox preview environment includes Tailwind CSS v4 via CDN, allowing generated components to use Tailwind utility classes.
*   **Error Handling:** Displays API or code generation errors to the user.
*   **Dependencies Included:** The sandbox automatically includes `react`, `react-dom`, `framer-motion`, and `@heroicons/react` for richer component possibilities.
*   **Optional Proxy:** Built-in logic to route API requests through a local proxy (`/llm-proxy`) if the target API is not on localhost (requires separate proxy setup).

## 🚀 Getting Started

### Prerequisites

*   Node.js (v18 or later recommended)
*   npm, yarn, or pnpm
*   Access to an OpenAI-compatible LLM API endpoint (like LM Studio, Ollama with LiteLLM, or a cloud provider).

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd <repository-directory>
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    # or
    pnpm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the root of the project and add the necessary configuration. See the [Configuration](#configuration) section below for details.
    ```dotenv
    # .env
    VITE_API_BASE_URL=http://localhost:1234/v1
    VITE_API_KEY=lm-studio # Or your actual API key if required
    VITE_MODEL_NAME=Your-Model-Name # e.g., Nous-Hermes-2-Mistral-7B-DPO-GGUF/nous-hermes-2-mistral-7b-dpo.Q4_K_M.gguf
    # Optional parameters (defaults shown):
    # VITE_TEMPERATURE=0.7
    # VITE_MAX_TOKENS=4096
    # VITE_TOP_P=0.95
    # VITE_TOP_K=40
    # VITE_FREQUENCY_PENALTY=1.1
    # VITE_PRESENCE_PENALTY=0.0
    ```

4.  **Run the development server:**
    This project uses Vite.
    ```bash
    npm run dev
    # or
    yarn dev
    # or
    pnpm dev
    ```

5.  Open your browser and navigate to the URL provided by Vite (usually `http://localhost:5173`).

## ⚙️ Configuration

Configuration is managed through environment variables, typically defined in a `.env` file at the project root.

| Variable                 | Description                                                                                                   | Default                    | Required |
| :----------------------- | :------------------------------------------------------------------------------------------------------------ | :------------------------- | :------- |
| `VITE_API_BASE_URL`      | The base URL of your OpenAI-compatible LLM API endpoint (e.g., LM Studio server, Ollama with LiteLLM).          | `http://localhost:1234/v1` | Yes      |
| `VITE_API_KEY`           | Your API key for the LLM service. Use `lm-studio` or leave blank if no key is needed (e.g., local LM Studio).    | `lm-studio`                | No       |
| `VITE_MODEL_NAME`        | The identifier/name of the LLM model to use for generation.                                                   | `tessa-t1-14b`             | Yes      |
| `VITE_TEMPERATURE`       | Controls randomness. Lower values (e.g., 0.2) make output more deterministic; higher values (e.g., 0.8) more random. | `0.7`                      | No       |
| `VITE_MAX_TOKENS`        | The maximum number of tokens to generate in the response.                                                     | `4096`                     | No       |
| `VITE_TOP_P`             | Nucleus sampling parameter. Considers only tokens with probability mass adding up to top_p.                   | `0.95`                     | No       |
| `VITE_TOP_K`             | Considers only the top_k most likely tokens at each step.                                                     | `40`                       | No       |
| `VITE_FREQUENCY_PENALTY` | Penalizes new tokens based on their existing frequency in the text so far. Decreases repetition.              | `1.1`                      | No       |
| `VITE_PRESENCE_PENALTY`  | Penalizes new tokens based on whether they appear in the text so far. Increases likelihood of new topics.     | `0.0`                      | No       |

**Note:** Since this is a Vite project, environment variables accessible to the client-side code *must* be prefixed with `VITE_`.

## 🛠️ How It Works

1.  **User Input:** The user types a description of a React component into the chat input field.
2.  **API Request:** The application takes the current chat history and the new user prompt, formats it according to the OpenAI chat completions API structure, and sends it to the configured `VITE_API_BASE_URL` endpoint (`/chat/completions`).
3.  **LLM Processing:** The LLM receives the request, processes the prompt in the context of the conversation, and generates React component code (ideally TSX/JSX using Tailwind classes).
4.  **Response Parsing:** The application receives the response from the LLM. It attempts to extract the relevant code block, removing potential markdown fences (```), introductory sentences, and special markers (like `<|im_start|>answer`, `<|im_end|>`). It also tries to automatically add `export default` if it seems missing.
5.  **Sandpack Update:** The extracted code is used to update the `Component.tsx` file within the Sandpack instance.
6.  **Live Render:** Sandpack detects the file change, recompiles the code (using its internal bundler), and renders the updated `Component.tsx` within the `App.tsx` wrapper in the 'Preview' iframe.
7.  **UI Update:** The chat interface displays the user's message and the AI's response (the generated code). The 'Editor' tab shows the updated `Component.tsx` code.

## 🕹️ Usage

1.  Ensure the application is running (`npm run dev`).
2.  Open the application in your browser.
3.  In the chat input field (bottom right), type a description of the React component you want. Be specific about functionality and appearance. Examples:
    *   "Create a simple button that increments a counter when clicked."
    *   "Generate a card component with an image, title, and description using Tailwind."
    *   "Make a loading spinner using framer-motion."
    *   "A modal dialog with a title, content area, and a close button using heroicons."
4.  Press Enter or click the "Send" button.
5.  Wait for the AI to process the request (a loading indicator will show).
6.  **View Result:**
    *   The generated component will appear in the 'Preview' tab on the left.
    *   The generated code will be displayed in the chat history and also populate the 'Editor' tab (`Component.tsx`).
7.  **Iterate:** You can ask for modifications in the chat (e.g., "Make the button blue") or edit the code directly in the 'Editor' tab. Sandpack will update the preview automatically on code changes.
8.  **Refresh:** If the Sandpack preview seems stuck, use the refresh button (🔄) in the top-right of the Editor/Preview pane header to force a full refresh of the sandbox.

## 🔌 Proxy Setup (Optional)

If your `VITE_API_BASE_URL` points to an external domain (not `localhost` or `127.0.0.1`), the application attempts to use a proxy endpoint `/llm-proxy/v1/chat/completions` to avoid CORS issues.

**Important:** This front-end code *does not* include the proxy server itself. If you need the proxy functionality, you must set one up separately. You can configure Vite's development server to proxy requests by modifying your `vite.config.ts` (or `.js`) file:

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy /llm-proxy requests to your actual API base URL
      '/llm-proxy': {
        target: process.env.VITE_API_BASE_URL, // Read from .env
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/llm-proxy/, ''), // Remove /llm-proxy prefix
        secure: false, // Set to true if target is HTTPS with valid cert
      },
    },
  },
})
```

Make sure `VITE_API_BASE_URL` is correctly set in your `.env` file for the proxy target.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/your-feature-name`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'Add some feature'`).
5.  Push to the branch (`git push origin feature/your-feature-name`).
6.  Open a pull request.