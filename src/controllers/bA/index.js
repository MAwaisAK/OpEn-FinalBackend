import { ChatOpenAI } from "@langchain/openai";
import Report from "../../models/support";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  FunctionMessage,
} from "@langchain/core/messages";
import redis from "../../clients/redis.js";
import LiftAi from "../../models/lift-ai.js";

// filesystem + doc generators
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph } from "docx";
import fs from "fs";
import path from "path";

// — function schemas —
const evaluationFunction = {
  name: "evaluate_answer",
  description: "Scores a user reply on relevance, completeness & feasibility",
  parameters: {
    type: "object",
    properties: {
      relevance: { type: "integer", minimum: 1, maximum: 5 },
      completeness: { type: "integer", minimum: 1, maximum: 5 },
      feasibility: { type: "integer", minimum: 1, maximum: 5 },
      comments: { type: "string" }
    },
    required: ["relevance", "completeness", "feasibility"]
  }
};

const generateDocumentFunction = {
  name: "generate_document",
  description: "Generate downloadable business analysis documents in both PDF and DOCX formats",
  parameters: {
    type: "object",
    properties: {
      content: { type: "string" },
      userId: { type: "string" }
    },
    required: ["content", "userId"]
  }
};

function htmlify(text) {
  return text
    .replace(/(\*\*|__)(.*?)\1/g, '<b>$2</b>')
    .replace(/\n/g, '<br>');
}

const chatModel = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4",
  temperature: 0.2,
  maxTokens: 512,
  functions: [evaluationFunction, generateDocumentFunction],
  functionCall: "auto",
});

function sanitizeContent(raw) {
  return raw
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<br>/gi, '\n')
    .replace(/&nbsp;/gi, ' ');
}

// Enhanced content extraction
function extractTemplateContent(fullContent) {
  // Step 1: Remove download prompts
  let cleanContent = fullContent
    .replace(/\n\s*Would you like to download this as a (PDF|DOCX)\??\s*$/gi, '')
    .replace(/\n\s*[-=~*_]{3,}\s*$/gi, '');

  // Step 2: Extract content between first and last "---"
  const dashPattern = /-{3,}/g;
  let dashMatches = [];
  let match;
  let lastMatchLength = 0;
  
  while ((match = dashPattern.exec(cleanContent)) !== null) {
    dashMatches.push(match.index);
    lastMatchLength = match[0].length; // Store the length of the last match
  }
  
  // If we have at least two "---" separators
  if (dashMatches.length >= 2) {
    const startIndex = dashMatches[0] + lastMatchLength;
    const endIndex = dashMatches[dashMatches.length - 1];
    cleanContent = cleanContent.substring(startIndex, endIndex).trim();
  }
  
  // Step 3: Remove any remaining prefixes
  const prefixPatterns = [
    /^.*?populat(?:ed|ing).*?template:?\s*/i,
    /^.*?here(?:'s| is) (?:the|your) (?:updated )?.*?:?\s*/i,
    /^.*?add(?:ing)? more details.*?:?\s*/i,
    /^.*?I (?:have|ve) (?:prepared|created|filled).*?:?\s*/i,
    /^.*?based on.*?:?\s*/i,
    /^.*?your (?:filled|completed) .*?:?\s*/i,
    /^.*?I understand.*?:?\s*/i,
    /^.*?Sure,.*?:?\s*/i
  ];
  
  for (const pattern of prefixPatterns) {
    cleanContent = cleanContent.replace(pattern, '');
  }
  
  // Step 4: Final cleanup
  return cleanContent
    .replace(/^[\s-:~*_]+/, '')  // Remove leading special chars
    .replace(/[\s-:~*_]+$/, '')  // Remove trailing special chars
    .trim();
}

// Updated to generate specific format
async function handleDocumentGeneration({ content, userId, format = 'pdf' }) {
  // Extract clean template content
  const cleanContent = extractTemplateContent(content);
  
  const downloadsDir = path.join(process.cwd(), "public", "downloads", userId);
  await fs.promises.mkdir(downloadsDir, { recursive: true });

  const timestamp = Date.now();
  const files = {};

  if (format === 'pdf') {
    // Generate PDF
    const pdfFilename = `business_analysis_${timestamp}.pdf`;
    const pdfPath = path.join(downloadsDir, pdfFilename);
    const pdfDoc = new PDFDocument();
    const pdfStream = fs.createWriteStream(pdfPath);
    pdfDoc.pipe(pdfStream);
    pdfDoc.fontSize(12).text(cleanContent, { align: "left" });
    pdfDoc.end();
    await new Promise(resolve => pdfStream.on("finish", resolve));
    files.pdfUrl = `/downloads/${userId}/${pdfFilename}`;
  }

  if (format === 'docx') {
    // Generate DOCX
    const docxFilename = `business_analysis_${timestamp}.docx`;
    const docxPath = path.join(downloadsDir, docxFilename);
    const docx = new Document({
      sections: [{
        children: cleanContent
          .split("\n")
          .filter(line => line.trim().length > 0)
          .map(line => new Paragraph(line))
      }]
    });

    const buffer = await Packer.toBuffer(docx);
    fs.writeFileSync(docxPath, buffer);
    files.docxUrl = `/downloads/${userId}/${docxFilename}`;
  }

  return files;
}

export async function handleUserInput(userId, userInput) {
  const memKey = `ba:memory:${userId}`;
  const liftAiDoc = await LiftAi.findOne({});
  const systemPrompt = liftAiDoc?.prompt?.trim();

  // Initialize memory with default structure
  let memory = {
    messages: [{ role: "system", content: systemPrompt }],
    state: {
      awaitingDownloadFormat: false,
      confirmedSummary: false,
      templateRendered: false
    }
  };

  // Try to load existing memory
  const raw = await redis.get(memKey);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      // Ensure backwards compatibility
      if (Array.isArray(parsed)) {
        memory.messages = parsed;
      } else {
        memory = {
          messages: parsed.messages || [],
          state: {
            awaitingDownloadFormat: parsed.state?.awaitingDownloadFormat || false,
            confirmedSummary: parsed.state?.confirmedSummary || false,
            templateRendered: parsed.state?.templateRendered || false
          }
        };
      }
    } catch (e) {
      console.error("Error parsing Redis memory:", e);
    }
  }

  // — ADMIN: clear BA memory if requested —
  if (userInput.trim() === "Redis del all data") {
    const keys = await redis.keys("ba:memory:*");
    if (keys.length) await redis.del(...keys);
    return "✅ Cleared all BA memory.";
  }

  // Handle download format selection
  if (memory.state.awaitingDownloadFormat) {
    const wantsPdf = /pdf/i.test(userInput);
    const wantsDocx = /docx/i.test(userInput);
    const format = wantsDocx ? 'docx' : (wantsPdf ? 'pdf' : null);

    if (!format) {
      return "Please specify either <b>PDF</b> or <b>DOCX</b> for the document format.";
    }

    // Get the last template content
    const lastTemplate = memory.messages
      .slice()
      .reverse()
      .find(m => 
        m.role === "assistant" && 
        m.content && 
        memory.state.templateRendered
      )?.content;

    if (!lastTemplate) {
      memory.state.awaitingDownloadFormat = false;
      await redis.setex(memKey,3600, JSON.stringify(memory));
      return "Could not find template content to download. Please restart your process.";
    }

    const files = await handleDocumentGeneration({
      content: lastTemplate,
      userId,
      format
    });

    const downloadUrl = format === 'pdf' ? files.pdfUrl : files.docxUrl;
    const formatName = format.toUpperCase();
    
    const downloadMsg = `✅ Your ${formatName} document is ready! Download: 
      <a href="${downloadUrl}" target="_blank"><b>${formatName}</b></a>`;

    memory.messages.push({ role: "user", content: userInput });
    memory.messages.push({ role: "assistant", content: downloadMsg });
    memory.state.awaitingDownloadFormat = false;
    memory.state.templateRendered = false;
    await redis.setex(memKey,3600, JSON.stringify(memory));

    return downloadMsg;
  }

  memory.messages.push({ role: "user", content: userInput });

  // Build LangChain messages
  const chatMessages = memory.messages.map(m => {
    if (m.role === "system") return new SystemMessage(m.content);
    if (m.role === "user") return new HumanMessage(m.content);
    if (m.role === "assistant") return new AIMessage(m.content);
    if (m.role === "function") return new FunctionMessage({ name: m.name, content: m.content });
    throw new Error("Unknown role " + m.role);
  });

  try {
    // Check if user requested document download
    const wantsDownload = /(download|pdf|docx)/i.test(userInput);
    const isConfirmation = /(yes|correct|right|confirm)/i.test(userInput);
    const wantsPdf = /pdf/i.test(userInput);
    const wantsDocx = /docx/i.test(userInput);
    const format = wantsDocx ? 'docx' : (wantsPdf ? 'pdf' : null);

    // Handle after-confirmation document generation
    if (isConfirmation && !memory.state.confirmedSummary) {
      memory.state.confirmedSummary = true;

      // Find the last assistant message with recommendations
      const lastSummary = memory.messages
        .slice()
        .reverse()
        .find(m => 
          m.role === "assistant" && 
          m.content && 
          /recommendations?|suggestions?/i.test(m.content)
        )?.content;

      if (lastSummary) {
        const files = await handleDocumentGeneration({
          content: lastSummary,
          userId,
          format: format || 'pdf' // Default to PDF if format not specified
        });

        const downloadUrl = format === 'docx' ? files.docxUrl : files.pdfUrl;
        const formatName = format ? format.toUpperCase() : 'PDF';
        
        const downloadMsg = `✅ Your ${formatName} document is ready! Download: 
          <a href="${downloadUrl}" target="_blank"><b>${formatName}</b></a>`;

        memory.messages.push({ role: "assistant", content: downloadMsg });
        await redis.setex(memKey, 3600,JSON.stringify(memory));
        return downloadMsg;
      }
    }

    // Handle explicit document requests
    if (wantsDownload) {
      // Get the last assistant message that's not a function call
      const lastOutput = memory.messages
        .filter(m => m.role === "assistant" && !m.name && m.content)
        .slice(-1)[0]?.content;

      if (lastOutput) {
        const files = await handleDocumentGeneration({
          content: lastOutput,
          userId,
          format: format || 'pdf' // Default to PDF if format not specified
        });

        const downloadUrl = format === 'docx' ? files.docxUrl : files.pdfUrl;
        const formatName = format ? format.toUpperCase() : 'PDF';
        
        const downloadMsg = `✅ Your ${formatName} document is ready! Download: 
          <a href="${downloadUrl}" target="_blank"><b>${formatName}</b></a>`;

        memory.messages.push({
          role: "assistant",
          name: generateDocumentFunction.name,
          content: JSON.stringify(files)
        });

        await redis.setex(memKey,3600, JSON.stringify(memory));
        return downloadMsg;
      }
      return "Please complete the analysis before requesting a download.";
    }

    // Process with GPT
    const responseMessage = await chatModel.invoke(chatMessages);
    let finalReply = responseMessage.text;
    const fnCall = responseMessage.additional_kwargs?.function_call;

    // Handle function calls for document generation
    if (fnCall && fnCall.name === generateDocumentFunction.name) {
      const args = JSON.parse(fnCall.arguments || "{}");
      
      // Extract clean content
      const cleanContent = extractTemplateContent(args.content);
      
      const files = await handleDocumentGeneration({
        content: cleanContent,
        userId: args.userId || userId,
        format: null // Generate both formats
      });

      const downloadMsg = `✅ Document generated! Download as: 
        <a href="${files.pdfUrl}" target="_blank"><b>PDF</b></a> or 
        <a href="${files.docxUrl}" target="_blank"><b>DOCX</b></a>`;

      memory.messages.push({
        role: "assistant",
        name: fnCall.name,
        content: JSON.stringify(files)
      });

      await redis.setex(memKey,3600, JSON.stringify(memory));
      return downloadMsg;
    }

    // Check if we should prompt for download after template is rendered
    const isTemplateRendered = /(here is your|populated template|completed document)/i.test(finalReply);
    const isFinalSummary = /(is this correct\?|summary|recommendations)/i.test(finalReply);
    
    if (isTemplateRendered) {
      // Mark that we've rendered a template
      memory.state.templateRendered = true;
      
      // Add download prompt
      finalReply += "<br><br>Would you like to download this as a <b>PDF</b> or <b>DOCX</b>?";
      memory.state.awaitingDownloadFormat = true;
    } 
    else if (isFinalSummary) {
      // Add download prompt for consulting branch
      finalReply += "<br><br>Would you like to download this as a <b>PDF</b> or <b>DOCX</b>?";
      memory.state.awaitingDownloadFormat = true;
      memory.state.confirmedSummary = false;
    }

    // Handle normal assistant reply
    const htmlReply = htmlify(finalReply);
    memory.messages.push({ role: "assistant", content: finalReply });
    await redis.setex(memKey,3600, JSON.stringify(memory));
    return htmlReply;
  } catch (err) {
    const isQuotaError = err?.message?.includes("InsufficientQuotaError");
    if (isQuotaError) {
      // Check for a recent "Lift-Ai" ticket in the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recent = await Report.findOne({
        type: "Lift-Ai",
        createdAt: { $gte: oneHourAgo }
      });

      if (recent) {
        return `🚫 GPT credits exhausted—our team is aware and working on it.`;
      }

      // Otherwise, generate a fresh ticket
      let tickno;
      let digits = 6;
      let uniqueFound = false;
      while (!uniqueFound) {
        const min = 10 ** (digits - 1);
        const max = 10 ** digits - 1;
        const rangeCount = await Report.countDocuments({ tickno: { $gte: min, $lte: max } });
        if (rangeCount >= (max - min + 1)) {
          digits++;
          continue;
        }
        tickno = Math.floor(Math.random() * (max - min + 1)) + min;
        if (!await Report.exists({ tickno })) uniqueFound = true;
      }

      const report = new Report({
        tickno,
        type: "Lift-Ai",
        user: userId,
        Description: `GPT quota exceeded: ${err.message}`,
        status: "pending"
      });
      await report.save();

      return `🚫 Currently, Lift-Ai is under maintenance and will be live soon.`;
    }

    // Re-throw non-quota errors
    throw err;
  }
}