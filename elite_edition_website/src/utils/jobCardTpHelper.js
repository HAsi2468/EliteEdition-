/**
 * Helper to compute the 5-column TP Meter & Wastage grid for Job Cards.
 * 
 * Rules:
 * 1. Sequentially maps each roll's tpMeter from linked Fabric Challans into slots 1) through 23).
 * 2. Slot row 5 Col 4-5 is TOTAL :- with the sum of TP meters.
 * 3. T.P. Westage column displays roll wastage meters and job card faults:
 *    - 1) to 3) show roll wastage meters (or FF/PF/FS/GF/CW)
 *    - 4) shows fault/wastage
 *    - TOT: shows total wastage
 */

export function buildTpAndWasteGrid(challans = [], card = {}) {
  const chList = Array.isArray(challans) ? challans : [];
  const allTpMtrs = [];
  const allWestMtrs = [];

  for (const ch of chList) {
    const details = Array.isArray(ch.tpDetails) ? ch.tpDetails : [];
    for (const tp of details) {
      const mtr = parseFloat(tp.tpMeter);
      if (!isNaN(mtr) && mtr > 0) {
        allTpMtrs.push(String(Number(mtr.toFixed(2))));
      }
      const w = parseFloat(tp.westMtr);
      if (!isNaN(w) && w > 0) {
        allWestMtrs.push(String(Number(w.toFixed(2))));
      }
    }
  }

  // Column capacities: Col 0: 5, Col 1: 5, Col 2: 5, Col 3: 4, Col 4: 4 (Total 23 TP slots)
  const colCapacities = [5, 5, 5, 4, 4];
  const colLabels = [
    ['1)', '2)', '3)', '4)', '5)'],
    ['6)', '7)', '8)', '9)', '10)'],
    ['11)', '12)', '13)', '14)', '15)'],
    ['16)', '17)', '18)', '19)'],
    ['20)', '21)', '22)', '23)']
  ];

  const cols = [[], [], [], [], []];
  let ptr = 0;
  for (let c = 0; c < 5; c++) {
    for (let r = 0; r < colCapacities[c]; r++) {
      cols[c].push(ptr < allTpMtrs.length ? allTpMtrs[ptr++] : '');
    }
  }

  // Wastage items (roll-wise westMtr first, then faults from job card)
  const wItems = [...allWestMtrs];
  const ff = parseFloat(card.fabricFaultMtr) || 0;
  const pf = parseFloat(card.printFaultMtr) || 0;
  const fs = parseFloat(card.fusingFaultMtr) || 0;
  const gf = parseFloat(card.genuineFaultMtr) || 0;
  let cw = 0;
  chList.forEach(ch => {
    cw += (parseFloat(ch.proportionalWasteMtr) || 0);
  });

  if (ff > 0) wItems.push(`FF:${ff}`);
  if (pf > 0) wItems.push(`PF:${pf}`);
  if (fs > 0) wItems.push(`FS:${fs}`);
  if (gf > 0) wItems.push(`GF:${gf}`);
  if (cw > 0) wItems.push(`CW:${Number(cw.toFixed(2))}`);

  const totalW = parseFloat(card.totalWastageMtr) || (
    allWestMtrs.reduce((s, w) => s + parseFloat(w), 0) + ff + pf + fs + gf + cw
  );

  const wSlots = [
    wItems[0] || '',
    wItems[1] || '',
    wItems[2] || '',
    wItems[3] || ''
  ];
  const wTotalLbl = totalW > 0 ? 'TOT:' : '';
  const wTotalVal = totalW > 0 ? String(Number(totalW.toFixed(2))) : (wItems[4] || '');

  const sumMtr = allTpMtrs.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
  const finalTotalMtr = sumMtr > 0
    ? String(Number(sumMtr.toFixed(2)))
    : (card.printMtr || card.totalMtr || '');

  function makeCell(lbl, val, isHeader = false) {
    return {
      lbl,
      val,
      isHeader,
      data: { val, isHeader },
      0: lbl,
      1: val,
      2: isHeader
    };
  }

  function makeWCell(wLbl, wVal) {
    return {
      wLbl,
      wVal,
      data: { val: wVal, isHeader: false },
      0: wLbl,
      1: wVal,
      2: false
    };
  }

  // 5 rows of grid (each row has 6 cells: 5 TP columns + 1 Wastage column)
  const rows = [];
  for (let r = 0; r < 5; r++) {
    const row = [];
    for (let c = 0; c < 5; c++) {
      if (r === 4 && c === 3) {
        row.push(makeCell('TOTAL :-', ''));
      } else if (r === 4 && c === 4) {
        row.push(makeCell('', finalTotalMtr));
      } else {
        row.push(makeCell(colLabels[c][r], cols[c][r]));
      }
    }
    const wLbl = r === 4 ? wTotalLbl : (r < 3 ? `${r + 1})` : '');
    const wVal = r === 4 ? wTotalVal : wSlots[r];
    row.push(makeWCell(wLbl, wVal));
    rows.push(row);
  }

  const challanNosStr = chList.map(c => `EDP-${c.challanNo}`).join(', ');

  return {
    rows,
    totalMtr: finalTotalMtr,
    challanNosStr,
    totalW: totalW > 0 ? Number(totalW.toFixed(2)) : 0
  };
}
