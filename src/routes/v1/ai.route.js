const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { z } = require('zod');
const { validateRequest } = require('../../middlewares/validateRequest');
const router = express.Router();

let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

// POST /v1/ai/master-agent - Centralized Master AI Processing Agent
router.post('/master-agent', async (req, res) => {
  try {
    const { inputText, payload } = req.body;
    const rawInput = (inputText || (payload ? JSON.stringify(payload) : '')).trim();

    if (!rawInput) {
      return res.status(400).json({ error: 'Input text or payload is required for AI processing.' });
    }

    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const systemPrompt = `You are the centralized Master AI Processing Agent for Elite Digital Prints ERP/CRM system.
Your objective is to ingest any unstructured incoming text, webhook payload, message transcript, or form submission, classify the intent/entity type, extract and standardize all fields, and output strict, database-ready JSON.

### CLASSIFICATION CATEGORIES:
1. LEAD: Inquiries from prospects, sales leads, product interest, pricing requests (Meta Ads, WhatsApp, Website, Direct).
2. VENDOR: Suppliers, fabric/material vendors, ink/chemical providers, machinery/maintenance partners.
3. EMPLOYEE: Salaried staff (Designers, Sales reps, Production managers, Accountants).
4. WORKER: Shop-floor daily wage or piece-rate labor (Printing operators, Cutting, Stitching, QC, Packaging).

### INSTRUCTIONS:
- Analyze the input and set "record_type" to "LEAD", "VENDOR", "EMPLOYEE", or "WORKER".
- Populate the "common_directory" object for contact information.
- Populate ONLY the specific data block corresponding to the identified "record_type" (set other category blocks to null).
- For LEADS: Calculate "lead_score" (0-100), assign "priority" (HOT, WARM, COLD), recommend the immediate next sales task, and generate an "instant_reply_text".
- Standardize all phone numbers, wage types, and payment terms.
- Return ONLY the raw JSON object conforming strictly to the schema below. Do not include markdown code wrappers, backticks, or conversational text.

### OUTPUT JSON SCHEMA STRICT SPECIFICATION:
{
  "record_type": "LEAD | VENDOR | EMPLOYEE | WORKER",
  "operation": "UPSERT_RECORD",
  "common_directory": {
    "name": "string",
    "primary_phone": "string or null",
    "whatsapp_phone": "string or null",
    "email": "string or null",
    "city": "string or null",
    "state": "string or null",
    "address": "string or null",
    "is_active": true
  },
  "lead_data": {
    "business_name": "string or null",
    "product_or_sku_interest": "string or null",
    "quantity": "number or null",
    "budget": "string or null",
    "source": "Meta Ads | WhatsApp | Website | Direct | Referral",
    "lead_score": 0,
    "priority": "HOT | WARM | COLD",
    "pipeline_stage": "New Lead | Contacted | Qualified",
    "suggested_next_action": "string or null",
    "sla_followup_hours": 1,
    "instant_reply_text": "Personalized, polite WhatsApp/SMS response text"
  },
  "vendor_data": {
    "company_name": "string or null",
    "gst_or_tax_id": "string or null",
    "bank_account": "string or null",
    "bank_ifsc": "string or null",
    "upi_id": "string or null",
    "payment_terms": "Advance | Net 15 | Net 30 | COD",
    "supplied_items": "string or null"
  },
  "employee_data": {
    "department": "Design | Production | Sales | Accounts | Management",
    "designation": "string or null",
    "monthly_salary": "number or null",
    "joining_date": "YYYY-MM-DD or null",
    "emergency_contact": "string or null"
  },
  "worker_data": {
    "station_or_skill": "string (e.g., Printing Operator, Cutting, QC, Packaging)",
    "wage_model": "DAILY_WAGE | PIECE_RATE | MONTHLY",
    "rate_amount": "number or null",
    "payout_schedule": "DAILY | WEEKLY | MONTHLY"
  }
}

INPUT DATA TO PROCESS:
---
${rawInput}
---`;

        const result = await model.generateContent(systemPrompt);
        const response = await result.response;
        let responseText = response.text().trim();
        
        // Clean markdown backticks if any were returned despite instructions
        if (responseText.startsWith('```')) {
          responseText = responseText.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
        }
        
        try {
          const parsedJson = JSON.parse(responseText);
          return res.status(200).json({ success: true, mode: 'gemini', data: parsedJson });
        } catch (parseErr) {
          console.warn('Failed to parse Gemini output as JSON, falling back to NLP extractor:', parseErr);
        }
      } catch (geminiErr) {
        console.warn('Gemini API call failed, using smart local NLP classifier:', geminiErr.message);
      }
    }

    // Rule-based Smart NLP Extraction Fallback Engine
    const fallbackOutput = processSmartLocalNlp(rawInput);
    return res.status(200).json({ success: true, mode: 'smart_local_nlp', data: fallbackOutput });
  } catch (error) {
    console.error('Master AI Processing Agent Error:', error);
    res.status(500).json({ error: 'Failed to process incoming payload' });
  }
});

// POST /v1/ai/upsert-record - Commit processed AI record directly to database
router.post('/upsert-record', async (req, res) => {
  try {
    const recordData = req.body;
    const { record_type, common_directory, lead_data, vendor_data, employee_data, worker_data } = recordData;

    if (!record_type || !common_directory || !common_directory.name) {
      return res.status(400).json({ error: 'Invalid record structure. "record_type" and "common_directory.name" are required.' });
    }

    const LeadModel = require('../../db/models/lead.model');
    const VendorModel = require('../../db/models/vendor.model');
    const UserModel = require('../../db/models/user.model');

    let resultRecord = null;

    if (record_type === 'LEAD') {
      const phone = common_directory.primary_phone || common_directory.whatsapp_phone || '9999999999';
      let existing = await LeadModel.findOne({ phone });
      
      const leadDataObj = lead_data || {};
      const payload = {
        name: common_directory.name,
        phone,
        companyName: leadDataObj.business_name || common_directory.name,
        email: common_directory.email || '',
        source: ['WhatsApp', 'Phone Call', 'Reference', 'Instagram', 'Direct Visit'].includes(leadDataObj.source) ? leadDataObj.source : 'WhatsApp',
        stage: leadDataObj.pipeline_stage === 'Contacted' ? 'Contacted' : leadDataObj.pipeline_stage === 'Qualified' ? 'Quotation Sent' : 'New',
        priority: leadDataObj.priority === 'HOT' ? 'High' : leadDataObj.priority === 'COLD' ? 'Low' : 'Medium',
        estimatedValue: leadDataObj.budget ? parseInt(leadDataObj.budget.replace(/[^0-9]/g, '')) || 0 : 0,
        requirement: leadDataObj.product_or_sku_interest ? `${leadDataObj.product_or_sku_interest} (${leadDataObj.quantity || 'N/A'} qty)` : 'General Inquiry',
        notes: `AI Suggested Next Action: ${leadDataObj.suggested_next_action || 'N/A'}\nInstant Reply: ${leadDataObj.instant_reply_text || ''}`,
        companyEntity: 'Elite Digital Print'
      };

      if (existing) {
        resultRecord = await LeadModel.findByIdAndUpdate(existing._id, payload, { new: true });
      } else {
        resultRecord = await LeadModel.create(payload);
      }
    } else if (record_type === 'VENDOR') {
      const name = common_directory.name;
      let existing = await VendorModel.findOne({ name });
      
      const vendorDataObj = vendor_data || {};
      const payload = {
        name,
        businessName: vendorDataObj.company_name || common_directory.name,
        phone: common_directory.primary_phone || common_directory.whatsapp_phone || '',
        gstin: vendorDataObj.gst_or_tax_id || '',
        address: [common_directory.address, common_directory.city, common_directory.state].filter(Boolean).join(', ')
      };

      if (existing) {
        resultRecord = await VendorModel.findByIdAndUpdate(existing._id, payload, { new: true });
      } else {
        resultRecord = await VendorModel.create(payload);
      }
    } else if (record_type === 'EMPLOYEE' || record_type === 'WORKER') {
      const email = common_directory.email || `${common_directory.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@elitedigital.internal`;
      let existing = await UserModel.findOne({ email });

      const payload = {
        name: common_directory.name,
        email,
        role: 'user',
        permissions: record_type === 'WORKER' ? ['jobcards_printing_log'] : ['jobcards'],
        allowedCompanies: ['Elite Digital Print'],
        password: existing ? existing.password : '$2a$10$wE1V2vY90uP8QZ02B19eU.1s8l.94m4m1m1m1m1m1m1m1m1m1m1m' // default standard placeholder
      };

      if (existing) {
        resultRecord = await UserModel.findByIdAndUpdate(existing._id, payload, { new: true });
      } else {
        resultRecord = await UserModel.create(payload);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Record successfully upserted into ${record_type} database.`,
      upsertedRecord: resultRecord || recordData
    });
  } catch (error) {
    console.error('Master AI Upsert Record Error:', error);
    res.status(500).json({ error: error.message || 'Failed to upsert record to database' });
  }
});

// Helper function for local NLP classification & standardization
function processSmartLocalNlp(text) {
  const lower = text.toLowerCase();
  
  // Standard extraction helpers
  const phoneMatch = text.match(/(\+?\d{1,4}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}|\b\d{10}\b/);
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const nameMatch = text.match(/(?:name|from|mr\.|ms\.|shri|contact):\s*([a-zA-Z\s]+)/i) || text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/);
  const gstinMatch = text.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z0-9]{1}[Z]{1}[A-Z0-9]{1}\b/);
  const bankMatch = text.match(/(?:bank|a\/c|account):\s*([0-9A-Z\s]+)/i);
  const ifscMatch = text.match(/\b[A-Z]{4}0[A-Z0-9]{6}\b/);
  const quantityMatch = text.match(/\b(\d+)\s*(?:meters?|mtrs?|pcs|pieces|qty|quantity)\b/i);

  const phone = phoneMatch ? phoneMatch[0].replace(/[^0-9+]/g, '') : null;
  const name = nameMatch ? nameMatch[1].trim() : 'Inquiry Contact';
  const email = emailMatch ? emailMatch[0] : null;

  // Determine Record Type
  let record_type = 'LEAD';
  
  if (lower.includes('gst') || lower.includes('vendor') || lower.includes('supplier') || gstinMatch || ifscMatch || lower.includes('payment terms') || lower.includes('chemical') || lower.includes('ink supplier')) {
    record_type = 'VENDOR';
  } else if (lower.includes('daily wage') || lower.includes('piece rate') || lower.includes('operator') || lower.includes('labor') || lower.includes('cutting') || lower.includes('shift rate') || lower.includes('helper')) {
    record_type = 'WORKER';
  } else if (lower.includes('salary') || lower.includes('joining date') || lower.includes('designer') || lower.includes('accountant') || lower.includes('sales rep') || lower.includes('employee') || lower.includes('monthly payout')) {
    record_type = 'EMPLOYEE';
  }

  const common_directory = {
    name,
    primary_phone: phone,
    whatsapp_phone: phone,
    email,
    city: lower.includes('surat') ? 'Surat' : lower.includes('mumbai') ? 'Mumbai' : lower.includes('delhi') ? 'Delhi' : null,
    state: lower.includes('gujarat') ? 'Gujarat' : lower.includes('maharashtra') ? 'Maharashtra' : null,
    address: null,
    is_active: true
  };

  let lead_data = null;
  let vendor_data = null;
  let employee_data = null;
  let worker_data = null;

  if (record_type === 'LEAD') {
    const qty = quantityMatch ? parseInt(quantityMatch[1]) : 100;
    const isHot = qty >= 500 || lower.includes('urgent') || lower.includes('immediate');
    const lead_score = isHot ? 90 : qty >= 200 ? 70 : 45;
    
    lead_data = {
      business_name: name.includes(' ') ? `${name} Enterprise` : null,
      product_or_sku_interest: lower.includes('cotton') ? 'Digital Cotton Printing' : lower.includes('satin') ? 'Digital Satin Fabric' : lower.includes('polyester') ? 'Sublimation Print' : 'Custom Digital Textile Printing',
      quantity: qty,
      budget: lower.includes('rs') || lower.includes('inr') ? 'Standard Rates' : 'Negotiable',
      source: lower.includes('meta') || lower.includes('facebook') || lower.includes('instagram') ? 'Meta Ads' : lower.includes('website') ? 'Website' : 'WhatsApp',
      lead_score,
      priority: isHot ? 'HOT' : qty >= 200 ? 'WARM' : 'COLD',
      pipeline_stage: 'New Lead',
      suggested_next_action: 'Send Elite Digital Prints sample catalog & fabric rate card via WhatsApp',
      sla_followup_hours: isHot ? 1 : 4,
      instant_reply_text: `Hello ${name}, thank you for contacting Elite Digital Prints! We have received your inquiry for ${qty} meters of fabric printing. Our sales representative will connect with you within 1 hour to share best pricing & sample cards.`
    };
  } else if (record_type === 'VENDOR') {
    vendor_data = {
      company_name: `${name} Traders`,
      gst_or_tax_id: gstinMatch ? gstinMatch[0] : null,
      bank_account: bankMatch ? bankMatch[1] : null,
      bank_ifsc: ifscMatch ? ifscMatch[0] : null,
      upi_id: phone ? `${phone}@upi` : null,
      payment_terms: lower.includes('advance') ? 'Advance' : lower.includes('cod') ? 'COD' : lower.includes('30') ? 'Net 30' : 'Net 15',
      supplied_items: lower.includes('ink') ? 'Digital Printing Inks & Solvents' : lower.includes('fabric') ? 'Base Raw Fabric Roll' : 'Machinery Spare Parts'
    };
  } else if (record_type === 'EMPLOYEE') {
    employee_data = {
      department: lower.includes('design') ? 'Design' : lower.includes('sales') ? 'Sales' : lower.includes('account') ? 'Accounts' : 'Production',
      designation: lower.includes('designer') ? 'Senior CAD Designer' : lower.includes('sales') ? 'Executive Sales Manager' : 'Staff Executive',
      monthly_salary: 35000,
      joining_date: new Date().toISOString().split('T')[0],
      emergency_contact: phone
    };
  } else if (record_type === 'WORKER') {
    worker_data = {
      station_or_skill: lower.includes('cutting') ? 'Cutting Department' : lower.includes('stitching') ? 'Stitching Machine Operator' : 'Digital Printing Machine Operator',
      wage_model: lower.includes('piece') ? 'PIECE_RATE' : lower.includes('monthly') ? 'MONTHLY' : 'DAILY_WAGE',
      rate_amount: lower.includes('piece') ? 15 : 750,
      payout_schedule: lower.includes('weekly') ? 'WEEKLY' : lower.includes('monthly') ? 'MONTHLY' : 'DAILY'
    };
  }

  return {
    record_type,
    operation: 'UPSERT_RECORD',
    common_directory,
    lead_data,
    vendor_data,
    employee_data,
    worker_data
  };
}

// Validation Schema for Textile Measurement & Yield Agent
const calculateMeasurementSchema = z.object({
  inputMeters: z.union([z.number(), z.string()]).transform((val) => Math.max(0, parseFloat(val) || 0)).optional().default(100),
  fabricQuality: z.string().optional().default('French Crepe'),
  panna: z.string().optional().default('58"'),
  temp: z.union([z.number(), z.string()]).optional().default(205),
  speed: z.union([z.number(), z.string()]).optional().default(80),
  garmentType: z.string().optional().default('Kurti'),
  customPieceMeters: z.union([z.number(), z.string(), z.null()]).optional(),
  costPerMeter: z.union([z.number(), z.string(), z.null()]).optional(),
  shrinkageOverride: z.union([z.number(), z.string(), z.null()]).optional(),
  userPrompt: z.string().max(1500).optional().default('')
});

// POST /v1/ai/calculate-measurement - AI Textile Production Measurement Agent
router.post('/calculate-measurement', validateRequest({ body: calculateMeasurementSchema }), async (req, res) => {
  try {
    const {
      inputMeters = 100,
      fabricQuality = 'French Crepe',
      panna = '58"',
      temp = 205,
      speed = 80,
      garmentType = 'Kurti',
      customPieceMeters = null,
      costPerMeter = null,
      shrinkageOverride = null,
      userPrompt = ''
    } = req.body;

    const metersIn = Math.max(0, parseFloat(inputMeters) || 0);
    const fabricStr = String(fabricQuality || '').trim();
    const pannaNum = parseInt(String(panna).replace(/\D/g, '')) || 58;

    // 1. Fabric-Specific Shrinkage & Handling Parameters
    const fLower = fabricStr.toLowerCase();
    let shrinkagePct = 3.0;
    let recTemp = '205°C';
    let recSpeed = '80 m/min';
    let fabricCategory = 'Polyester Base';

    if (shrinkageOverride !== null && shrinkageOverride !== undefined && !isNaN(parseFloat(shrinkageOverride))) {
      shrinkagePct = parseFloat(shrinkageOverride);
    } else if (fLower.includes('crepe') || fLower.includes('french')) {
      shrinkagePct = 3.5;
      recTemp = '210°C';
      recSpeed = '80 m/min';
      fabricCategory = 'Poly Crepe';
    } else if (fLower.includes('organza')) {
      shrinkagePct = 1.8;
      recTemp = '195°C';
      recSpeed = '80 m/min';
      fabricCategory = 'Sheer Organza (Anti-Shrink)';
    } else if (fLower.includes('georgette') || fLower.includes('chiffon')) {
      shrinkagePct = 4.0;
      recTemp = '200°C';
      recSpeed = '80 m/min';
      fabricCategory = 'Lightweight Georgette';
    } else if (fLower.includes('satin')) {
      shrinkagePct = 2.2;
      recTemp = '205°C';
      recSpeed = '80 m/min';
      fabricCategory = 'High-Gloss Satin';
    } else if (fLower.includes('rayon') || fLower.includes('viscose') || fLower.includes('modal')) {
      shrinkagePct = 5.2;
      recTemp = '190°C';
      recSpeed = '76 m/min';
      fabricCategory = 'Cellulosic / Poly Rayon';
    } else if (fLower.includes('linen') || fLower.includes('kohinoor')) {
      shrinkagePct = 4.5;
      recTemp = '200°C';
      recSpeed = '78 m/min';
      fabricCategory = 'Kohinoor Linen Blend';
    } else if (fLower.includes('velvet') || fLower.includes('heavy')) {
      shrinkagePct = 3.0;
      recTemp = '205°C';
      recSpeed = '70 m/min';
      fabricCategory = 'Heavy Velvet Pile';
    }

    // 2. Mathematical Production Calculations
    const trimLossPct = 1.5; // Lead-in and tail-end roll trimming
    const shrinkageMeters = Number(((metersIn * shrinkagePct) / 100).toFixed(2));
    const trimmingMeters = Number(((metersIn * trimLossPct) / 100).toFixed(2));
    const totalWastageMeters = Number((shrinkageMeters + trimmingMeters).toFixed(2));
    const netOutputMeters = Number(Math.max(0, metersIn - totalWastageMeters).toFixed(2));
    const efficiencyPct = metersIn > 0 ? Number(((netOutputMeters / metersIn) * 100).toFixed(1)) : 0;

    // 3. Garment Yield Calculations (Panna-Adjusted)
    let pieceLength = 0;
    if (customPieceMeters && parseFloat(customPieceMeters) > 0) {
      pieceLength = parseFloat(customPieceMeters);
    } else {
      const gLower = String(garmentType || 'Kurti').toLowerCase();
      if (gLower.includes('kurti')) {
        pieceLength = pannaNum >= 56 ? 1.75 : pannaNum >= 46 ? 2.00 : 2.25;
      } else if (gLower.includes('saree')) {
        pieceLength = 5.50;
      } else if (gLower.includes('dupatta')) {
        pieceLength = 2.40;
      } else if (gLower.includes('gown') || gLower.includes('anarkali')) {
        pieceLength = pannaNum >= 56 ? 3.00 : 3.75;
      } else if (gLower.includes('top') || gLower.includes('tunic')) {
        pieceLength = pannaNum >= 56 ? 1.35 : 1.75;
      } else if (gLower.includes('co-ord') || gLower.includes('suit')) {
        pieceLength = pannaNum >= 56 ? 3.20 : 4.00;
      } else {
        pieceLength = 2.00;
      }
    }

    const expectedPieces = pieceLength > 0 ? Math.floor(netOutputMeters / pieceLength) : 0;
    const remnantMeters = pieceLength > 0 ? Number((netOutputMeters - (expectedPieces * pieceLength)).toFixed(2)) : 0;

    // Costing (optional)
    let costing = null;
    const ratePerMtr = parseFloat(costPerMeter);
    if (!isNaN(ratePerMtr) && ratePerMtr > 0) {
      const totalRawCost = Number((metersIn * ratePerMtr).toFixed(2));
      const effectiveCostPerFreshMtr = netOutputMeters > 0 ? Number((totalRawCost / netOutputMeters).toFixed(2)) : ratePerMtr;
      const fabricCostPerPiece = expectedPieces > 0 ? Number((totalRawCost / expectedPieces).toFixed(2)) : 0;
      costing = {
        ratePerMtr,
        totalRawCost,
        effectiveCostPerFreshMtr,
        fabricCostPerPiece
      };
    }

    // 4. AI-Enhanced Engineering Advice & Output Summary
    let aiAdvice = `For ${fabricStr || 'Poly'} at ${pannaNum}" panna: Thermal sublimation shrinkage is calibrated at ${shrinkagePct}% with a 1.5% edge/tail allowance. Maintaining cylinder pressure and feed tension will optimize output to ${netOutputMeters} fresh meters.`;

    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const aiPrompt = `You are a Senior Textile Production Engineer at Elite Digital Prints.
Inputs:
- Fabric: ${fabricStr} (${fabricCategory})
- Width (Panna): ${pannaNum} inches
- Raw Roll Meters: ${metersIn} meters
- Calculated Net Fresh Output: ${netOutputMeters} meters (Shrinkage: ${shrinkagePct}%, Trimming: ${trimLossPct}%)
- Garment Type: ${garmentType} (Fabric per piece: ${pieceLength}m, Yield: ${expectedPieces} pieces, Remnant: ${remnantMeters}m)
${userPrompt ? `- User Query / Instructions: "${userPrompt}"` : ''}

Provide a concise, professional 2-sentence shop-floor advisory on machine settings (speed/temperature), fabric handling tips to minimize shrinkage, and pattern cutting efficiency. Do not use markdown headers or bullet points.`;

        const result = await model.generateContent(aiPrompt);
        const text = result?.response?.text();
        if (text && text.trim()) {
          aiAdvice = text.trim();
        }
      } catch (aiErr) {
        console.warn('Gemini AI Measurement generation fallback:', aiErr.message);
      }
    }

    return res.json({
      success: true,
      calculation: {
        inputMeters: metersIn,
        fabric: fabricStr,
        fabricCategory,
        panna: `${pannaNum}"`,
        recommendedTemp: recTemp,
        recommendedSpeed: recSpeed,
        shrinkagePct,
        trimLossPct,
        shrinkageMeters,
        trimmingMeters,
        totalWastageMeters,
        netOutputMeters,
        efficiencyPct,
        garmentType,
        pieceLengthMeters: pieceLength,
        expectedPieces,
        remnantMeters,
        costing,
        aiAdvice
      }
    });
  } catch (err) {
    console.error('Error in /v1/ai/calculate-measurement:', err);
    return res.status(500).json({ error: 'Failed to calculate measurements: ' + err.message });
  }
});

module.exports = router;

