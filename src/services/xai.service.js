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
    if (typeof errorData === 'object' && (errorData.code === 'personal-team-blocked:spending-limit' || errorData.error?.includes('spending-limit') || errorData.error?.includes('out of credits'))) {
      throw new Error('xAI Grok Spending Limit Reached: You have run out of credits or need a Grok subscription. Please add credits at https://grok.com/?_s=usage or upgrade plan.');
    }
    throw new Error(`xAI Error: ${typeof errorData === 'object' ? JSON.stringify(errorData) : errorData}`);
  }
}

const FormData = require('form-data');

/**
 * Upload raw file directly to xAI Files API
 */
async function uploadFileToXAI(buffer, filename = 'statement.pdf') {
  try {
    const form = new FormData();
    form.append('purpose', 'assistants');
    form.append('file', buffer, { filename });

    const res = await axios.post(`${XAI_BASE_URL}/files`, form, {
      headers: {
        Authorization: `Bearer ${XAI_API_KEY}`,
        ...form.getHeaders()
      },
      timeout: 60000
    });
    return res.data?.id;
  } catch (err) {
    logger.error('Failed to upload file to xAI:', err.response?.data || err.message);
    throw new Error(`xAI File Upload Error: ${err.message}`);
  }
}

/**
 * Delete temporary file from xAI Files API
 */
async function deleteFileFromXAI(fileId) {
  if (!fileId) return;
  try {
    await axios.delete(`${XAI_BASE_URL}/files/${fileId}`, {
      headers: { Authorization: `Bearer ${XAI_API_KEY}` },
      timeout: 10000
    });
  } catch (err) {
    logger.warn('Failed to delete temporary file from xAI:', err.message);
  }
}

/**
 * Universal Statement Parser via Grok Native PDF / Vision / Text
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
  let directXaiFileId = null;

  if (imageBase64 && typeof imageBase64 === 'string') {
    const isPdf = imageBase64.startsWith('data:application/pdf') ||
                  imageBase64.includes('application/pdf') ||
                  imageBase64.substring(0, 50).includes('JVBERi0');

    const isExcel = imageBase64.includes('spreadsheet') ||
                    imageBase64.includes('excel') ||
                    imageBase64.substring(0, 50).includes('UEsDB');

    if (isPdf) {
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
      const pdfBuffer = Buffer.from(cleanBase64, 'base64');

      // 1. Ultra-fast text stream extraction via pdf-parse (~90ms)
      try {
        const pdfModule = require('pdf-parse');
        let pdfText = '';
        if (typeof pdfModule === 'function') {
          const pdfData = await pdfModule(pdfBuffer);
          pdfText = pdfData?.text || '';
        } else if (pdfModule && pdfModule.PDFParse) {
          const parser = new pdfModule.PDFParse({ data: pdfBuffer });
          await parser.load();
          const res = await parser.getText();
          pdfText = res?.text || '';
          await parser.destroy();
        }
        if (pdfText && pdfText.trim().length > 30) {
          textToParse = (textToParse ? textToParse + '\n\n' : '') + pdfText;
        }
      } catch (pdfErr) {
        logger.warn('Local pdf-parse extraction skipped:', pdfErr.message);
      }

      // 2. If no text stream was found (scanned PDF / photo), upload directly to xAI Files API
      if (!textToParse || textToParse.length < 30) {
        try {
          logger.info('PDF has no text stream; uploading directly to xAI Files API for native Grok processing...');
          directXaiFileId = await uploadFileToXAI(pdfBuffer, 'statement.pdf');
        } catch (uploadErr) {
          logger.error('Failed to upload PDF directly to xAI Files API:', uploadErr.message);
        }
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

  try {
    let resultJson = null;

    // Case A: Direct PDF file uploaded to xAI
    if (directXaiFileId) {
      const response = await axios.post(`${XAI_BASE_URL}/responses`, {
        model: 'grok-4.7',
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: systemPrompt + '\n\nOutput strictly valid JSON only.' },
              { type: 'input_file', file_id: directXaiFileId }
            ]
          }
        ]
      }, {
        headers: {
          Authorization: `Bearer ${XAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 90000
      });

      const messageOutput = response.data?.output?.find(o => o.type === 'message')?.content;
      const rawOutputText = messageOutput?.[0]?.text || '';
      const cleaned = rawOutputText.trim().replace(/^```json/i, '').replace(/```$/i, '').trim();
      resultJson = JSON.parse(cleaned);
    }
    // Case B: Vision for image
    else if (validImageForVision && (!textToParse || textToParse.length < 30)) {
      const messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Please parse this ledger statement image for ${partyType || 'party'}: ${partyName || 'Unknown'}. Extract all transactions accurately.` },
            { type: 'image_url', image_url: { url: validImageForVision } }
          ]
        }
      ];

      const result = await chatCompletion({
        messages,
        model: FAST_MODEL,
        temperature: 0.1,
        responseFormat: { type: 'json_object' }
      });
      const cleaned = result.content.trim().replace(/^```json/i, '').replace(/```$/i, '').trim();
      resultJson = JSON.parse(cleaned);
    }
    // Case C: Extracted text stream (fastest, ~10-20s)
    else {
      if (!textToParse) {
        throw new Error('Unable to extract readable text or supported image from the uploaded statement file.');
      }

      const messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Here is the statement document content for ${partyType || 'party'}: ${partyName || 'Unknown'}:\n\n${textToParse}\n\nParse into the required JSON structure.`
        }
      ];

      const result = await chatCompletion({
        messages,
        model: FAST_MODEL,
        temperature: 0.1,
        responseFormat: { type: 'json_object' }
      });
      const cleaned = result.content.trim().replace(/^```json/i, '').replace(/```$/i, '').trim();
      resultJson = JSON.parse(cleaned);
    }

    return resultJson;
  } catch (err) {
    logger.warn('Grok AI parsing failed, attempting tabular heuristic extraction:', err.message);

    // Heuristic Fallback: If text was extracted from PDF/Excel, parse lines directly into transactions
    if (textToParse && textToParse.length > 20) {
      try {
        const heuristicData = parseTextStreamHeuristic(textToParse, partyName);
        if (heuristicData && heuristicData.transactions.length > 0) {
          logger.info(`Heuristic parser successfully extracted ${heuristicData.transactions.length} rows as fallback.`);
          return heuristicData;
        }
      } catch (hErr) {
        logger.warn('Heuristic extraction also failed:', hErr.message);
      }
    }

    const isCreditExhausted = err.message.includes('spending-limit') || err.message.includes('out of credits') || err.message.includes('Spending Limit');
    if (isCreditExhausted) {
      throw new Error('xAI Grok Spending Limit Reached: You have run out of credits or need a Grok subscription. Please add credits at https://grok.com/?_s=usage or upgrade plan.');
    }
    throw new Error(`AI statement parsing error: ${err.message}`);
  } finally {
    if (directXaiFileId) {
      deleteFileFromXAI(directXaiFileId).catch(() => {});
    }
  }
}

/**
 * Heuristic Tabular Statement Parser
 * Extracts dates, voucher numbers, descriptions, debits, and credits when AI API is unavailable/exhausted
 */
function parseTextStreamHeuristic(rawText, partyName = '') {
  const lines = String(rawText).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const transactions = [];
  let openingBalance = 0;
  let closingBalance = 0;

  const dateRegex = /\b(\d{1,2}[-/.](?:\d{1,2}|[A-Za-z]{3})[-/.](?:\d{2,4})|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b/;
  const amountRegex = /\b\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?\b/g;

  lines.forEach((line, idx) => {
    if (/opening\s*bal/i.test(line)) {
      const matches = line.match(amountRegex);
      if (matches && matches.length > 0) {
        openingBalance = parseFloat(matches[matches.length - 1].replace(/,/g, '')) || 0;
      }
      return;
    }
    if (/closing\s*bal/i.test(line)) {
      const matches = line.match(amountRegex);
      if (matches && matches.length > 0) {
        closingBalance = parseFloat(matches[matches.length - 1].replace(/,/g, '')) || 0;
      }
      return;
    }

    const dateMatch = line.match(dateRegex);
    if (!dateMatch) return;

    const rawDate = dateMatch[1];
    let formattedDate = rawDate;
    try {
      const parts = rawDate.split(/[-/.]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          formattedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else {
          const yr = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
          formattedDate = `${yr}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    } catch (_) {}

    const rawAmounts = (line.match(amountRegex) || [])
      .map(a => parseFloat(a.replace(/,/g, '')))
      .filter(a => !isNaN(a) && a > 0);

    if (rawAmounts.length === 0) return;

    const vchMatch = line.match(/(?:INV|BILL|REC|CH|VCH|PAY|JV|DN|CN)[-_/\w\d]+/i) || line.match(/\b\d{3,8}\b/);
    const voucherNo = vchMatch ? vchMatch[0] : `VCH-${idx + 1}`;

    let debit = 0;
    let credit = 0;
    let balance = 0;

    if (rawAmounts.length === 1) {
      if (/cr|credit|rcpt|receipt|payment/i.test(line)) {
        credit = rawAmounts[0];
      } else {
        debit = rawAmounts[0];
      }
    } else if (rawAmounts.length >= 2) {
      if (/cr|credit/i.test(line)) {
        credit = rawAmounts[0];
        balance = rawAmounts[1] || 0;
      } else {
        debit = rawAmounts[0];
        balance = rawAmounts[1] || 0;
      }
    }

    transactions.push({
      date: formattedDate,
      voucherNo,
      type: credit > 0 ? 'PAYMENT' : 'INVOICE',
      narration: line.substring(0, 90),
      debit,
      credit,
      balance,
      ref: voucherNo
    });
  });

  return {
    partyName: partyName || 'Reconciled Party',
    statementPeriod: { startDate: '', endDate: '' },
    openingBalance,
    openingBalanceType: 'DR',
    closingBalance,
    closingBalanceType: 'DR',
    transactions
  };
}

/**
 * Deep Forensic Discrepancy Investigation via Grok / Rule Engine Fallback
 */
async function investigateDiscrepancies({
  partyName,
  partyType,
  erpClosingBalance,
  statementClosingBalance,
  variance,
  unmatchedStatementItems = [],
  unmatchedErpItems = [],
  discrepantItems = [],
  userPrompt = ''
}) {
  const systemPrompt = `You are a Principal Forensic Accountant and Auditor for Elite Edition, a high-volume textile and garment manufacturing ERP.
Analyze the following reconciliation discrepancy report between our internal ERP books and the external statement received from the party.
${userPrompt ? `\nUSER SPECIFIC DIRECTIVES & AUDIT FOCUS:\n"${userPrompt}"\nPlease pay special attention to the user directives above during your analysis.\n` : ''}
PARTY: ${partyName} (${(partyType || 'general').toUpperCase()})
ERP Balance: ₹${erpClosingBalance}
Statement Balance: ₹${statementClosingBalance}
Net Variance / Difference: ₹${variance}

Unmatched in External Statement (Items in their statement not found in ERP):
${JSON.stringify((unmatchedStatementItems || []).slice(0, 30), null, 2)}

Unmatched in ERP (Items in ERP not found in their statement):
${JSON.stringify((unmatchedErpItems || []).slice(0, 30), null, 2)}

Discrepant / Disputed Items (Voucher matched but amounts differ):
${JSON.stringify((discrepantItems || []).slice(0, 30), null, 2)}

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
  "potentialMatches": [],
  "recommendedActions": [
    {
      "action": "CREATE_CREDIT_NOTE" | "POST_PAYMENT_ENTRY" | "ADJUST_TDS" | "REQUEST_PROOF_FROM_PARTY" | "WAIVE_ROUNDOFF",
      "targetAmount": 0.0,
      "instruction": "Step-by-step instruction for accounts staff to resolve this item in the ERP."
    }
  ],
  "disputeRisk": "LOW" | "MEDIUM" | "HIGH"
}`;

  try {
    const result = await chatCompletion({
      messages: [
        { role: 'system', content: 'You are an Indian Accounting and GST Reconciliation specialist.' },
        { role: 'user', content: systemPrompt }
      ],
      model: FAST_MODEL,
      temperature: 0.15,
      responseFormat: { type: 'json_object' }
    });

    const cleaned = result.content.trim().replace(/^```json/i, '').replace(/```$/i, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    logger.warn('Grok AI investigation unavailable, generating forensic rule-based audit report:', e.message);
    const isCreditExhausted = e.message.includes('spending-limit') || e.message.includes('out of credits') || e.message.includes('Spending Limit');

    const rootCauses = [];
    const unmatchedStmt = unmatchedStatementItems || [];
    const unmatchedErp = unmatchedErpItems || [];
    const discrepant = discrepantItems || [];

    if (unmatchedStmt.length > 0) {
      const total = unmatchedStmt.reduce((acc, i) => acc + (Number(i.amount) || Number(i.debit) || Number(i.credit) || 0), 0);
      rootCauses.push({
        title: 'Unrecorded Counterparty Entries',
        impactAmount: total,
        description: `${unmatchedStmt.length} transactions totaling ₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })} appear in the counterparty statement but are not booked in our ERP.`,
        evidence: unmatchedStmt.slice(0, 3).map(i => i.voucherNo || i.ref || i.date).filter(Boolean).join(', ')
      });
    }

    if (unmatchedErp.length > 0) {
      const total = unmatchedErp.reduce((acc, i) => acc + (Number(i.amount) || Number(i.debit) || Number(i.credit) || 0), 0);
      rootCauses.push({
        title: 'Unreflected Internal Bills / Payments',
        impactAmount: total,
        description: `${unmatchedErp.length} internal vouchers totaling ₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })} are recorded in our books but absent from the party statement.`,
        evidence: unmatchedErp.slice(0, 3).map(i => i.voucherNo || i.ref || i.date).filter(Boolean).join(', ')
      });
    }

    if (discrepant.length > 0) {
      const total = discrepant.reduce((acc, i) => acc + (Number(i.difference) || Number(i.matchedWith?.variance) || 0), 0);
      rootCauses.push({
        title: 'Amount Variance on Matched References',
        impactAmount: total,
        description: `${discrepant.length} vouchers matched by reference numbers but have rate/deduction differences totaling ₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`,
        evidence: discrepant.slice(0, 3).map(i => i.voucherNo).filter(Boolean).join(', ')
      });
    }

    return {
      auditSummary: `Reconciliation completed for ${partyName}. Net variance: ₹${Number(variance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}. Found ${unmatchedStmt.length + unmatchedErp.length} unmatched entries and ${discrepant.length} amount discrepancies.${isCreditExhausted ? ' (Note: xAI Grok credits exhausted on API key; generated via Forensic Rule Engine).' : ''}`,
      rootCauses,
      potentialMatches: [],
      recommendedActions: [
        {
          action: 'REQUEST_PROOF_FROM_PARTY',
          targetAmount: Math.abs(Number(variance || 0)),
          instruction: 'Request payment UTR receipts and counterparty ledger confirmation for unrecorded entries.'
        },
        {
          action: 'ADJUST_TDS',
          targetAmount: 0,
          instruction: 'Verify if amount variances correspond to TDS deduction (0.1% u/s 194Q / 206C) or trade discounts.'
        }
      ],
      disputeRisk: Math.abs(Number(variance || 0)) < 1 ? 'LOW' : Math.abs(Number(variance || 0)) > 50000 ? 'HIGH' : 'MEDIUM',
      quotaWarning: isCreditExhausted ? 'xAI Grok API key credit limit reached. Please top up at https://grok.com/?_s=usage' : null
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

  try {
    const result = await chatCompletion({
      messages: [
        { role: 'system', content: 'You are an enterprise communication specialist for an Indian manufacturing firm.' },
        { role: 'user', content: prompt }
      ],
      model: FAST_MODEL,
      temperature: 0.3,
      responseFormat: { type: 'json_object' }
    });

    const cleaned = result.content.trim().replace(/^```json/i, '').replace(/```$/i, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    logger.warn('AI settlement notice generation failed, using standard template:', e.message);
    const whatsappMsg = `Dear Accounts Team (${partyName || 'Party'}),\n\nGreetings from Elite Edition.\n\nWe have completed our periodic ledger reconciliation. As per our books:\n• Our Book Balance: ₹${agreedBalance}\n• Net Variance / Difference: ₹${variance}\n\nKindly review your statement and share your ledger confirmation or transaction UTRs at your earliest convenience to reconcile this variance.\n\nThank you,\nAccounts Department\nElite Edition`;
    return {
      whatsappMessage: whatsappMsg,
      emailSubject: `Ledger Reconciliation Statement - ${partyName || 'Party'}`,
      emailBody: whatsappMsg
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

  try {
    return await chatCompletion({
      messages,
      model: FAST_MODEL,
      temperature: 0.2
    });
  } catch (err) {
    logger.warn('Copilot chat completion failed:', err.message);
    return {
      content: `I am currently operating with local accounting heuristics because the xAI Grok API quota has reached its spending limit.

Based on the ledger context:
• Book 1 Balance: ₹${erpContext?.statement1Balance || 0} (${erpContext?.statement1Name || 'Elite Files'})
• Book 2 Balance: ₹${erpContext?.statement2Balance || 0} (${erpContext?.statement2Name || 'Party File'})
• Net Variance: ₹${erpContext?.reconciliationSummary?.variance || 0}

Please add credits at https://grok.com/?_s=usage to enable continuous deep generative analysis.`
    };
  }
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
