/**
 * Master Centralized Company Registry & Scoping Constants (Backend)
 * Enforces strict multi-tenant isolation across all sister companies.
 */

const COMPANIES = [
  {
    id: 'elite_online',
    code: 'EON',
    name: 'Elite Online',
    type: 'E-Commerce Store & Operations',
    aliases: ['elite_online', 'eon', 'elite online', 'elite online store'],
  },
  {
    id: 'digital_print',
    code: 'EDP',
    name: 'Elite Digital Print',
    type: 'Digital Textile Printing',
    aliases: ['digital_print', 'edp', 'elite digital print', 'elite digital prints', 'digital print'],
  },
  {
    id: 'stitching',
    code: 'ES',
    name: 'Elite Stitching',
    type: 'Garment Stitching & Manufacturing',
    aliases: ['stitching', 'es', 'elite stitching', 'garment stitching'],
  },
  {
    id: 'elite_edition',
    code: 'EE',
    name: 'Elite Edition',
    type: 'Wholesale & Corporate Entity',
    aliases: ['elite_edition', 'ee', 'elite edition', 'wholesale'],
  },
  {
    id: 'elite_fabtex',
    code: 'EF',
    name: 'Elite Fabtex',
    type: 'Fabric & Textile Sales Entity',
    aliases: ['elite_fabtex', 'ef', 'elite fabtex', 'fabtex'],
  },
];

const COMPANY_IDS = COMPANIES.map((c) => c.id);

function normalizeCompanyId(input) {
  if (!input) return null;
  const str = String(input).trim().toLowerCase();
  for (const c of COMPANIES) {
    if (
      c.id === str ||
      c.code.toLowerCase() === str ||
      c.name.toLowerCase() === str ||
      c.aliases.includes(str)
    ) {
      return c.id;
    }
  }
  return null;
}

function getCompanyEntityName(companyId) {
  const norm = normalizeCompanyId(companyId);
  const found = COMPANIES.find((c) => c.id === norm);
  return found ? found.name : 'Elite Online';
}

function getCompanyById(companyId) {
  const norm = normalizeCompanyId(companyId);
  return COMPANIES.find((c) => c.id === norm) || COMPANIES[0];
}

function getCompanyAliases(companyId) {
  const norm = normalizeCompanyId(companyId);
  const found = COMPANIES.find((c) => c.id === norm);
  return found ? found.aliases : [];
}

/**
 * Builds a strict MongoDB filter for a company
 * Matches both `company_id` and legacy `companyEntity` / invoice prefixes
 */
function buildCompanyFilter(companyId) {
  const canonicalId = normalizeCompanyId(companyId) || 'elite_online';
  const comp = getCompanyById(canonicalId);
  const aliases = comp.aliases;
  const name = comp.name;
  const code = comp.code;

  return {
    $or: [
      { company_id: canonicalId },
      { companyEntity: { $in: [name, ...aliases] } },
      { companyEntity: new RegExp(`^${name}$`, 'i') },
      ...(code ? [{ invoiceNo: new RegExp(`^${code}`, 'i') }] : [])
    ]
  };
}

module.exports = {
  COMPANIES,
  COMPANY_IDS,
  normalizeCompanyId,
  getCompanyEntityName,
  getCompanyById,
  getCompanyAliases,
  buildCompanyFilter,
};
