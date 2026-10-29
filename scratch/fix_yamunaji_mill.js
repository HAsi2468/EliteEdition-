global.crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('../src/config/config.js');
const PrintConfig = require('../src/db/models/printConfig.model.js');

async function fix() {
  await mongoose.connect(config.mongoose.url, config.mongoose.options);

  const tpsData = [
    { srNo: 1, tpNo: '1704', tpMtr: 150.0, status: 'Sent to Mill', millChallanNo: 'FB895', lotNumber: 'GRAY-2026-001' },
    { srNo: 2, tpNo: '2130', tpMtr: 172.0, status: 'Sent to Mill', millChallanNo: 'FB895', lotNumber: 'GRAY-2026-001' },
    { srNo: 3, tpNo: '2118', tpMtr: 100.0, status: 'Sent to Mill', millChallanNo: 'FB895', lotNumber: 'GRAY-2026-001' },
    { srNo: 4, tpNo: '2113', tpMtr: 100.0, status: 'Sent to Mill', millChallanNo: 'FB895', lotNumber: 'GRAY-2026-001' },
    { srNo: 5, tpNo: '2111', tpMtr: 120.0, status: 'Sent to Mill', millChallanNo: 'FB895', lotNumber: 'GRAY-2026-001' },
    { srNo: 6, tpNo: '2102', tpMtr: 87.0, status: 'Sent to Mill', millChallanNo: 'FB895', lotNumber: 'GRAY-2026-001' },
    { srNo: 7, tpNo: '2071', tpMtr: 120.0, status: 'Sent to Mill', millChallanNo: 'FB895', lotNumber: 'GRAY-2026-001' },
    { srNo: 8, tpNo: '2070', tpMtr: 84.0, status: 'Sent to Mill', millChallanNo: 'FB895', lotNumber: 'GRAY-2026-001' },
    { srNo: 9, tpNo: '2067', tpMtr: 120.0, status: 'Sent to Mill', millChallanNo: 'FB895', lotNumber: 'GRAY-2026-001' },
    { srNo: 10, tpNo: '2078', tpMtr: 120.0, status: 'Sent to Mill', millChallanNo: 'FB895', lotNumber: 'GRAY-2026-001' },
    { srNo: 11, tpNo: '2066', tpMtr: 115.0, status: 'Sent to Mill', millChallanNo: 'FB895', lotNumber: 'GRAY-2026-001' },
    { srNo: 12, tpNo: '2072', tpMtr: 70.0, status: 'Sent to Mill', millChallanNo: 'FB895', lotNumber: 'GRAY-2026-001' },
    { srNo: 13, tpNo: '2058', tpMtr: 110.0, status: 'Sent to Mill', millChallanNo: 'FB895', lotNumber: 'GRAY-2026-001' },
    { srNo: 14, tpNo: '2063', tpMtr: 100.0, status: 'Sent to Mill', millChallanNo: 'FB895', lotNumber: 'GRAY-2026-001' },
    { srNo: 15, tpNo: '2054', tpMtr: 130.0, status: 'Sent to Mill', millChallanNo: 'FB895', lotNumber: 'GRAY-2026-001' },
    { srNo: 16, tpNo: '2115', tpMtr: 99.0, status: 'Sent to Mill', millChallanNo: 'FB895', lotNumber: 'GRAY-2026-001' },
    { srNo: 17, tpNo: '2108', tpMtr: 80.0, status: 'Sent to Mill', millChallanNo: 'FB895', lotNumber: 'GRAY-2026-001' },
    { srNo: 18, tpNo: '2110', tpMtr: 117.0, status: 'Sent to Mill', millChallanNo: 'FB895', lotNumber: 'GRAY-2026-001' },
    { srNo: 19, tpNo: '2105', tpMtr: 90.0, status: 'Sent to Mill', millChallanNo: 'FB895', lotNumber: 'GRAY-2026-001' },
    { srNo: 20, tpNo: '2112', tpMtr: 88.0, status: 'Sent to Mill', millChallanNo: 'FB895', lotNumber: 'GRAY-2026-001' },
    { srNo: 21, tpNo: '2103', tpMtr: 110.0, status: 'Sent to Mill', millChallanNo: 'FB895', lotNumber: 'GRAY-2026-001' },
    { srNo: 22, tpNo: '2100', tpMtr: 104.0, status: 'Sent to Mill', millChallanNo: 'FB895', lotNumber: 'GRAY-2026-001' },
    { srNo: 23, tpNo: '2099', tpMtr: 130.0, status: 'Sent to Mill', millChallanNo: 'FB895', lotNumber: 'GRAY-2026-001' }
  ];

  const millChallan = {
    id: 'FB895',
    challanNo: 'FB895',
    challanDate: '2026-10-28',
    millParty: 'ASHOKA DYEING & PRINTING MILLS PVT.LTD',
    millGst: '24AAHCA0585A1Z7',
    millAddress: '261.B, G.I.D.C, PANDESARA, SURAT, Surat, Gujarat',
    millCity: 'Surat, Gujarat',
    millPhone: '7203828881',
    millContact: '',
    vehicleNo: 'By Hand / Tempo',
    driverName: 'Driver',
    processRequired: 'RFD DYED',
    fabricQuality: 'ARMANI SATIN 60"',
    lotNumber: 'GRAY-2026-001',
    totalTps: 23,
    totalMeters: 2516.0,
    status: 'At Mill',
    tps: tpsData,
    notes: 'Dispatched to Ashoka Dyeing & Printing Mills Pvt.Ltd for RFD DYED processing'
  };

  const millMaster = {
    name: 'ASHOKA DYEING & PRINTING MILLS PVT.LTD',
    gst: '24AAHCA0585A1Z7',
    gstin: '24AAHCA0585A1Z7',
    address: '261.B, G.I.D.C, PANDESARA, SURAT, Surat, Gujarat',
    phone: '7203828881',
    city: 'Surat, Gujarat',
    contactPerson: '',
    broker: '',
    processTypes: 'RFD DYED',
    notes: 'Master Processing Mill'
  };

  const cfg = await PrintConfig.findOne({ companyEntity: 'Yamunaji' });
  const updatedLots = (cfg.grayLots || []).map(lot => {
    if (lot.lotNumber === 'GRAY-2026-001') {
      return {
        ...lot,
        sentToMillMeters: 2516.0,
        status: 'Fully at Mill',
        tps: tpsData
      };
    }
    return lot;
  });

  const updatedDoc = await PrintConfig.findOneAndUpdate(
    { companyEntity: 'Yamunaji' },
    {
      $set: {
        grayLots: updatedLots,
        millChallans: [millChallan],
        mills: [millMaster],
        processes: ['RFD DYED']
      }
    },
    { new: true }
  );

  console.log('Update result:');
  console.log('millChallans length:', updatedDoc.millChallans?.length);
  console.log('mills:', updatedDoc.mills?.map(m => m.name || m));
  console.log('processes:', updatedDoc.processes);
  console.log('GRAY-2026-001 status:', updatedDoc.grayLots?.find(l => l.lotNumber === 'GRAY-2026-001')?.status);

  await mongoose.disconnect();
}
fix().catch(console.error);
