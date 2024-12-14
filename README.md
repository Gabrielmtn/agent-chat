This is a simple local build to bounce requests between LLMs for refinement. You'll need to make your own .env file, setting the appropriate API key variables. Just clone, npm install, set up your .env with your OpenAI and Anthropic keys, and you're good to go.

You can submit, and get a standalone response from the groq model in the dropdown. (or check the checkbox and replace chatGPT)

First ChatGPT will do an initial draft
![image](https://github.com/user-attachments/assets/42a63926-3257-4b11-a101-a2097567ea02)

Then, Claude will take over for a review
![image](https://github.com/user-attachments/assets/9aa72b25-47e2-484f-a44d-cc2592c13461)
Then back to ChatGPT for a final draft.
![image](https://github.com/user-attachments/assets/6db8c180-b184-4aa5-93cd-76721b9d5309)
