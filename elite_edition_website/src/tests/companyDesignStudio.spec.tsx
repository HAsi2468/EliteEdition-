// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CompanyDesignStudio from '../components/CompanyDesignStudio';

describe('Company Challan & Report Design Studio', () => {
  afterEach(() => {
    cleanup();
  });
  const mockCompanyForm = {
    companyName: 'ELITE DIGITAL PRINTS',
    companyGstin: '24AAAFE1234F1Z5',
    companyAddress: 'Plot B/37, Punagam Road, Surat',
    companyPhone: '+91 98790 00000',
    companyEmail: 'info@elitedigitalprints.com',
    companyBankName: 'HDFC Bank',
    companyAccountNo: '50200012345678',
    companyIfscCode: 'HDFC0001234'
  };

  const mockChallanDesign = {
    title: 'DELIVERY CHALLAN',
    prefix: 'EDP/DC/',
    startingNo: 101,
    paperSize: 'A4',
    orientation: 'portrait',
    copies: ['Original for Consignee', 'Duplicate for Transporter'],
    showLogo: true,
    showGstin: true,
    showPhoneEmail: true,
    showBankDetails: true,
    showDesignImage: true,
    showHsnCode: true,
    showRateAndAmount: true,
    showRemarks: true,
    signatureLeft: "Receiver's Signature",
    signatureCenter: "Inspection Passed",
    signatureRight: "Authorized Signatory",
    termsAndConditions: 'Goods once delivered will not be taken back.',
    footerNote: 'This is a computer generated delivery challan.'
  };

  const mockReportDesign = {
    themeColor: '#0284c7',
    paperSize: 'A4',
    orientation: 'landscape',
    density: 'compact',
    showLogo: true,
    showKpiSummary: true,
    showGeneratedBy: true,
    showTimestamp: true,
    watermarkText: 'CONFIDENTIAL',
    footerDisclaimer: 'Confidential ERP Report - Internal Only.'
  };

  it('renders Challan Design controls and real-time live preview paper', () => {
    render(
      <CompanyDesignStudio
        companyEntity="Elite Digital Print"
        accentColor="#0284c7"
        companyForm={mockCompanyForm}
        challanDesign={mockChallanDesign}
        reportDesign={mockReportDesign}
      />
    );

    // Header & branding
    expect(screen.getByText(/Elite Digital Print — Challan & Report Design Studio/i)).toBeTruthy();
    
    // Live preview elements
    expect(screen.getByText('DELIVERY CHALLAN')).toBeTruthy();
    expect(screen.getByText(/EDP\/DC\/0101/i)).toBeTruthy();
    expect(screen.getByText('ELITE DIGITAL PRINTS')).toBeTruthy();
    expect(screen.getByText(/Plot B\/37, Punagam Road, Surat/i)).toBeTruthy();
    expect(screen.getByText('Inspection Passed')).toBeTruthy();
    expect(screen.getAllByText('Goods once delivered will not be taken back.').length).toBeGreaterThanOrEqual(2);
  });

  it('switches between Challan Design and Report Template sub-tabs', () => {
    render(
      <CompanyDesignStudio
        companyEntity="Elite Digital Print"
        accentColor="#0284c7"
        companyForm={mockCompanyForm}
        challanDesign={mockChallanDesign}
        reportDesign={mockReportDesign}
      />
    );

    const reportTabBtn = screen.getByRole('button', { name: /Report Template/i });
    fireEvent.click(reportTabBtn);

    // Report specific elements should be visible
    expect(screen.getByText(/Report Theme Color & Branding/i)).toBeTruthy();
    expect(screen.getByText(/Operations & Production Analytics Summary/i)).toBeTruthy();
    expect(screen.getByText('CONFIDENTIAL')).toBeTruthy();
    expect(screen.getByText('Confidential ERP Report - Internal Only.')).toBeTruthy();
  });

  it('invokes onChangeChallan when editing challan parameters', () => {
    const onChangeChallan = vi.fn();
    render(
      <CompanyDesignStudio
        companyEntity="Elite Digital Print"
        accentColor="#0284c7"
        companyForm={mockCompanyForm}
        challanDesign={mockChallanDesign}
        reportDesign={mockReportDesign}
        onChangeChallan={onChangeChallan}
      />
    );

    const titleInput = screen.getByPlaceholderText(/DELIVERY CHALLAN \/ JOB WORK CHALLAN/i);
    fireEvent.change(titleInput, { target: { value: 'JOB WORK DISPATCH' } });
    expect(onChangeChallan).toHaveBeenCalledWith('title', 'JOB WORK DISPATCH');
  });

  it('invokes onChangeReport when editing report parameters', () => {
    const onChangeReport = vi.fn();
    render(
      <CompanyDesignStudio
        companyEntity="Elite Digital Print"
        accentColor="#0284c7"
        companyForm={mockCompanyForm}
        challanDesign={mockChallanDesign}
        reportDesign={mockReportDesign}
        onChangeReport={onChangeReport}
      />
    );

    const reportTabBtn = screen.getByRole('button', { name: /Report Template/i });
    fireEvent.click(reportTabBtn);

    const watermarkInput = screen.getByPlaceholderText(/CONFIDENTIAL \/ DRAFT/i);
    fireEvent.change(watermarkInput, { target: { value: 'OFFICIAL COPY' } });
    expect(onChangeReport).toHaveBeenCalledWith('watermarkText', 'OFFICIAL COPY');
  });

  it('triggers onSave when clicking the save button', () => {
    const onSave = vi.fn();
    render(
      <CompanyDesignStudio
        companyEntity="Elite Digital Print"
        accentColor="#0284c7"
        companyForm={mockCompanyForm}
        challanDesign={mockChallanDesign}
        reportDesign={mockReportDesign}
        onSave={onSave}
      />
    );

    const saveBtn = screen.getByRole('button', { name: /Save Elite Digital Print Design Settings/i });
    fireEvent.click(saveBtn);
    expect(onSave).toHaveBeenCalled();
  });
});
