import React, { useState } from 'react';
import { Rnd } from 'react-rnd';
import { resolveTokens, getNestedValue } from '../../utils/tokenResolver';
import DynamicTableElement from './DynamicTableElement';

export default function A4Canvas({
  template,
  selectedElementId,
  onSelectElement,
  onUpdateElementPosition,
  isPreview = false,
  zoom = 1,
  dataContext = {}
}) {
  const {
    pageSize = 'A4',
    orientation = 'portrait',
    margins = { top: 20, bottom: 20, left: 20, right: 20 },
    watermark = {},
    stamp = {},
    elements = []
  } = template;

  const isLandscape = orientation === 'landscape';

  // Calculate canvas dimensions based on preset
  let baseWidth = 595;
  let baseHeight = 842;
  if (pageSize === 'A5') {
    baseWidth = 420;
    baseHeight = 595;
  } else if (pageSize === '4x6') {
    baseWidth = 288;
    baseHeight = 432;
  } else if (pageSize === '3x2') {
    baseWidth = 216;
    baseHeight = 144;
  }

  const canvasWidth = isLandscape ? baseHeight : baseWidth;
  const canvasHeight = isLandscape ? baseWidth : baseHeight;

  // Magnetic Snap Guide Lines (X and Y coordinates)
  const [guideLines, setGuideLines] = useState({ x: null, y: null });

  const handleCanvasClick = (e) => {
    if (e.target.id === 'a4-sheet-surface' || e.target.id === 'a4-canvas-container') {
      onSelectElement(null);
    }
  };

  const handleDrag = (currentId, d) => {
    const SNAP_THRESHOLD = 5;
    let matchedX = null;
    let matchedY = null;

    const currentEl = elements.find(el => el.id === currentId);
    if (!currentEl) return;

    for (const other of elements) {
      if (other.id === currentId) continue;

      // Check Left / Center / Right alignment
      if (Math.abs(d.x - other.x) <= SNAP_THRESHOLD) matchedX = other.x;
      else if (Math.abs(d.x + currentEl.width / 2 - (other.x + other.width / 2)) <= SNAP_THRESHOLD) {
        matchedX = other.x + other.width / 2;
      } else if (Math.abs(d.x + currentEl.width - (other.x + other.width)) <= SNAP_THRESHOLD) {
        matchedX = other.x + other.width;
      }

      // Check Top / Middle / Bottom alignment
      if (Math.abs(d.y - other.y) <= SNAP_THRESHOLD) matchedY = other.y;
      else if (Math.abs(d.y + currentEl.height / 2 - (other.y + other.height / 2)) <= SNAP_THRESHOLD) {
        matchedY = other.y + other.height / 2;
      } else if (Math.abs(d.y + currentEl.height - (other.y + other.height)) <= SNAP_THRESHOLD) {
        matchedY = other.y + other.height;
      }
    }

    setGuideLines({ x: matchedX, y: matchedY });
  };

  const handleDragStop = (id, d) => {
    setGuideLines({ x: null, y: null });
    onUpdateElementPosition(id, { x: d.x, y: d.y });
  };

  return (
    <div
      id="a4-canvas-container"
      onClick={handleCanvasClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2.5rem',
        minHeight: '100%',
        boxSizing: 'border-box'
      }}
    >
      <div
        id="a4-sheet-surface"
        style={{
          width: `${canvasWidth}px`,
          height: `${canvasHeight}px`,
          transform: `scale(${zoom})`,
          transformOrigin: 'top center',
          backgroundColor: '#ffffff',
          boxShadow: '0 10px 35px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0,0,0,0.06)',
          position: 'relative',
          borderRadius: '2px',
          overflow: 'hidden',
          transition: 'transform 0.15s ease-out',
          userSelect: 'none'
        }}
      >
        {/* Printable Margin Guidelines (Dashed line) */}
        {!isPreview && (
          <div
            style={{
              position: 'absolute',
              top: `${margins.top}px`,
              left: `${margins.left}px`,
              right: `${margins.right}px`,
              bottom: `${margins.bottom}px`,
              border: '1px dashed #e2e8f0',
              pointerEvents: 'none',
              zIndex: 0
            }}
          />
        )}

        {/* Magnetic Snapping Guide Lines */}
        {guideLines.x !== null && (
          <div
            style={{
              position: 'absolute',
              left: `${guideLines.x}px`,
              top: 0,
              bottom: 0,
              width: '1px',
              borderLeft: '1.5px dashed #0284c7',
              pointerEvents: 'none',
              zIndex: 9999
            }}
          />
        )}
        {guideLines.y !== null && (
          <div
            style={{
              position: 'absolute',
              top: `${guideLines.y}px`,
              left: 0,
              right: 0,
              height: '1px',
              borderTop: '1.5px dashed #0284c7',
              pointerEvents: 'none',
              zIndex: 9999
            }}
          />
        )}

        {/* Diagonal Watermark Overlay */}
        {watermark && watermark.enabled && watermark.text && (
          <div
            style={{
              position: 'absolute',
              top: '40%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-35deg)',
              fontSize: '52px',
              fontWeight: 900,
              color: `rgba(15, 23, 42, ${watermark.opacity || 0.08})`,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              zIndex: 0,
              userSelect: 'none'
            }}
          >
            {watermark.text}
          </div>
        )}

        {/* Statutory Rubber Stamp Badge */}
        {stamp && stamp.enabled && stamp.text && (
          <div
            style={{
              position: 'absolute',
              top: '22px',
              right: '25px',
              transform: 'rotate(-8deg)',
              border: `2.5px dashed ${stamp.color || '#dc2626'}`,
              color: stamp.color || '#dc2626',
              padding: '4px 14px',
              fontSize: '11px',
              fontWeight: 900,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              borderRadius: '4px',
              zIndex: 998,
              opacity: 0.9,
              pointerEvents: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            }}
          >
            {stamp.text}
          </div>
        )}

        {/* Render Canvas Elements */}
        {elements.map((el) => {
          const isSelected = selectedElementId === el.id;
          const { type, x, y, width, height, content, fieldBinding, style = {} } = el;

          // Hydrated text content for live preview
          let displayContent = content;
          if (fieldBinding) {
            const boundVal = getNestedValue(dataContext, fieldBinding);
            displayContent = boundVal !== '' ? String(boundVal) : content;
          }
          if (isPreview) {
            displayContent = resolveTokens(displayContent, dataContext);
          }

          const renderedElementContent = () => {
            if (type === 'divider') {
              return (
                <div
                  style={{
                    width: '100%',
                    height: 0,
                    borderTop: `${style.borderWidth || 1}px ${style.borderStyle || 'solid'} ${style.borderColor || '#cbd5e1'}`
                  }}
                />
              );
            }

            if (type === 'rect') {
              return (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: style.backgroundColor || 'transparent',
                    border: style.borderWidth ? `${style.borderWidth}px ${style.borderStyle || 'solid'} ${style.borderColor || '#cbd5e1'}` : 'none',
                    borderRadius: `${style.borderRadius || 0}px`
                  }}
                />
              );
            }

            if (type === 'image') {
              const src = content || getNestedValue(dataContext, fieldBinding);
              return (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: style.backgroundColor || 'transparent'
                  }}
                >
                  {src ? (
                    <img
                      src={src}
                      alt="Logo"
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>[Company Logo]</span>
                  )}
                </div>
              );
            }

            if (type === 'qr_code') {
              return (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: style.backgroundColor || '#ffffff',
                    border: style.borderWidth ? `${style.borderWidth}px solid ${style.borderColor || '#e2e8f0'}` : 'none',
                    borderRadius: `${style.borderRadius || 6}px`,
                    padding: `${style.padding || 2}px`
                  }}
                >
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(content || 'https://eliteedition.in')}`}
                    alt="QR"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
              );
            }

            if (type === 'dynamic_table') {
              return (
                <DynamicTableElement
                  element={el}
                  dataContext={dataContext}
                  isPreview={isPreview}
                />
              );
            }

            // Standard or Dynamic Text
            return (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  fontSize: `${style.fontSize || 12}px`,
                  fontWeight: style.fontWeight || 'normal',
                  fontStyle: style.fontStyle || 'normal',
                  textAlign: style.textAlign || 'left',
                  color: style.color || '#0f172a',
                  backgroundColor: style.backgroundColor || 'transparent',
                  border: style.borderWidth ? `${style.borderWidth}px ${style.borderStyle || 'solid'} ${style.borderColor || '#cbd5e1'}` : 'none',
                  borderRadius: `${style.borderRadius || 0}px`,
                  padding: `${style.padding || 0}px`,
                  boxSizing: 'border-box',
                  letterSpacing: style.letterSpacing || 'normal',
                  lineHeight: style.lineHeight || 1.3,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflow: 'hidden'
                }}
              >
                {displayContent || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Double click to edit</span>}
              </div>
            );
          };

          if (isPreview) {
            return (
              <div
                key={el.id}
                style={{
                  position: 'absolute',
                  left: `${x}px`,
                  top: `${y}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                  zIndex: style.zIndex || 1
                }}
              >
                {renderedElementContent()}
              </div>
            );
          }

          return (
            <Rnd
              key={el.id}
              size={{ width, height }}
              position={{ x, y }}
              bounds="parent"
              scale={zoom}
              grid={[2, 2]}
              onDragStart={() => onSelectElement(el.id)}
              onDrag={(e, d) => handleDrag(el.id, d)}
              onDragStop={(e, d) => handleDragStop(el.id, d)}
              onResizeStart={() => onSelectElement(el.id)}
              onResizeStop={(e, direction, ref, delta, position) => {
                onUpdateElementPosition(el.id, {
                  width: parseInt(ref.style.width, 10),
                  height: parseInt(ref.style.height, 10),
                  ...position
                });
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectElement(el.id);
              }}
              style={{
                zIndex: isSelected ? 999 : (style.zIndex || 1),
                border: isSelected ? '1.5px solid #0284c7' : '1px dashed transparent',
                cursor: 'move',
                boxSizing: 'border-box',
                transition: 'border-color 0.1s'
              }}
              resizeHandleStyles={{
                topLeft: { width: 7, height: 7, backgroundColor: '#0284c7', borderRadius: '50%' },
                topRight: { width: 7, height: 7, backgroundColor: '#0284c7', borderRadius: '50%' },
                bottomLeft: { width: 7, height: 7, backgroundColor: '#0284c7', borderRadius: '50%' },
                bottomRight: { width: 7, height: 7, backgroundColor: '#0284c7', borderRadius: '50%' }
              }}
            >
              {renderedElementContent()}
            </Rnd>
          );
        })}
      </div>
    </div>
  );
}
