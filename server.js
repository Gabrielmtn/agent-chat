// server.js
const express = require('express');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const dotenv = require('dotenv');
const path = require('path');
const Groq  = require('groq-sdk');

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static('public'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });


async function getGroqChatCompletion(prompt) {
    return groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "modelDropdown",
    });
}
  

async function processStage1(prompt, useGroq, selectedModel) {
    if (useGroq) {
        return groq.chat.completions.create({
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: "You're going to receive instructions in a moment which will then be passed to another LLM for review and improvement." },
                { role: "assistant", content: "OK, I will ensure that I analyze the prompt to the best of my ability, and then send back a response to enable a thorough review and improvement from the next LLM to get my reply. I'll also be sure to clearly include instructions and context regarding the request, and the next steps." },
                { role: "user", content: "Great, here is the user's request, be sure to let the next LLM know that you'll be doing a final review of their reply. This is the request: \n" + prompt }
            ],
            model: selectedModel,
            temperature: 1,
            max_tokens: 1024
        });
    } else {
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: "You're going to receive instructions in a moment which will then be passed to another LLM for review and improvement." },
                { role: "assistant", content: "OK, I will ensure that I analyze the prompt to the best of my ability, and then send back a response to enable a thorough review and improvement from the next LLM to get my reply. I'll also be sure to clearly include instructions and context regarding the request, and the next steps." },
                { role: "user", content: "Great, here is the user's request, be sure to let the next LLM know that you'll be doing a final review of their reply. This is the request: \n" + prompt }
            ],
            max_tokens: 1024,
            n: 1,
            stop: null,
            temperature: 1
        });
        return response.choices[0].message.content;
    }
}

async function processStage2(stage1Response) {
    const reviewPrompt = `Review this response and suggest specific improvements:\n${stage1Response}`;
    const review = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
            { role: "user", content: "Hello, Claude you're going to be reviewing and improving some work from another LLM today, do your best to give the user the best possible version of their request by improving on the other LLM's work" },
            { role: "assistant", content: "Absolutely, this sounds like a great way to refine and improve a user's request!" },
            { role: "user", content: "Ok here's the message" + reviewPrompt }
        ]
    });
    return review.content[0].text;
}

async function processStage3(stage2Response, useGroq, selectedModel) {
    const finalPrompt = `Please improve your response based on this feedback:\n${stage2Response}`;
    
    if (useGroq) {
        return groq.chat.completions.create({
            messages: [
                { role: "system", content: "You are a subject matter expert, who will receive a 2nd draft of a user-request, and is in charge of returning a final polished version. You've been instructed to review the previous LLM's response, and give your final version, using any and all context in the provided message." },
                { role: "assistant", content: "OK, I will ensure that I analyze the prompt to the best of my ability, and then send back a response that an experienced consultant with years of experience might share, using the message from the previous LLM to formulate my reply. I'll also be sure to clearly explain that my response is the third and final review step completed by an LLM, in my final presentation of the work that my fellow LLMs and I have conducted" },
                { role: "user", content: "Great, here is the reply that the LLM gave, do your best to formulate this into a great final prompt for the user! " + finalPrompt }
            ],
            model: selectedModel,
            temperature: 1,
            max_tokens: 1024
        });
    } else {
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                { role: "system", content: "You are a subject matter expert, who will receive a 2nd draft of a user-request, and is in charge of returning a final polished version. You've been instructed to review the previous LLM's response, and give your final version, using any and all context in the provided message." },
                { role: "assistant", content: "OK, I will ensure that I analyze the prompt to the best of my ability, and then send back a response that an experienced consultant with years of experience might share, using the message from the previous LLM to formulate my reply. I'll also be sure to clearly explain that my response is the third and final review step completed by an LLM, in my final presentation of the work that my fellow LLMs and I have conducted" },
                { role: "user", content: "Great, here is the reply that the LLM gave, do your best to formulate this into a great final prompt for the user! " + finalPrompt }
            ],
            max_tokens: 1024,
            n: 1,
            stop: null,
            temperature: 1
        });
        return response.choices[0].message.content;
    }
}

app.post('/review/stage1', async (req, res) => {
    try {
        const { prompt, useGroq, selectedModel } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }
        const response = await processStage1(prompt, useGroq, selectedModel);
        const content = useGroq ? response.choices[0].message.content : response;
        res.json({ content, model: useGroq ? selectedModel : "GPT-4", status: "Initial Analysis" });
    } catch (error) {
        res.status(500).json({ error: 'Error in stage 1', details: error.message });
    }
});

app.post('/review/stage2', async (req, res) => {
    try {
        const { stage1Response } = req.body;
        if (!stage1Response) {
            return res.status(400).json({ error: 'Stage 1 response is required' });
        }
        const response = await processStage2(stage1Response);
        res.json({ content: response, model: "Claude", status: "Review & Improvements" });
    } catch (error) {
        res.status(500).json({ error: 'Error in stage 2', details: error.message });
    }
});

app.post('/review/stage3', async (req, res) => {
    try {
        const { stage2Response, useGroq, selectedModel } = req.body;
        if (!stage2Response) {
            return res.status(400).json({ error: 'Stage 2 response is required' });
        }
        const response = await processStage3(stage2Response, useGroq, selectedModel);
        const content = useGroq ? response.choices[0].message.content : response;
        res.json({ content, model: useGroq ? selectedModel : "GPT-4", status: "Final Refinement" });
    } catch (error) {
        res.status(500).json({ error: 'Error in stage 3', details: error.message });
    }
}); 

// Add this new endpoint after your existing endpoints
app.post('/review/groq', async (req, res) => {
    try {
        const { prompt, model } = req.body;
        if (!prompt || !model) {
            return res.status(400).json({ error: 'Prompt and model are required' });
        }

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "user",
                    content: prompt,
                }
            ],
            model: model,
            temperature: 0.7,
            max_tokens: 1024,
        });

        res.json({
            content: completion.choices[0].message.content,
            model: model,
            status: "Groq's Response"
        });
    } catch (error) {
        res.status(500).json({ error: 'Error in Groq API call', details: error.message });
    }
});


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));