/**
 * Lead Qualification & Evaluation Engine for Elite Digital Print ERP/CRM
 * Adheres strictly to the 0-100 Lead Scoring rules and standardized JSON output schema.
 */

function evaluateLeadInquiry(rawText, sourceOverride = null) {
  const text = String(rawText || '').trim();
  const textLower = text.toLowerCase();

  // 1. Extract Lead Profile
  const phoneMatch = text.match(/(?:\+91[\s-]?)?[6-9]\d{9}|\b\d{10}\b/);
  const phone = phoneMatch ? phoneMatch[0].replace(/\s+/g, '') : null;

  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : null;

  // City / Location extraction
  const cities = ['surat', 'mumbai', 'ahmedabad', 'delhi', 'jaipur', 'pune', 'bangalore', 'kolkata', 'indore', 'rajkot', 'ludhiana', 'tirupur'];
  let cityLocation = null;
  for (const c of cities) {
    if (textLower.includes(c)) {
      cityLocation = c.charAt(0).toUpperCase() + c.slice(1);
      break;
    }
  }

  // Name extraction (e.g. "I am Rahul", "Name: Suresh Patel", "from Ramesh Traders")
  let fullName = null;
  const nameMatch = text.match(/(?:my name is|i am|name[:\s]+|regards,?\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (nameMatch) {
    fullName = nameMatch[1].trim();
  }

  // Business Name extraction
  let companyOrBusiness = null;
  const companyMatch = text.match(/(?:from|company|firm|traders|exports|creation|studio|prints|textiles)[:\s]+([A-Za-z0-9\s&]+(?:Traders|Exports|Textiles|Prints|Pvt Ltd|LLP|Studio|Creations|Fashion|House))/i);
  if (companyMatch) {
    companyOrBusiness = companyMatch[1].trim();
  }

  // 2. Product / Service Interest & Quantity / Budget
  const productKeywords = [
    'sublimation', 'sublimation paper', 'digital print', 'digital printing', 
    'fabric printing', 'cotton printing', 'rayon 58', 'satin 58', 'polyester', 
    'roll to roll', 'grando ink', 'printdot ink', 'butter paper', 'sample yardage', 
    'garment stitching', 'fusing', 't-shirt'
  ];

  let matchedProducts = productKeywords.filter(p => textLower.includes(p));
  let productInterest = matchedProducts.length > 0 
    ? matchedProducts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' & ') 
    : 'Digital Fabric Printing';

  // Quantity Extraction (e.g. 500 meters, 50 rolls, 1000 pcs, 200m)
  let estimatedQuantity = null;
  const qtyMatch = text.match(/(\d+)\s*(?:meters?|mtrs?|m\b|rolls?|pcs|pieces|kg|liters?|ltrs?)/i);
  if (qtyMatch) {
    estimatedQuantity = parseInt(qtyMatch[1], 10);
  }

  // Budget Extraction (e.g. 50k, ₹50,000, Rs. 20000, 1 lakh)
  let estimatedBudget = null;
  const budgetMatch = text.match(/(?:₹|rs\.?|inr|budget[:\s]*)\s*(\d+(?:,\d+)*(?:\s*k|\s*lakh)?)/i);
  if (budgetMatch) {
    estimatedBudget = '₹' + budgetMatch[1];
  }

  // Lead Source
  let leadSource = sourceOverride || 'WhatsApp';
  if (!sourceOverride) {
    if (textLower.includes('meta') || textLower.includes('facebook') || textLower.includes('instagram')) leadSource = 'Meta Ads';
    else if (textLower.includes('website') || textLower.includes('form')) leadSource = 'Web Form';
    else if (textLower.includes('referred') || textLower.includes('referral')) leadSource = 'Referral';
  }

  // 3. Scoring Rules Computation (0 - 100)
  let score = 0;
  const breakdown = {
    product_sku_matched: false,
    qty_or_budget_provided: false,
    high_urgency_detected: false,
    valid_contact_provided: false,
    business_or_bulk_inquiry: false
  };

  // Rule 1: Specific Product / SKU mentioned (+25 pts)
  if (matchedProducts.length > 0 || /sku|quality|panna|gsm|catalog/i.test(textLower)) {
    score += 25;
    breakdown.product_sku_matched = true;
  }

  // Rule 2: Order Quantity / Budget provided (+25 pts)
  if (estimatedQuantity !== null || estimatedBudget !== null || /quantity|meters|rolls|pieces|volume|rate per meter/i.test(textLower)) {
    score += 25;
    breakdown.qty_or_budget_provided = true;
  }

  // Rule 3: High Urgency / Ready to buy timeline (+25 pts)
  const urgencyKeywords = ['urgent', 'today', 'asap', 'ready to order', 'immediate', 'this week', 'fast', 'quick delivery', 'urgent requirement'];
  if (urgencyKeywords.some(u => textLower.includes(u))) {
    score += 25;
    breakdown.high_urgency_detected = true;
  }

  // Rule 4: Valid Contact Info (Phone + Email/Location) (+15 pts)
  if (phone || email || cityLocation) {
    score += 15;
    breakdown.valid_contact_provided = true;
  }

  // Rule 5: Business / Bulk Inquiry (+10 pts)
  const bulkKeywords = ['bulk', 'wholesale', 'factory', 'moq', 'traders', 'regular order', 'production', 'commercial', 'sample testing'];
  if (bulkKeywords.some(b => textLower.includes(b)) || (estimatedQuantity && estimatedQuantity >= 100)) {
    score += 10;
    breakdown.business_or_bulk_inquiry = true;
  }

  // Cap score 0 to 100
  score = Math.min(100, Math.max(0, score));

  // Priority Tier Determination
  let priority = 'COLD';
  let slaHours = 24;
  if (score >= 70) {
    priority = 'HOT';
    slaHours = 0.25; // 15 mins
  } else if (score >= 40) {
    priority = 'WARM';
    slaHours = 4;
  } else {
    priority = 'COLD';
    slaHours = 24;
  }

  // Pipeline Stage & Lead Intent
  let pipelineStage = 'New Lead';
  let leadIntent = 'Price Inquiry';

  if (breakdown.high_urgency_detected && breakdown.qty_or_budget_provided) {
    leadIntent = 'Immediate Purchase';
    pipelineStage = 'Qualified';
  } else if (breakdown.business_or_bulk_inquiry || (estimatedQuantity && estimatedQuantity >= 500)) {
    leadIntent = 'Bulk Order';
    pipelineStage = 'New Lead';
  } else if (breakdown.product_sku_matched) {
    leadIntent = 'Price Inquiry';
  } else {
    leadIntent = 'General Browsing';
  }

  // Assignee Role & Next Action
  let suggestedAssignee = 'Sales Rep';
  let nextAction = 'Call lead within SLA to confirm inquiry details and share price catalog.';

  if (priority === 'HOT') {
    suggestedAssignee = 'B2B Specialist';
    nextAction = `Immediate call required within 15 minutes! Confirm ${productInterest} quantity (${estimatedQuantity ? estimatedQuantity + ' units' : 'inquire volume'}) and provide priority sample/quote.`;
  } else if (priority === 'WARM') {
    suggestedAssignee = 'Sales Rep';
    nextAction = `Follow up within 4 hours. Share digital printing sample catalog and discuss ${productInterest} requirements.`;
  } else {
    suggestedAssignee = 'Support';
    nextAction = `Automated nurture sequence: Send WhatsApp digital catalog and price chart for ${productInterest}.`;
  }

  // Raw Notes Summary
  const summaryParts = [];
  summaryParts.push(`Lead inquired about ${productInterest}`);
  if (estimatedQuantity) summaryParts.push(`with estimated quantity of ${estimatedQuantity} units`);
  if (cityLocation) summaryParts.push(`located in ${cityLocation}`);
  if (breakdown.high_urgency_detected) summaryParts.push(`and indicated high urgency for immediate fulfillment.`);
  else summaryParts.push(`seeking catalog rates.`);
  const rawNotesSummary = summaryParts.join(' ');

  // Auto-Response Draft (WhatsApp / Email)
  const clientGreeting = fullName ? `Hello ${fullName}` : `Hello`;
  const channel = (email && !phone) ? 'Email' : 'WhatsApp';

  let autoResponseMsg = '';
  if (priority === 'HOT') {
    autoResponseMsg = `${clientGreeting}, thank you for reaching out to Elite Digital Print! We received your urgent request regarding ${productInterest}${estimatedQuantity ? ` (${estimatedQuantity} units)` : ''}. Our B2B specialist is reviewing your inquiry right now and will call you within 15 minutes with customized pricing & delivery timeline. Feel free to view our latest digital fabric catalog in the meantime!`;
  } else if (priority === 'WARM') {
    autoResponseMsg = `${clientGreeting}, thank you for contacting Elite Digital Print! We would be delighted to assist you with ${productInterest}. Our team has received your inquiry and will share our comprehensive catalog & rate card shortly. Let us know if you require physical fabric sample swatches!`;
  } else {
    autoResponseMsg = `${clientGreeting}, thanks for visiting Elite Digital Print! Here is our digital fabric printing catalog and price list. Please let us know your preferred quantity & fabric quality so we can provide you with an exact quotation!`;
  }

  // Construct Final Standardized JSON
  const outputJson = {
    lead_profile: {
      full_name: fullName,
      phone: phone,
      email: email,
      city_location: cityLocation,
      company_or_business_name: companyOrBusiness
    },
    inquiry_details: {
      product_service_interest: productInterest,
      estimated_quantity: estimatedQuantity,
      estimated_budget: estimatedBudget,
      lead_source: leadSource,
      raw_notes_summary: rawNotesSummary
    },
    qualification: {
      lead_score: score,
      priority: priority,
      pipeline_stage: pipelineStage,
      lead_intent: leadIntent
    },
    action_plan: {
      suggested_assignee_role: suggestedAssignee,
      next_action: nextAction,
      sla_follow_up_hours: slaHours
    },
    auto_response_draft: {
      channel: channel,
      message: autoResponseMsg
    },
    scoring_breakdown: breakdown
  };

  return outputJson;
}

module.exports = {
  evaluateLeadInquiry
};
