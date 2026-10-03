import React from 'react';

/**
 * Enterprise Job-Stage Progress Bar
 * Dynamically detects production stage from card status:
 * - Digital Print pipeline: Design -> Print -> Finish (Fusing) -> Dispatch
 * - Stitching Garment pipeline: Design -> Print -> Finish -> Stitch -> Pack -> Dispatch
 */

const DEFAULT_PRINT_STAGES = ['Design', 'Print', 'Finish', 'Dispatch'];
const DEFAULT_STITCHING_STAGES = ['Design', 'Print', 'Finish', 'Stitch', 'Pack', 'Dispatch'];

export function detectCardStages(card, department) {
  const dept = String(department || card?.department || '').toLowerCase();
  const cat = String(card?.category || '').toLowerCase();
  const isStitching = dept.includes('stitch') || cat.includes('stitch') || cat.includes('garment') || Number(card?.total_stitching_cost || 0) > 0;
  return isStitching ? DEFAULT_STITCHING_STAGES : DEFAULT_PRINT_STAGES;
}

export function calculateJobCardStage(card, stages) {
  if (!card) {
    return { activeIndex: 0, completedIndices: [], isFullyDone: false };
  }

  const pStatus = String(card.printStatus || '').toLowerCase();
  const printMtr = parseFloat(card.printMtr || 0);
  const isPrintDone = pStatus.includes('done') || printMtr > 0;
  const isPrintInProgress = pStatus.includes('progress') || pStatus.includes('partial');

  const fStatus = String(card.fusingStatus || '').toLowerCase();
  const fusedMtr = parseFloat(card.fusingMtr || card.freshMtr || 0);
  const isFusingDone = fStatus.includes('done') || fusedMtr > 0;
  const isFusingInProgress = fStatus.includes('progress') || fStatus.includes('partial');

  const sStatus = String(card.stitchingStatus || card.stitchStatus || '').toLowerCase();
  const stitchedPcs = parseFloat(card.stitchedPcs || card.stitchingPcs || 0);
  const isStitchDone = sStatus.includes('done') || stitchedPcs > 0;
  const isStitchInProgress = sStatus.includes('progress');

  const packStatus = String(card.packingStatus || card.packStatus || '').toLowerCase();
  const packedPcs = parseFloat(card.packedPcs || 0);
  const isPackDone = packStatus.includes('done') || packedPcs > 0;
  const isPackInProgress = packStatus.includes('progress');

  const dStatus = String(card.deliveryStatus || '').toLowerCase();
  const deliveredMtr = parseFloat(card.deliveredMtr || 0);
  const totalMtr = parseFloat(card.totalMtr || card.totalQty || 0);
  const isDispatched = dStatus.includes('done') || dStatus.includes('delivered') || (totalMtr > 0 && deliveredMtr >= totalMtr) || String(card.status || '').toLowerCase() === 'done';
  const isDispatchInProgress = dStatus.includes('dispatch') || dStatus.includes('progress') || (deliveredMtr > 0 && !isDispatched);

  const hasStitching = stages.includes('Stitch');
  const hasPacking = stages.includes('Pack');
  const dispatchIndex = stages.length - 1;

  // 1. Entire job card is delivered / dispatched
  if (isDispatched) {
    return {
      activeIndex: dispatchIndex,
      completedIndices: stages.map((_, i) => i),
      isFullyDone: true
    };
  }

  // 2. Dispatch / Delivery is active or goods are ready for delivery challan
  if (isDispatchInProgress || (hasPacking ? isPackDone : (hasStitching ? isStitchDone : isFusingDone))) {
    const completed = [];
    for (let i = 0; i < dispatchIndex; i++) completed.push(i);
    return {
      activeIndex: dispatchIndex,
      completedIndices: completed,
      isFullyDone: false
    };
  }

  // 3. Packing stage (for stitching garment pipeline)
  if (hasPacking && (isPackInProgress || isStitchDone)) {
    const packIdx = stages.indexOf('Pack');
    const completed = [];
    for (let i = 0; i < packIdx; i++) completed.push(i);
    return {
      activeIndex: packIdx,
      completedIndices: completed,
      isFullyDone: false
    };
  }

  // 4. Stitching stage (for stitching garment pipeline)
  if (hasStitching && (isStitchInProgress || isFusingDone)) {
    const stitchIdx = stages.indexOf('Stitch');
    const completed = [];
    for (let i = 0; i < stitchIdx; i++) completed.push(i);
    return {
      activeIndex: stitchIdx,
      completedIndices: completed,
      isFullyDone: false
    };
  }

  // 5. Finishing / Fusing stage
  if (isFusingInProgress || isPrintDone) {
    const finishIdx = stages.indexOf('Finish') !== -1 ? stages.indexOf('Finish') : 2;
    const completed = [];
    for (let i = 0; i < finishIdx; i++) completed.push(i);
    return {
      activeIndex: finishIdx,
      completedIndices: completed,
      isFullyDone: false
    };
  }

  // 6. Printing stage (print in progress or newly confirmed card queued for print)
  const printIdx = stages.indexOf('Print') !== -1 ? stages.indexOf('Print') : 1;
  const isDraft = String(card.status || '').toLowerCase() === 'draft';
  if (isDraft) {
    return {
      activeIndex: 0,
      completedIndices: [],
      isFullyDone: false
    };
  }

  // A confirmed job card has completed Design and is active in Printing queue
  return {
    activeIndex: printIdx,
    completedIndices: [0], // Design is done!
    isFullyDone: false
  };
}

export function JobStageProgressBar({ currentStage, card, department, stages: customStages, style = {} }) {
  // Determine appropriate stages
  const stages = customStages || (card ? detectCardStages(card, department) : (department ? detectCardStages(null, department) : DEFAULT_PRINT_STAGES));

  let activeIndex = 0;
  let completedIndices = [];
  let isFullyDone = false;

  if (card) {
    const info = calculateJobCardStage(card, stages);
    activeIndex = info.activeIndex;
    completedIndices = info.completedIndices;
    isFullyDone = info.isFullyDone;
  } else if (currentStage) {
    const norm = String(currentStage || '').toLowerCase().trim();
    if (norm.includes('dispatch') || norm.includes('deliver') || norm === 'done') {
      activeIndex = stages.length - 1;
      completedIndices = stages.map((_, i) => i);
      isFullyDone = true;
    } else if (norm.includes('pack')) {
      const idx = stages.indexOf('Pack');
      activeIndex = idx !== -1 ? idx : stages.length - 2;
      for (let i = 0; i < activeIndex; i++) completedIndices.push(i);
    } else if (norm.includes('stitch')) {
      const idx = stages.indexOf('Stitch');
      activeIndex = idx !== -1 ? idx : 3;
      for (let i = 0; i < activeIndex; i++) completedIndices.push(i);
    } else if (norm.includes('finish') || norm.includes('fusing')) {
      const idx = stages.indexOf('Finish');
      activeIndex = idx !== -1 ? idx : 2;
      for (let i = 0; i < activeIndex; i++) completedIndices.push(i);
    } else if (norm.includes('print')) {
      const idx = stages.indexOf('Print');
      activeIndex = idx !== -1 ? idx : 1;
      completedIndices = [0];
    } else {
      activeIndex = 0;
      completedIndices = [];
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        width: '100%',
        ...style
      }}
    >
      {/* Segmented Progress Line */}
      <div style={{ display: 'flex', gap: '3px', width: '100%', height: '3.5px' }}>
        {stages.map((label, i) => {
          const isCompleted = isFullyDone || completedIndices.includes(i);
          const isCurrent = !isFullyDone && i === activeIndex;
          const color = isCompleted ? '#10b981' : isCurrent ? '#2563eb' : '#e2e8f0';

          return (
            <div
              key={label}
              title={`${label}: ${isCompleted ? 'Completed' : isCurrent ? 'Active Stage' : 'Pending'}`}
              style={{
                flex: 1,
                height: '100%',
                backgroundColor: color,
                borderRadius: '2px',
                transition: 'background-color 0.2s ease'
              }}
            />
          );
        })}
      </div>

      {/* Stage Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        {stages.map((label, i) => {
          const isCompleted = isFullyDone || completedIndices.includes(i);
          const isCurrent = !isFullyDone && i === activeIndex;
          const color = isCurrent ? '#1d4ed8' : isCompleted ? '#059669' : '#94a3b8';
          const fontWeight = isCurrent ? 800 : isCompleted ? 700 : 500;

          return (
            <span
              key={label}
              title={`${label}: ${isCompleted ? 'Completed' : isCurrent ? 'Active' : 'Pending'}`}
              style={{
                fontSize: '9.5px',
                color,
                fontWeight,
                textAlign: i === 0 ? 'left' : i === stages.length - 1 ? 'right' : 'center',
                flex: 1,
                letterSpacing: '-0.01em',
                transition: 'color 0.2s ease'
              }}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default JobStageProgressBar;
