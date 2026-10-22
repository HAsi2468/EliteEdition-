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
