import React, { useState } from 'react';
import { api } from '../services/api';
import { FileText, Download, Loader2, BarChart2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function ReportPanel() {
  const [downloading, setDownloading] = useState({
    value: false,
    inward: false,
    outward: false,
  });
  const [error, setError] = useState('');

  const triggerDownload = async (type, path, fileName) => {
    setDownloading(prev => ({ ...prev, [type]: true }));
    setError('');
    
    try {
      await api.downloadReport(path, fileName);
      toast.success(`${fileName} downloaded successfully!`);
    } catch (err) {
      const msg = `Failed to download ${fileName}: ${err.message || 'Server error'}`;
      setError(msg);
      toast.error(msg);
    } finally {
      setDownloading(prev => ({ ...prev, [type]: false }));
    }
  };

  const reports = [
    {
      id: 'value',
      title: 'Stock Value',
      description: 'Calculates the current monetary value of all stock on hand across all SKUs, based on both Purchase and Sale prices.',
      path: 'inventory/report/stock-value',
      fileName: 'Stock_Value_Report.pdf',
    },
    {
      id: 'inward',
      title: 'Inward Report',
      description: 'Shows all inventory added to the system, including vendor details, received quantities, and total purchase value.',
      path: 'inventory/report/stock-inward',
      fileName: 'Stock_Inward_Report.pdf',
    },
    {
      id: 'outward',
      title: 'Outward Report',
      description: 'Summarizes all items scanned out of stock, including customer/client details and out-flow quantities.',
      path: 'inventory/report/stock-outward',
      fileName: 'Stock_Outward_Report.pdf',
    },
    {
      id: 'returns',
      title: 'Returns Report',
      description: 'Log of all processed returns including RTO and Customer Returns, their condition, and statuses.',
      path: 'inventory/report/returns',
      fileName: 'Returns_Log_Report.pdf',
    },
    {
      id: 'production',
      title: 'Machine Production',
      description: 'Activity log of printed and fused jobs from Job Cards, detailing total meters produced per machine.',
      path: 'inventory/report/machine-production',
      fileName: 'Machine_Production_Report.pdf',
    },
    {
      id: 'sales',
      title: 'Sales Report',
      description: 'Comprehensive summary of sales across all models/designs, calculating net revenue and quantity.',
      path: 'sales/export',
      fileName: 'Sales_Report.pdf',
    },
    {
      id: 'brand',
      title: 'Brand Sales Report',
      description: 'Sales performance summarized by brand/party names, showing which brands are performing best.',
      path: 'sales/export?type=brand',
      fileName: 'Brand_Sales_Report.pdf',
    },
  ];

  return (
    <div style={styles.container}>
      <div className="glass-panel" style={styles.panel}>
        <div style={styles.header}>
          <BarChart2 size={22} color="var(--primary)" />
          <h3 style={styles.title}>Inventory Reports</h3>
        </div>
        <p style={styles.subtitle}>
          Generate and download real-time inventory PDF reports directly from the database server.
        </p>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.reportsGrid}>
          {reports.map((report) => {
            const isDownloading = downloading[report.id];
            return (
              <div key={report.id} style={styles.reportCard}>
                <div style={styles.reportIcon}>
                  <FileText size={20} color="#e5e7eb" />
                </div>
                <div style={styles.reportDetails}>
                  <h4 style={styles.reportTitle}>{report.title}</h4>
                  <p style={styles.reportDesc}>{report.description}</p>
                </div>
                <button
                  onClick={() => triggerDownload(report.id, report.path, report.fileName)}
                  disabled={isDownloading}
                  className={isDownloading ? 'btn-secondary' : 'btn-primary'}
                  style={styles.downloadBtn}
                >
                  {isDownloading ? (
                    <>
                      <Loader2 size={16} className="spin-loader" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      Download
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
  },
  panel: {
    padding: '1.5rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    marginBottom: '0.5rem',
  },
  title: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    marginBottom: '1.5rem',
  },
  reportsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  reportCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-sm)',
    transition: 'all var(--transition-fast)',
  },
  reportIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-light)',
    flexShrink: 0,
  },
  reportDetails: {
    flex: 1,
  },
  reportTitle: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '0.2rem',
  },
  reportDesc: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    lineHeight: '1.4',
  },
  downloadBtn: {
    padding: '0.5rem 1rem',
    fontSize: '0.8rem',
    flexShrink: 0,
  },
  error: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.75rem',
    color: '#fca5a5',
    fontSize: '0.8rem',
    marginBottom: '1rem',
  },
};

// Inject CSS styling for spinning loaders
const styleEl = document.createElement('style');
styleEl.innerHTML = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .spin-loader {
    animation: spin 1s linear infinite;
  }
  @media (max-width: 640px) {
    div[style*="display: flex; align-items: center; gap: 1rem; padding: 1rem;"] {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.8rem;
    }
    button[style*="flex-shrink: 0"] {
      width: 100%;
      justify-content: center;
    }
  }
`;
document.head.appendChild(styleEl);
