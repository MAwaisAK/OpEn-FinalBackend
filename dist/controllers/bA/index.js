"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }var _openai = require('@langchain/openai');





var _messages = require('@langchain/core/messages');
var _zod = require('zod');
var _redisjs = require('../../clients/redis.js'); var _redisjs2 = _interopRequireDefault(_redisjs);
var _liftaijs = require('../../models/lift-ai.js'); var _liftaijs2 = _interopRequireDefault(_liftaijs);

// filesystem + doc generators
var _pdfkit = require('pdfkit'); var _pdfkit2 = _interopRequireDefault(_pdfkit);
var _docx = require('docx');
var _fs = require('fs'); var _fs2 = _interopRequireDefault(_fs);
var _path = require('path'); var _path2 = _interopRequireDefault(_path);

// — function schemas —
const evaluationFunction = {
  name: "evaluate_answer",
  description: "Scores a user reply on relevance, completeness & feasibility",
  parameters: {
    type: "object",
    properties: {
      relevance:    { type: "integer", minimum: 1, maximum: 5 },
      completeness: { type: "integer", minimum: 1, maximum: 5 },
      feasibility:  { type: "integer", minimum: 1, maximum: 5 },
      comments:     { type: "string" }
    },
    required: ["relevance","completeness","feasibility"]
  }
};

const generateDocumentFunction = {
  name: "generate_document",
  description: "Generate a downloadable business analysis document",
  parameters: {
    type: "object",
    properties: {
      content: { type: "string" },
      format:  { type: "string", enum: ["pdf","docx"] },
      userId:  { type: "string" }
    },
    required: ["content","format","userId"]
  }
};




function htmlify(text) {
  return text
    .replace(/(\*\*|__)(.*?)\1/g, '<b>$2</b>')
    .replace(/\n/g, '<br>');
}

const chatModel = new (0, _openai.ChatOpenAI)({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName:    "gpt-4",
  temperature:  0.2,
  maxTokens:    512,
  functions:    [evaluationFunction, generateDocumentFunction],
  functionCall: "auto",
});

function sanitizeContent(raw) {
  return raw
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
}


// — helper to write PDF or DOCX into public/downloads/{userId} —
async function handleDocumentGeneration({ content, format, userId }) {
  content = sanitizeContent(content);

  const downloadsDir = _path2.default.join(process.cwd(), "public", "downloads", userId);
  await _fs2.default.promises.mkdir(downloadsDir, { recursive: true });

  const filename = `business_analysis_${Date.now()}.${format}`;
  const filePath = _path2.default.join(downloadsDir, filename);

  if (format === "pdf") {
    const doc = new (0, _pdfkit2.default)();
    const stream = _fs2.default.createWriteStream(filePath);
    doc.pipe(stream);
    doc.fontSize(12).text(content, { align: "left" });
    doc.end();
    await new Promise(res => stream.on("finish", res));
  } else {
    const doc = new (0, _docx.Document)({
      sections: [{
        children: content
          .split("\n")
          .map(line => new (0, _docx.Paragraph)(line))
      }]
    });

    const buffer = await _docx.Packer.toBuffer(doc);
    _fs2.default.writeFileSync(filePath, buffer);
  }

  return `/downloads/${userId}/${filename}`;
}


 async function handleUserInput(userId, userInput) {
  const memKey = `ba:memory:${userId}`;
  // Fetch systemPrompt from MongoDB
  const liftAiDoc = await _liftaijs2.default.findOne({}); // no filter since there's only one
  const systemPrompt = _optionalChain([liftAiDoc, 'optionalAccess', _ => _.prompt, 'optionalAccess', _2 => _2.trim, 'call', _3 => _3()]);
  let memoryMsgs = [];
  const raw = await _redisjs2.default.get(memKey);
  if (raw) {
    memoryMsgs = JSON.parse(raw);
  } else {
    memoryMsgs = [{ role: "system", content: systemPrompt }];
  }

  // — ADMIN: clear BA memory if requested —
  if (userInput.trim() === "Redis del all data") {
    const keys = await _redisjs2.default.keys("ba:memory:*");
    if (keys.length) await _redisjs2.default.del(...keys);
    return "✅ Cleared all BA memory.";
  }

  memoryMsgs.push({ role: "user", content: userInput });

  // build LangChain messages
  const chatMessages = memoryMsgs.map(m => {
    if (m.role === "system")    return new (0, _messages.SystemMessage)(m.content);
    if (m.role === "user")      return new (0, _messages.HumanMessage)(m.content);
    if (m.role === "assistant") return new (0, _messages.AIMessage)(m.content);
    if (m.role === "function")  return new (0, _messages.FunctionMessage)({ name: m.name, content: m.content });
    throw new Error("Unknown role " + m.role);
  });



  const fnCallMatch = userInput.match(
    /^generate_document\s*\(\s*(\{[\s\S]*\})\s*\)\s*$/i
  );
  if (fnCallMatch) {
    const args = JSON.parse(fnCallMatch[1]);

    const downloadUrl = await handleDocumentGeneration(args);
    memoryMsgs.push({
      role:    "assistant",
      name:    generateDocumentFunction.name,
      content: JSON.stringify({ downloadUrl }),
    });
    await _redisjs2.default.set(memKey, JSON.stringify(memoryMsgs));
    return { downloadUrl };
  }

  // ➋ normal LangChain/GPT functionCall path
  const responseMessage = await chatModel.invoke(chatMessages);
  let finalReply = responseMessage.text;
  const fnCall = _optionalChain([responseMessage, 'access', _4 => _4.additional_kwargs, 'optionalAccess', _5 => _5.function_call]);

  if (fnCall && fnCall.name === generateDocumentFunction.name) {
    const args = JSON.parse(fnCall.arguments || "{}");

    const downloadUrl = await handleDocumentGeneration(args);
    memoryMsgs.push({
      role:    "assistant",
      name:    fnCall.name,
      content: JSON.stringify({ downloadUrl }),
    });
    await _redisjs2.default.set(memKey, JSON.stringify(memoryMsgs));
    return { downloadUrl };
  }

  // ➌ fallback regex for anything that mentions “pdf” or “docx”
// ➌ fallback: user mentions download but didn't invoke function directly
const mentionsDownload = /\b(download|generate).*(pdf|docx)?\b/i.test(userInput);
const wantsPdf  = /\bpdf\b/i.test(userInput);
const wantsDocx = /\bdocx\b/i.test(userInput);

if (mentionsDownload) {
  const format = wantsPdf ? "pdf" : wantsDocx ? "docx" : null;

  if (!format) {
    return "Would you like to download it as a **PDF** or **DOCX**? Please reply with either 'Download as PDF' or 'Download as DOCX'.";
  }

  // get the last assistant reply (not a function response)
  const lastAssist = _optionalChain([memoryMsgs
, 'access', _6 => _6.filter, 'call', _7 => _7(m => m.role === "assistant" && !m.name && m.content)
, 'access', _8 => _8.slice, 'call', _9 => _9(-1), 'access', _10 => _10[0], 'optionalAccess', _11 => _11.content]) || finalReply;

  const downloadUrl = await handleDocumentGeneration({
    content: lastAssist,
    format,
    userId
  });

  memoryMsgs.push({
    role:    "assistant",
    name:    generateDocumentFunction.name,
    content: JSON.stringify({ downloadUrl })
  });
  await _redisjs2.default.set(memKey, JSON.stringify(memoryMsgs));
  return { downloadUrl };
}


  // — normal assistant reply —
  const htmlReply = htmlify(finalReply);
  memoryMsgs.push({ role: "assistant", content: finalReply });
  await _redisjs2.default.set(memKey, JSON.stringify(memoryMsgs));
  return htmlReply;
} exports.handleUserInput = handleUserInput;