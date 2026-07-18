const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const router = express.Router();

let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

// POST /v1/ai/chat
router.post('/chat', async (req, res) => {
  try {
    const { prompt, history } = req.body;
    
    if (genAI) {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      let contextualPrompt = "You are an AI assistant in a workspace channel. Answer the prompt based on conversation context.\n\nContext History:\n";
      if (Array.isArray(history)) {
        history.forEach(h => {
          contextualPrompt += `${h.sender}: ${h.content}\n`;
        });
      }
      contextualPrompt += `\nPrompt: ${prompt}\nAI Response:`;

      const result = await model.generateContent(contextualPrompt);
      const response = await result.response;
      return res.status(200).json({ text: response.text() });
    } else {
      const cleanedPrompt = prompt.toLowerCase();
      let reply = "";
      if (cleanedPrompt.includes("hello") || cleanedPrompt.includes("hi")) {
        reply = "Hello! I am your Workspace AI Copilot. Since no `GEMINI_API_KEY` environment variable is configured, I am running in local offline simulation mode. How can I help you manage your tasks or chat channels today?";
      } else if (cleanedPrompt.includes("task") || cleanedPrompt.includes("todo")) {
        reply = "I can help you manage your tasks! You can use the `/task [Title]` command in the chat box to quickly create cards on your Kanban Board, or click on a card to log time sheets and view audit history.";
      } else if (cleanedPrompt.includes("help")) {
        reply = "Available topics of help:\n- **AI features**: Chat summaries, prompts.\n- **Slash Commands**: Type `/task`, `/timer`, `/invite`, `/pin` in chat.\n- **Stopwatch**: Manage time sheets on task detail drawers.\n- **Gantt Charts**: Track dates spanning horizontally.";
      } else {
        reply = `I processed your request: "${prompt}". To get real generative answers, configure a valid \`GEMINI_API_KEY\` in your server's .env file. In local mode, ask me about "task", "help", or say "hi"!`;
      }
      return res.status(200).json({ text: reply });
    }
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ error: 'Failed to process AI chat query' });
  }
});

// POST /v1/ai/summarize
router.post('/summarize', async (req, res) => {
  try {
    const { messages } = req.body;
    
    if (!messages || messages.length === 0) {
      return res.status(200).json({ text: "No conversation history exists in this channel to summarize." });
    }

    if (genAI) {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      let context = "Summarize the following chat conversation into key bullet points, highlighting decisions made, tasks discussed, and open questions:\n\n";
      messages.forEach(msg => {
        const name = msg.senderId?.name || msg.senderId?.username || 'User';
        context += `${name}: ${msg.content}\n`;
      });
      
      const result = await model.generateContent(context);
      const response = await result.response;
      return res.status(200).json({ text: response.text() });
    } else {
      const participants = new Set();
      let taskMemosCount = 0;
      let voiceMemosCount = 0;
      let textMemosCount = 0;

      messages.forEach(msg => {
        const name = msg.senderId?.name || msg.senderId?.username || 'User';
        participants.add(name);
        if (msg.type === 'task-card') taskMemosCount++;
        else if (msg.attachment?.type?.startsWith('audio')) voiceMemosCount++;
        else textMemosCount++;
      });

      const listUsers = Array.from(participants).join(', ');
      const summaryText = `### 📝 Offline Channel Summary\n` +
        `* **Participants active:** ${listUsers || 'None'}\n` +
        `* **Stats:** processed ${textMemosCount} text messages, ${voiceMemosCount} voice memos, and ${taskMemosCount} task cards.\n` +
        `* **Topics discussed:** Standard channel greetings, project deliverables updates, and task board schedules.\n\n` +
        `> [!NOTE]\n` +
        `> Configure the \`GEMINI_API_KEY\` variable in your backend environment to enable full LLM summarization.`;

      return res.status(200).json({ text: summaryText });
    }
  } catch (error) {
    console.error('AI Summarization Error:', error);
    res.status(500).json({ error: 'Failed to generate AI summary' });
  }
});

module.exports = router;
