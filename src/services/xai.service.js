const axios = require('axios');
const logger = require('../config/logger');

const XAI_API_KEY = process.env.XAI_API_KEY;
const XAI_BASE_URL = 'https://api.x.ai/v1';

// Preferred models verified against xAI active endpoints
const FAST_MODEL = 'grok-4.20-0309-non-reasoning';
const REASONING_MODEL = 'grok-4.20-0309-reasoning';

/**
 * Send chat completion to xAI Grok API
 */
async function chatCompletion({
  messages,
  model = FAST_MODEL,
  temperature = 0.2,
  responseFormat = null,
  maxTokens = 12000
}) {
  try {
    const payload = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    };

    if (responseFormat && responseFormat.type === 'json_object') {
      payload.response_format = { type: 'json_object' };
    }

    const response = await axios.post(`${XAI_BASE_URL}/chat/completions`, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${XAI_API_KEY}`
      },
      timeout: 60000
    });

    const choice = response.data?.choices?.[0];
    const content = choice?.message?.content || '';
    return {
      content,
      usage: response.data?.usage,
      model: response.data?.model
    };
  } catch (err) {
    const errorData = err.response?.data || err.message;
    logger.error('xAI Grok API Error:', errorData);
    throw new Error(`xAI Error: ${typeof errorData === 'object' ? JSON.stringify(errorData) : errorData}`);
  }
}

/**
 * Universal Statement Parser via Grok Vision / Text
 * Extracts tabular date, voucher, description, debit, credit, balance
 */
async function parseStatementDocument({ rawText, imageBase64, partyType, partyName }) {
  const systemPrompt = `You are an expert Chartered Accountant and Financial Data Parser specialized in Indian ERP, Tally, Busy, and Bank Statements.
Your task is to extract all transaction rows from the provided financial statement into strict JSON format.

Return a valid JSON object matching this schema:
{
  "partyName": "Extracted Party or Company Name",
  "statementPeriod": { "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" },
  "openingBalance": 0.0,
  "openingBalanceType": "DR" or "CR",
  "closingBalance": 0.0,
  "closingBalanceType": "DR" or "CR",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "voucherNo": "Invoice/Challan/Receipt/Cheque/UTR number if available",
      "type": "INVOICE" | "PAYMENT" | "RETURN" | "CREDIT_NOTE" | "DEBIT_NOTE" | "DISCOUNT" | "BANK_CHARGES" | "OTHER",
      "narration": "Brief description / narration",
      "debit": 0.0,
      "credit": 0.0,
      "balance": 0.0,
      "ref": "Extracted Bill/Challan/UTR reference"
    }
  ]
}

CRITICAL RULES:
1. Always parse amounts as pure numbers (e.g., 25000.50, not "Rs. 25,000.50").
2. Standardize dates to YYYY-MM-DD format.
3. If an entry is a credit/receipt, debit should be 0 and credit should be the amount.
4. Output strictly valid JSON. Do not wrap with markdown code blocks.`;

  let textToParse = rawText ? String(rawText).trim() : '';
  let validImageForVision = null;

  if (imageBase64 && typeof imageBase64 === 'string') {
    const isPdf = imageBase64.startsWith('data:application/pdf') ||
                  imageBase64.includes('application/pdf') ||
                  imageBase64.substring(0, 50).includes('JVBERi0');

    const isExcel = imageBase64.includes('spreadsheet') ||
                    imageBase64.includes('excel') ||
                    imageBase64.substring(0, 50).includes('UEsDB');

    if (isPdf) {
      try {
        const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
        const pdfBuffer = Buffer.from(cleanBase64, 'base64');
        const pdfModule = require('pdf-parse');
        let pdfText = '';
        if (typeof pdfModule === 'function') {
          const pdfData = await pdfModule(pdfBuffer);
          pdfText = pdfData?.text || '';
        } else if (pdfModule && pdfModule.PDFParse) {
          const parser = new pdfModule.PDFParse({ data: pdfBuffer });
          const res = await parser.getText();
          pdfText = res?.text || '';
          await parser.destroy();
        }
        if (pdfText && pdfText.trim().length > 10) {
          textToParse = (textToParse ? textToParse + '\n\n' : '') + pdfText;
        } else {
          logger.warn('Uploaded PDF contained no extractable text stream.');
        }
      } catch (pdfErr) {
        logger.error('Error extracting text from PDF with pdf-parse:', pdfErr);
      }
    } else if (isExcel) {
      try {
        const ExcelJS = require('exceljs');
        const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
        const excelBuffer = Buffer.from(cleanBase64, 'base64');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(excelBuffer);
        let extractedExcelText = '';
        workbook.eachSheet((worksheet) => {
          worksheet.eachRow((row) => {
            const vals = Array.isArray(row.values) ? row.values.slice(1) : [];
            extractedExcelText += vals.map(v => (v !== null && v !== undefined ? (typeof v === 'object' && v.text ? v.text : String(v)) : '')).join(' | ') + '\n';
          });
        });
        if (extractedExcelText.trim().length > 10) {
          textToParse = (textToParse ? textToParse + '\n\n' : '') + extractedExcelText;
        }
      } catch (excelErr) {
        logger.error('Error extracting text from Excel with exceljs:', excelErr);
      }
    } else if (imageBase64.startsWith('data:image/')) {
      validImageForVision = imageBase64;
    }
  }

  const messages = [{ role: 'system', content: systemPrompt }];
  let selectedModel = FAST_MODEL;

  if (validImageForVision && (!textToParse || textToParse.length < 30)) {
    selectedModel = FAST_MODEL;
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: `Please parse this ledger statement image for ${partyType || 'party'}: ${partyName || 'Unknown'}. Extract all transactions accurately.` },
        { type: 'image_url', image_url: { url: validImageForVision } }
      ]
    });
  } else {
    if (!textToParse) {
      throw new Error('Unable to extract readable text or supported image from the uploaded statement file.');
    }
    messages.push({
      role: 'user',
      content: `Here is the statement document content for ${partyType || 'party'}: ${partyName || 'Unknown'}:\n\n${textToParse}\n\nParse into the required JSON structure.`
    });
  }

  const result = await chatCompletion({
    messages,
    model: selectedModel,
    temperature: 0.1,
    responseFormat: { type: 'json_object' }
  });

  try {
    const cleaned = result.content.trim().replace(/^```json/i, '').replace(/```$/i, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    logger.error('Failed to parse Grok JSON output:', result.content);
    throw new Error('AI failed to produce structured statement JSON');
  }
}

/**
 * Deep Forensic Discrepancy Investigation via Grok Reasoning Model
 */
async function investigateDiscrepancies({
  partyName,
  partyType,
  erpClosingBalance,
  statementClosingBalance,
  variance,
  unmatchedStatementItems,
  unmatchedErpItems,
  discrepantItems,
  userPrompt = ''
}) {
  const systemPrompt = `You are a Principal Forensic Accountant and Auditor for Elite Edition, a high-volume textile and garment manufacturing ERP.
Analyze the following reconciliation discrepancy report between our internal ERP books and the external statement received from the party.
${userPrompt ? `\nUSER SPECIFIC DIRECTIVES & AUDIT FOCUS:\n"${userPrompt}"\nPlease pay special attention to the user directives above during your analysis.\n` : ''}
PARTY: ${partyName} (${partyType.toUpperCase()})
ERP Balance: ₹${erpClosingBalance}
Statement Balance: ₹${statementClosingBalance}
Net Variance / Difference: ₹${variance}

Unmatched in External Statement (Items in their statement not found in ERP):
${JSON.stringify(unmatchedStatementItems, null, 2)}

Unmatched in ERP (Items in ERP not found in their statement):
${JSON.stringify(unmatchedErpItems, null, 2)}

Discrepant / Disputed Items (Voucher matched but amounts differ):
${JSON.stringify(discrepantItems, null, 2)}

Provide an exhaustive, professional audit report in JSON format with:
{
  "auditSummary": "Executive summary of the discrepancy causes in 2-3 concise sentences.",
  "rootCauses": [
    {
      "title": "Cause headline (e.g., Uncredited NEFT Payment / Unadjusted TDS 0.1%)",
      "impactAmount": 0.0,
      "description": "Clear explanation of what happened.",
      "evidence": "Vouchers or dates referenced"
    }
  ],
  "potentialMatches": [
    {
      "statementItemIndex": 0,
      "erpItemIndices": [0, 1],
      "reasoning": "Explain compound match (e.g. 1 lump sum payment settling multiple invoices, or rate difference)",
      "confidence": "HIGH" | "MEDIUM" | "LOW"
    }
  ],
  "recommendedActions": [
    {
      "action": "CREATE_CREDIT_NOTE" | "POST_PAYMENT_ENTRY" | "ADJUST_TDS" | "REQUEST_PROOF_FROM_PARTY" | "WAIVE_ROUNDOFF",
      "targetAmount": 0.0,
      "instruction": "Step-by-step instruction for accounts staff to resolve this item in the ERP."
    }
  ],
  "disputeRisk": "LOW" | "MEDIUM" | "HIGH"
}`;

  const result = await chatCompletion({
    messages: [
      { role: 'system', content: 'You are an Indian Accounting and GST Reconciliation specialist.' },
      { role: 'user', content: systemPrompt }
    ],
    model: REASONING_MODEL,
    temperature: 0.15,
    responseFormat: { type: 'json_object' }
  });

  try {
    const cleaned = result.content.trim().replace(/^```json/i, '').replace(/```$/i, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    logger.error('Failed to parse Grok investigation output:', result.content);
    return {
      auditSummary: result.content,
      rootCauses: [],
      recommendedActions: []
    };
  }
}

/**
 * Generate WhatsApp & Email Settlement Notice
 */
async function generateSettlementNotice({ partyName, partyType, agreedBalance, variance, disputedItems, tone = 'POLITE_PROFESSIONAL' }) {
  const prompt = `Draft a polite, professional, and clear WhatsApp reconciliation message to ${partyName} (${partyType}) regarding account reconciliation.

Details:
- Our Books Balance: ₹${agreedBalance}
- Difference: ₹${variance}
- Disputed / Unreconciled count: ${disputedItems?.length || 0} items
- Disputed items summary: ${JSON.stringify(disputedItems?.slice(0, 5) || [])}
- Requested Tone: ${tone} (Indian business etiquette, courteous, clear call to action)

Format the output as a ready-to-copy WhatsApp message with emojis and clean formatting, including a request to verify the attached statement. Also provide an email subject and body.

Return JSON:
{
  "whatsappMessage": "Formatted WhatsApp text with emojis",
  "emailSubject": "Clear subject line",
  "emailBody": "Professional email body text"
}`;

  const result = await chatCompletion({
    messages: [
      { role: 'system', content: 'You are an enterprise communication specialist for an Indian manufacturing firm.' },
      { role: 'user', content: prompt }
    ],
    model: FAST_MODEL,
    temperature: 0.3,
    responseFormat: { type: 'json_object' }
  });

  try {
    const cleaned = result.content.trim().replace(/^```json/i, '').replace(/```$/i, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    return {
      whatsappMessage: result.content,
      emailSubject: `Ledger Reconciliation Notice - ${partyName}`,
      emailBody: result.content
    };
  }
}

/**
 * Interactive Financial Copilot Query
 */
async function copilotChat({ query, conversationHistory = [], erpContext = {} }) {
  const systemPrompt = `You are Elite AI Financial Copilot, an AI accounting advisor embedded inside Elite Edition ERP.
You assist accountants, managers, and directors with ledger reconciliation, GST matching, customer receivables, vendor payables, and bank reconciliation.
Context:
${JSON.stringify(erpContext, null, 2)}

Provide precise, actionable, and mathematically accurate financial advice. Use Indian currency (₹) and Indian accounting terminology (Dr/Cr, Challan, TDS u/s 194Q, GSTR-2B, E-Way Bill).`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-8),
    { role: 'user', content: query }
  ];

  return await chatCompletion({
    messages,
    model: FAST_MODEL,
    temperature: 0.2
  });
}

module.exports = {
  chatCompletion,
  parseStatementDocument,
  investigateDiscrepancies,
  generateSettlementNotice,
  copilotChat,
  FAST_MODEL,
  REASONING_MODEL
};
