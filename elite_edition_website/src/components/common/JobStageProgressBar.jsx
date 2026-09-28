import React from 'react';

/**
 * Minimal Thin Job-Stage Progress Bar
 * Stages: Design, Print, Finish, Stitch, Pack, Dispatch
 * Text labels with thin indicator line. Zero decorative icons.
 */

const STAGES = ['Design', 'Print', 'Finish', 'Stitch', 'Pack', 'Dispatch'];

export function JobStageProgressBar({ currentStage = 'Design', style = {} }) {
  const normStage = (currentStage || '').toLowerCase().trim();

  // Determine stage index
  let activeIndex = 0;
  if (normStage.includes('print')) activeIndex = 1;
  else if (normStage.includes('finish') || normStage.includes('fusing')) activeIndex = 2;
  else if (normStage.includes('stitch')) activeIndex = 3;
  else if (normStage.includes('pack')) activeIndex = 4;
  else if (normStage.includes('dispatch') || normStage.includes('deliver') || normStage.includes('done')) activeIndex = 5;

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
      {/* Thin Segmented Progress Line */}
      <div style={{ display: 'flex', gap: '3px', width: '100%', height: '3px' }}>
        {STAGES.map((_, i) => {
          const isCompleted = i < activeIndex;
          const isCurrent = i === activeIndex;
          const color = isCompleted ? '#10b981' : isCurrent ? '#0f172a' : '#e2e8f0';

          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: '100%',
                backgroundColor: color,
                borderRadius: '1px'
              }}
            />
          );
        })}
      </div>

      {/* Stage Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        {STAGES.map((label, i) => {
          const isCompleted = i < activeIndex;
          const isCurrent = i === activeIndex;
          const color = isCurrent ? '#0f172a' : isCompleted ? '#10b981' : '#94a3b8';
          const fontWeight = isCurrent ? 600 : 400;

          return (
            <span
              key={label}
              style={{
                fontSize: '10px',
                color,
                fontWeight,
                textAlign: i === 0 ? 'left' : i === STAGES.length - 1 ? 'right' : 'center',
                flex: 1
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
