const { GoogleGenerativeAI } = require('@google/generative-ai');
const BusinessConnection = require('../models/BusinessConnection.model');

let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

// System prompt definition matching user requirements exactly
const MASTER_AI_SYSTEM_PROMPT = `
You are the centralized Master AI Processing Agent for an existing ERP/CRM system.
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

### OUTPUT JSON SCHEMA:
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
`;

// Heuristic offline fallback parser when AI key is missing or fails
function parseOfflineFallback(rawText) {
  const text = String(rawText || '').trim();
  const lowerText = text.toLowerCase();

  // Phone regex
  const phoneMatch = text.match(/(?:\+91[\-\s]?)?[6-9]\d{9}/);
  const phone = phoneMatch ? phoneMatch[0].replace(/\D/g, '').slice(-10) : null;

  // Email regex
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : null;

  // Name extraction heuristic
  let name = 'Unspecified Contact';
  const nameMatch = text.match(/(?:name|from|contact|hi|i am|myself|this is)\s+([A-Za-z\s]{2,30})/i);
  if (nameMatch && nameMatch[1]) {
    name = nameMatch[1].trim();
  } else {
    const firstLine = text.split('\n')[0];
    if (firstLine && firstLine.length < 30) name = firstLine.trim();
  }

  // Classification heuristics
  let recordType = 'LEAD';
  if (lowerText.includes('gst') || lowerText.includes('bank') || lowerText.includes('vendor') || lowerText.includes('supplier') || lowerText.includes('ifsc')) {
    recordType = 'VENDOR';
  } else if (lowerText.includes('salary') || lowerText.includes('employee') || lowerText.includes('designer') || lowerText.includes('manager') || lowerText.includes('designation')) {
    recordType = 'EMPLOYEE';
  } else if (lowerText.includes('operator') || lowerText.includes('daily wage') || lowerText.includes('cutting') || lowerText.includes('stitching') || lowerText.includes('piece rate') || lowerText.includes('worker') || lowerText.includes('/day')) {
    recordType = 'WORKER';
  }

  const commonDir = {
    name,
    primary_phone: phone ? `+91${phone}` : null,
    whatsapp_phone: phone ? `+91${phone}` : null,
    email: email,
    city: text.match(/surat|ahmedabad|mumbai|delhi|jaipur/i) ? text.match(/surat|ahmedabad|mumbai|delhi|jaipur/i)[0] : null,
    state: 'Gujarat',
    address: null,
    is_active: true
  };

  if (recordType === 'LEAD') {
    const qtyMatch = text.match(/(\d+)\s*(?:mtr|meters|pcs|pieces|units)/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : null;
    return {
      record_type: 'LEAD',
      operation: 'UPSERT_RECORD',
      common_directory: commonDir,
      lead_data: {
        business_name: text.match(/from\s+([A-Za-z0-9\s]+(?:traders|fabrics|prints|sarees|creation|enterprise))/i)?.[1] || null,
        product_or_sku_interest: text.match(/(?:organza|satin|linen|crepe|georgette|chiffon|digital print)/i)?.[0] || 'Digital Printing',
        quantity: qty,
        budget: text.match(/(?:budget|rs|₹|\/mtr)\s*[\d\.\,]+/i)?.[0] || null,
        source: lowerText.includes('whatsapp') ? 'WhatsApp' : lowerText.includes('meta') || lowerText.includes('facebook') || lowerText.includes('instagram') ? 'Meta Ads' : 'Direct',
        lead_score: qty && qty > 500 ? 85 : 65,
        priority: qty && qty > 500 ? 'HOT' : 'WARM',
        pipeline_stage: 'New Lead',
        suggested_next_action: 'Send digital print rate catalog and request fabric sample swatch.',
        sla_followup_hours: 1,
        instant_reply_text: `Namaste ${name}! Thank you for reaching out to Elite Digital Prints. We received your requirement for ${qty ? qty + ' meters' : 'digital printing'}. Our sales executive will call you within 1 hour with best sample pricing.`
      },
      vendor_data: null,
      employee_data: null,
      worker_data: null
    };
  }

  if (recordType === 'VENDOR') {
    return {
      record_type: 'VENDOR',
      operation: 'UPSERT_RECORD',
      common_directory: commonDir,
      lead_data: null,
      vendor_data: {
        company_name: text.match(/(?:[A-Z0-9\s]{3,30})(?:Traders|Fabrics|Supplies|Mills|Textile)/i)?.[0] || name,
        gst_or_tax_id: text.match(/\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z0-9]{1}[Z]{1}[A-Z0-9]{1}/)?.[0] || null,
        bank_account: text.match(/(?:a\/c|account)\s*:?\s*(\d{9,18})/i)?.[1] || null,
        bank_ifsc: text.match(/[A-Z]{4}0[A-Z0-9]{6}/)?.[0] || null,
        upi_id: text.match(/[a-zA-Z0-9.\-_]+@[a-zA-Z]+/)?.[0] || null,
        payment_terms: lowerText.includes('net 30') ? 'Net 30' : lowerText.includes('net 15') ? 'Net 15' : 'Advance',
        supplied_items: 'Raw Fabric & Inks'
      },
      employee_data: null,
      worker_data: null
    };
  }

  if (recordType === 'EMPLOYEE') {
    const salaryMatch = text.match(/(?:salary|rs|₹)\s*([\d\,]+)/i);
    return {
      record_type: 'EMPLOYEE',
      operation: 'UPSERT_RECORD',
      common_directory: commonDir,
      lead_data: null,
      vendor_data: null,
      employee_data: {
        department: lowerText.includes('design') ? 'Design' : lowerText.includes('sales') ? 'Sales' : 'Production',
        designation: lowerText.includes('designer') ? 'Senior Fabric Designer' : 'Staff Executive',
        monthly_salary: salaryMatch ? parseInt(salaryMatch[1].replace(/,/g, ''), 10) : 35000,
        joining_date: new Date().toISOString().split('T')[0],
        emergency_contact: phone ? `+91${phone}` : null
      },
      worker_data: null
    };
  }

  // Worker
  const rateMatch = text.match(/(?:rate|rs|₹|\/day)\s*([\d\,]+)/i);
  return {
    record_type: 'WORKER',
    operation: 'UPSERT_RECORD',
    common_directory: commonDir,
    lead_data: null,
    vendor_data: null,
    employee_data: null,
    worker_data: {
      station_or_skill: lowerText.includes('grando') || lowerText.includes('printing') ? 'Printing Operator' : lowerText.includes('cutting') ? 'Cutting' : 'Shop Floor Worker',
      wage_model: lowerText.includes('piece') ? 'PIECE_RATE' : 'DAILY_WAGE',
      rate_amount: rateMatch ? parseInt(rateMatch[1].replace(/,/g, ''), 10) : 750,
      payout_schedule: lowerText.includes('daily') ? 'DAILY' : 'WEEKLY'
    }
  };
}

// 1. Process unstructured text using Master AI Agent
exports.parseBusinessConnectionAI = async (req, res) => {
  try {
    const { raw_text } = req.body;
    if (!raw_text || !String(raw_text).trim()) {
      return res.status(400).json({ error: 'raw_text is required for Master AI processing.' });
    }

    const textToProcess = String(raw_text).trim();

    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          generationConfig: { responseMimeType: 'application/json' }
        });

        const prompt = `${MASTER_AI_SYSTEM_PROMPT}\n\n### INCOMING UNSTRUCTURED TEXT:\n"${textToProcess}"\n\n### EXTRACTED DATABASE JSON:`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const rawOutput = response.text();

        let parsedJson;
        try {
          parsedJson = JSON.parse(rawOutput);
        } catch (e) {
          // Fallback regex extract JSON object if response has backticks
          const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedJson = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('LLM output not valid JSON');
          }
        }

        // Attach raw input text
        parsedJson.raw_input = textToProcess;
        return res.status(200).json(parsedJson);
      } catch (aiErr) {
        console.warn('Gemini API call failed or misconfigured, using heuristic fallback parser:', aiErr.message);
        const fallbackResult = parseOfflineFallback(textToProcess);
        fallbackResult.raw_input = textToProcess;
        return res.status(200).json(fallbackResult);
      }
    } else {
      // Offline fallback mode
      const fallbackResult = parseOfflineFallback(textToProcess);
      fallbackResult.raw_input = textToProcess;
      return res.status(200).json(fallbackResult);
    }
  } catch (error) {
    console.error('Error in parseBusinessConnectionAI:', error);
    res.status(500).json({ error: 'Failed to process text with Master AI Agent.' });
  }
};

// 2. Get list of Business Connections
exports.getConnections = async (req, res) => {
  try {
    const { record_type, search, priority, companyEntity } = req.query;

    const filter = {};
    if (companyEntity) {
      filter.companyEntity = companyEntity;
    } else {
      filter.companyEntity = 'Elite Digital Print';
    }

    if (record_type && record_type !== 'ALL') {
      filter.record_type = record_type.toUpperCase();
    }

    if (priority && priority !== 'ALL') {
      filter['lead_data.priority'] = priority.toUpperCase();
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { 'common_directory.name': regex },
        { 'common_directory.primary_phone': regex },
        { 'common_directory.whatsapp_phone': regex },
        { 'common_directory.email': regex },
        { 'common_directory.city': regex },
        { 'lead_data.business_name': regex },
        { 'vendor_data.company_name': regex },
        { 'employee_data.department': regex },
        { 'worker_data.station_or_skill': regex }
      ];
    }

    const connections = await BusinessConnection.find(filter).sort({ createdAt: -1 });

    // Calculate category counts
    const totalCount = await BusinessConnection.countDocuments({ companyEntity: filter.companyEntity });
    const leadCount = await BusinessConnection.countDocuments({ companyEntity: filter.companyEntity, record_type: 'LEAD' });
    const vendorCount = await BusinessConnection.countDocuments({ companyEntity: filter.companyEntity, record_type: 'VENDOR' });
    const employeeCount = await BusinessConnection.countDocuments({ companyEntity: filter.companyEntity, record_type: 'EMPLOYEE' });
    const workerCount = await BusinessConnection.countDocuments({ companyEntity: filter.companyEntity, record_type: 'WORKER' });

    res.status(200).json({
      connections,
      counts: {
        total: totalCount,
        lead: leadCount,
        vendor: vendorCount,
        employee: employeeCount,
        worker: workerCount
      }
    });
  } catch (error) {
    console.error('Error fetching business connections:', error);
    res.status(500).json({ error: 'Failed to fetch business connections.' });
  }
};

// 3. Upsert / Create Business Connection
exports.createConnection = async (req, res) => {
  try {
    const payload = req.body;

    if (!payload.record_type || !payload.common_directory || !payload.common_directory.name) {
      return res.status(400).json({ error: 'record_type and common_directory.name are required.' });
    }

    const recordType = payload.record_type.toUpperCase();
    const phone = payload.common_directory.primary_phone || payload.common_directory.whatsapp_phone;
    const name = payload.common_directory.name.trim();

    // Check for existing record to upsert by phone or (name + record_type)
    let existing = null;
    if (phone) {
      existing = await BusinessConnection.findOne({
        record_type: recordType,
        $or: [
          { 'common_directory.primary_phone': phone },
          { 'common_directory.whatsapp_phone': phone }
        ]
      });
    }

    if (!existing) {
      existing = await BusinessConnection.findOne({
        record_type: recordType,
        'common_directory.name': new RegExp(`^${name}$`, 'i')
      });
    }

    if (existing) {
      // Upsert update
      existing.common_directory = { ...existing.common_directory.toObject(), ...payload.common_directory };
      if (recordType === 'LEAD') existing.lead_data = payload.lead_data;
      if (recordType === 'VENDOR') existing.vendor_data = payload.vendor_data;
      if (recordType === 'EMPLOYEE') existing.employee_data = payload.employee_data;
      if (recordType === 'WORKER') existing.worker_data = payload.worker_data;
      if (payload.raw_input) existing.raw_input = payload.raw_input;

      await existing.save();
      return res.status(200).json({ message: 'Business connection updated successfully (UPSERT).', connection: existing });
    }

    // Create new
    const newConnection = new BusinessConnection({
      companyEntity: payload.companyEntity || 'Elite Digital Print',
      record_type: recordType,
      operation: 'UPSERT_RECORD',
      common_directory: payload.common_directory,
      lead_data: recordType === 'LEAD' ? payload.lead_data : null,
      vendor_data: recordType === 'VENDOR' ? payload.vendor_data : null,
      employee_data: recordType === 'EMPLOYEE' ? payload.employee_data : null,
      worker_data: recordType === 'WORKER' ? payload.worker_data : null,
      raw_input: payload.raw_input || null
    });

    await newConnection.save();
    res.status(201).json({ message: 'Business connection saved successfully.', connection: newConnection });
  } catch (error) {
    console.error('Error saving business connection:', error);
    res.status(500).json({ error: 'Failed to save business connection.' });
  }
};

// 4. Update Business Connection by ID
exports.updateConnection = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updated = await BusinessConnection.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!updated) {
      return res.status(404).json({ error: 'Business connection not found.' });
    }

    res.status(200).json({ message: 'Connection updated successfully.', connection: updated });
  } catch (error) {
    console.error('Error updating connection:', error);
    res.status(500).json({ error: 'Failed to update connection.' });
  }
};

// 5. Delete Business Connection
exports.deleteConnection = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await BusinessConnection.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Business connection not found.' });
    }
    res.status(200).json({ message: 'Connection deleted successfully.' });
  } catch (error) {
    console.error('Error deleting connection:', error);
    res.status(500).json({ error: 'Failed to delete connection.' });
  }
};

// 6. Add Note
exports.addNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, createdBy } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Note text is required.' });
    }

    const connection = await BusinessConnection.findById(id);
    if (!connection) {
      return res.status(404).json({ error: 'Business connection not found.' });
    }

    connection.notes.unshift({
      text: text.trim(),
      createdBy: createdBy || 'Staff Member',
      createdAt: new Date()
    });

    await connection.save();
    res.status(200).json({ message: 'Note added successfully.', connection });
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ error: 'Failed to add note.' });
  }
};
