/**
 * ERP Tool Registry & Dynamic RBAC Permissions
 * Defines each internal tool alongside required permissions for authorization enforcement.
 */

const ERP_TOOLS = [
  {
    type: "function",
    requiredPermission: "production:read",
    function: {
      name: "get_job_card_status",
      description: "Fetch live operational status, current stage, and batch details for a job card.",
      parameters: {
        type: "object",
        properties: {
          jobCardId: { type: "string", description: "e.g., JC-2026-104 or JC-2026-8812" }
        },
        required: ["jobCardId"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    requiredPermission: "production:write",
    function: {
      name: "update_job_stage",
      description: "Advance a production job to its next operational stage.",
      parameters: {
        type: "object",
        properties: {
          jobCardId: { type: "string", description: "Job card ID to advance" },
          nextStage: {
            type: "string",
            enum: ["pre_press", "printing", "curing", "cutting", "packaging", "dispatched"],
            description: "Target operational stage"
          },
          notes: { type: "string", description: "Optional operator notes or handover comments" }
        },
        required: ["jobCardId", "nextStage"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    requiredPermission: "inventory:read",
    function: {
      name: "check_stock_balance",
      description: "Retrieve available meters/pieces, location, and reserved counts for an SKU or fabric.",
      parameters: {
        type: "object",
        properties: {
          itemCode: { type: "string", description: "SKU or fabric quality identifier" },
          warehouseId: { type: "string", description: "Optional specific godown or warehouse bay" }
        },
        required: ["itemCode"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    requiredPermission: "production:write",
    function: {
      name: "report_machine_downtime",
      description: "Report an unexpected machine breakdown, maintenance stop, or line halt for a job.",
      parameters: {
        type: "object",
        properties: {
          jobCardId: { type: "string" },
          reason: { type: "string", description: "Downtime diagnosis or incident details" }
        },
        required: ["jobCardId", "reason"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    requiredPermission: "billing:read",
    function: {
      name: "get_client_receivables",
      description: "Retrieve client outstanding invoices, total balance due, and payment aging report.",
      parameters: {
        type: "object",
        properties: {
          clientId: { type: "string", description: "Client/Party name or code" }
        },
        required: ["clientId"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    requiredPermission: "production:write",
    function: {
      name: "request_action_confirmation",
      description: "Create a Human-in-the-Loop confirmation ticket for a high-impact irreversible action. Call this INSTEAD of executing the action directly.",
      parameters: {
        type: "object",
        properties: {
          actionType:    { type: "string", enum: ["CANCEL_JOB", "DELETE_RECORD", "MANUAL_STOCK_ADJUSTMENT"] },
          payload:       { type: "string", description: "JSON string of the action parameters" },
          impactSummary: { type: "string", description: "One sentence describing the irreversible impact shown to the user" }
        },
        required: ["actionType", "payload", "impactSummary"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    requiredPermission: "billing:write",
    function: {
      name: "apply_order_discount",
      description: "Apply a discount to an order. Automatically escalates to a manager if the discount exceeds the user's authority limit.",
      parameters: {
        type: "object",
        properties: {
          orderId:     { type: "string" },
          discountPct: { type: "number", description: "Discount percentage 0–100" },
          reason:      { type: "string" }
        },
        required: ["orderId", "discountPct"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    requiredPermission: "inventory:read",
    function: {
      name: "optimize_fabric_rolls",
      description: "Optimize roll selection from available godown fabric stock to fulfill required meterage with minimal remnant scrap/waste.",
      parameters: {
        type: "object",
        properties: {
          fabricQuality: { type: "string", description: "Fabric quality or type, e.g. 'Cotton Cambric', 'Rayon 14kg', 'Georgette'" },
          requiredMeters: { type: "number", description: "Target meterage required for the job order, e.g. 350" },
          jobCardId: { type: "string", description: "Optional job card ID to link this roll assignment to" }
        },
        required: ["fabricQuality", "requiredMeters"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    requiredPermission: "production:read",
    function: {
      name: "estimate_ink_consumption",
      description: "Calculate expected CMYK digital print ink consumption (grams & liters), total ink cost, and print tank safety buffer.",
      parameters: {
        type: "object",
        properties: {
          meters: { type: "number", description: "Total print meterage to calculate, e.g. 1000" },
          coverageDensity: {
            type: "string",
            enum: ["light", "medium", "heavy", "allover_dark"],
            description: "Coverage density: 'light' (~15%), 'medium' (~35%), 'heavy' (~60%), or 'allover_dark' (~85%)"
          },
          pannaWidthInches: { type: "number", description: "Fabric panna / width in inches (e.g. 44, 58, or 60). Defaults to 58" },
          machineModel: { type: "string", description: "Digital printer model, e.g. 'Konica 512i', 'Kyocera High Speed', 'Epson i3200'" }
        },
        required: ["meters", "coverageDensity"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    requiredPermission: "production:read",
    function: {
      name: "get_production_bottlenecks",
      description: "Inspect active production lines for stuck batches, overdue job cards, and stage queue backlogs across Printing, Stitching, QA, and Dispatch.",
      parameters: {
        type: "object",
        properties: {
          department: { type: "string", description: "Optional department filter, e.g. 'digital_print' or 'garment'" },
          maxThresholdHours: { type: "number", description: "Hours threshold to flag a job as stuck (defaults to 24 hours)" }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    requiredPermission: "production:read",
    function: {
      name: "navigate_erp_screen",
      description: "Universal shortcut navigator: Open or switch to any screen, tab, or filtered view in the ERP system.",
      parameters: {
        type: "object",
        properties: {
          screen: {
            type: "string",
            enum: [
              "dashboard",
              "jobcards_list",
              "jobcards_printing_log",
              "jobcards_fusing_log",
              "jobcards_fabric",
              "jobcards_challan",
              "jobcards_catalogue",
              "jobcards_dispatch",
              "inventory",
              "ee_complaints",
              "reports",
              "task_management",
              "print_settings"
            ],
            description: "Target ERP module or tab to open"
          },
          searchQuery: { type: "string", description: "Optional search query, Job No, or SKU to pre-fill in the screen search filter" },
          title: { type: "string", description: "Human-readable label for the screen destination" }
        },
        required: ["screen"],
        additionalProperties: false
      }
    }
  }
];

/**
 * Filter tools dynamically by user permissions and strip internal metadata
 * Prevents unauthorized tools from ever entering the LLM prompt.
 */
function getPermittedTools(userPermissions = [], role = '', isAdmin = false) {
  const perms = Array.isArray(userPermissions) ? userPermissions : [];
  const isSuper = isAdmin || perms.includes("admin:*") || role === 'admin' || role === 'super_admin';

  return ERP_TOOLS
    .filter(t => isSuper || perms.includes(t.requiredPermission) || perms.includes(t.requiredPermission.split(':')[0] + ':*'))
    .map(({ type, function: fn }) => ({ type, function: fn }));
}

module.exports = {
  ERP_TOOLS,
  getPermittedTools
};
