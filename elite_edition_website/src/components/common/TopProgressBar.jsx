import React, { useEffect, useState, useRef } from 'react';

export function TopProgressBar({ activeTab, selectedCompany }) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timersRef = useRef([]);

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  const triggerBar = () => {
    clearTimers();
    setVisible(true);
    setProgress(0.32);
    timersRef.current.push(setTimeout(() => setProgress(0.78), 70));
    timersRef.current.push(setTimeout(() => setProgress(1), 190));
    timersRef.current.push(setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 360));
  };

  useEffect(() => {
    triggerBar();
    return clearTimers;
  }, [activeTab, selectedCompany]);

  useEffect(() => {
    const onStart = () => {
      clearTimers();
      setVisible(true);
      setProgress(0.35);
      timersRef.current.push(setTimeout(() => setProgress(0.82), 180));
    };
    const onDone = () => {
      clearTimers();
      setProgress(1);
      timersRef.current.push(setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 200));
    };
    window.addEventListener('erp-progress-start', onStart);
    window.addEventListener('erp-progress-done', onDone);
    return () => {
      window.removeEventListener('erp-progress-start', onStart);
      window.removeEventListener('erp-progress-done', onDone);
      clearTimers();
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="erp-top-progress-track" aria-hidden="true">
      <div
        className="erp-top-progress-fill"
        style={{
          transform: `scaleX(${progress})`,
          opacity: progress >= 1 ? 0 : 1,
        }}
      />
    </div>
  );
}

export default TopProgressBar;
