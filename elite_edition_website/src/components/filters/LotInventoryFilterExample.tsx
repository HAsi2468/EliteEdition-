import React, { useState, useEffect } from 'react';
import {
  Package,
  Layers,
  ArrowUpDown,
  Download,
  Plus,
  RefreshCw,
  GitCompare,
} from 'lucide-react';
import {
  FilterFieldConfig,
  FilterToolbar,
  FilterDrawer,
  useFilterState,
  DateRangePickerWithCompare,
} from './index';

// Simulated ERP API call
const mockFetchSuppliers = async () => {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 300));
  return [
    { label: 'Vardhman Textiles Ltd', value: 'supp_001', count: 42 },
    { label: 'Arvind Mills', value: 'supp_002', count: 28 },
    { label: 'Raymond Fabric Division', value: 'supp_003', count: 19 },
    { label: 'Siyaram Silk Mills', value: 'supp_004', count: 15 },
    { label: 'Alok Industries', value: 'supp_005', count: 11 },
  ];
};

/**
 * 1. Declarative Filter Configuration Schema
 * Reusable across any ERP screen by altering this array.
 */
const LOT_INVENTORY_FILTER_CONFIG: FilterFieldConfig[] = [
  // Primary Quick Filter: Date Range with Comparison
  {
    key: 'dateRange',
    label: 'Inward Date',
    type: 'date-range',
    quickFilter: true,
    defaultValue: {
      preset: 'this_month',
    },
    description: 'Filter lots received within specific date range or compare against prior periods',
  },
  // Primary Quick Filter: Inward Status
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    quickFilter: true,
    options: [
      { label: 'Available (In Stock)', value: 'AVAILABLE' },
      { label: 'Reserved for Job Card', value: 'RESERVED' },
      { label: 'Under QC Inspection', value: 'QC_PENDING' },
      { label: 'Fully Consumed', value: 'EXHAUSTED' },
    ],
  },
  // Secondary Filter (Inside Drawer): Fabric Type Multi-Select
  {
    key: 'fabricType',
    label: 'Fabric Quality / Base',
    type: 'multi-select',
    section: 'Fabric Attributes',
    searchable: true,
    options: [
      { label: 'Cotton Cambric 60x60', value: 'COTTON_60' },
      { label: 'Rayon 14KG Slub', value: 'RAYON_14' },
      { label: 'Pure Chanderi Silk', value: 'CHANDERI_SILK' },
      { label: 'Viscose Georgette 60g', value: 'VISCOSE_GEO' },
      { label: 'Polyester Crepe', value: 'POLY_CREPE' },
    ],
  },
  // Secondary Filter (Inside Drawer): Dynamic Supplier List fetched from API
  {
    key: 'supplierId',
    label: 'Vendor / Mill Supplier',
    type: 'select',
    section: 'Fabric Attributes',
    options: mockFetchSuppliers,
  },
  // Secondary Filter (Inside Drawer): Meter Length Range
  {
    key: 'meters',
    label: 'Roll Length (Meters)',
    type: 'number-range',
    section: 'Measurements & Stock',
    unit: 'Mtr ',
    min: 10,
    max: 5000,
    step: 10,
  },
  // Secondary Filter (Inside Drawer): Cost per meter
  {
    key: 'ratePerMeter',
    label: 'Rate per Meter',
    type: 'number-range',
    section: 'Financials & Valuation',
    unit: '₹',
    min: 20,
    max: 2000,
    step: 5,
  },
];

/**
 * Real-world ERP Data Table Screen Example
 */
export default function LotInventoryFilterExample() {
  const [lotData, setLotData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize the Multi-Filter Hook
  const {
    appliedFilters,
    draftFilters,
    searchInput,
    setSearchInput,
    debouncedSearch,
    isDrawerOpen,
    openDrawer,
    closeDrawer,
    setDraftFilter,
    setQuickFilter,
    applyDraftFilters,
    resetFilters,
    removeFilter,
    activeFiltersCount,
    activeChips,
    getApiPayload,
  } = useFilterState({
    configs: LOT_INVENTORY_FILTER_CONFIG,
    syncWithUrl: true, // Syncs filter parameters directly with browser URL
    onFilterChange: (filters, payload) => {
      console.log('⚡ Filter Changed! Triggering Table API Request:', payload);
      fetchLots(payload);
    },
  });

  const fetchLots = async (payload: any) => {
    setIsLoading(true);
    // Simulate API query with payload parameters:
    // payload = { page: 1, limit: 50, search: '...', startDate: '2026-10-01', endDate: '2026-10-31', filters: { status: 'AVAILABLE', fabricType: [...] } }
    setTimeout(() => {
      setLotData([
        {
          id: 'LOT-2026-0891',
          fabric: 'Cotton Cambric 60x60',
          mill: 'Vardhman Textiles Ltd',
          meters: 840,
          rate: 115,
          status: 'AVAILABLE',
          inwardDate: '15/10/2026',
        },
        {
          id: 'LOT-2026-0892',
          fabric: 'Rayon 14KG Slub',
          mill: 'Arvind Mills',
          meters: 1250,
          rate: 88,
          status: 'RESERVED',
          inwardDate: '17/10/2026',
        },
        {
          id: 'LOT-2026-0893',
          fabric: 'Pure Chanderi Silk',
          mill: 'Raymond Fabric Division',
          meters: 420,
          rate: 340,
          status: 'AVAILABLE',
          inwardDate: '19/10/2026',
        },
      ]);
      setIsLoading(false);
    }, 250);
  };

  useEffect(() => {
    fetchLots(getApiPayload());
  }, []);

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            <span>Fabric Lot Inventory Management</span>
          </h1>
          <p className="text-xs text-slate-500">
            Real-time stock rolls, lot inward verification, and cutting allocation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Lot Inward</span>
          </button>
        </div>
      </div>

      {/* ── 2. PLUG-AND-PLAY MULTI-FILTER TOOLBAR & ACTIVE CHIPS ── */}
      <FilterToolbar
        configs={LOT_INVENTORY_FILTER_CONFIG}
        appliedFilters={appliedFilters}
        activeChips={activeChips}
        activeCount={activeFiltersCount}
        onOpenDrawer={openDrawer}
        onQuickFilterChange={setQuickFilter}
        onRemoveChip={removeFilter}
        onClearAll={resetFilters}
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search by Lot #, Fabric, or Challan..."
      />

      {/* ── 3. SLIDE-OVER ADVANCED FILTER DRAWER ── */}
      <FilterDrawer
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        configs={LOT_INVENTORY_FILTER_CONFIG}
        draftFilters={draftFilters}
        setDraftFilter={setDraftFilter}
        onApply={applyDraftFilters}
        onReset={resetFilters}
        activeCount={activeFiltersCount}
      />

      {/* ── 4. ENTERPRISE DATA TABLE GRID ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Lot Number</th>
                <th className="px-4 py-3">Fabric Quality</th>
                <th className="px-4 py-3">Mill Supplier</th>
                <th className="px-4 py-3 text-right">Length (Mtr)</th>
                <th className="px-4 py-3 text-right">Rate / Mtr</th>
                <th className="px-4 py-3">Inward Date</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                    <span>Loading lots matching active criteria...</span>
                  </td>
                </tr>
              ) : lotData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No fabric lots found matching current filters.
                  </td>
                </tr>
              ) : (
                lotData.map((lot) => (
                  <tr key={lot.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">{lot.id}</td>
                    <td className="px-4 py-3 font-medium">{lot.fabric}</td>
                    <td className="px-4 py-3 text-slate-600">{lot.mill}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {lot.meters.toLocaleString('en-IN')} Mtr
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      ₹{lot.rate.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{lot.inwardDate}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          lot.status === 'AVAILABLE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {lot.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
