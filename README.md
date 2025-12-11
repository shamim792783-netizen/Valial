# Gemini 2.5 Telegram Bot

This project runs a Telegram Bot powered by Google's Gemini 2.5 Flash model. It supports:
1.  **Chat**: Natural conversation with context.
2.  **Vision**: Send photos to analyze them.
3.  **Creation**: Generate images using `/image <prompt>`.

## Setup

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Environment Variables**
    You need to set your Google GenAI API Key. The Telegram Token is pre-configured in the script for convenience, but you should ideally set it in the environment too.

    ```bash
    export API_KEY="your_google_api_key_here"
    # Optional: export TELEGRAM_TOKEN="your_token_here"
    ```

3.  **Run the Bot**
    ```bash
    npm start
    ```

4.  **Usage**
    Open your bot in Telegram and click **Start**.
