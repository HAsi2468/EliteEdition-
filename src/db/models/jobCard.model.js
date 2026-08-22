const mongoose = require('mongoose');

const jobCardSchema = new mongoose.Schema(
  {
    jobNo:            { type: String, required: true, unique: true, trim: true },
    designNo:         { type: String, default: '', trim: true },
    designName:       { type: String, default: '', trim: true },
    category:         { type: String, default: '', trim: true },
    department:       { type: String, default: 'digital_print', trim: true },
    fabric:           { type: String, default: '', trim: true },
    pcs:              { type: String, default: '', trim: true },
    top:              { type: String, default: '', trim: true },
    sleeve:           { type: String, default: '', trim: true },
    colors:           { type: String, default: '', trim: true },
    panna:            { type: String, default: '', trim: true },
    consumption:      { type: String, default: '', trim: true },
    bottom:           { type: String, default: '', trim: true },
    dupatta:          { type: String, default: '', trim: true },
    cut:              { type: String, default: '', trim: true },
    date:             { type: String, default: '', trim: true },
    pass:             { type: String, default: '', trim: true },
    allover:          { type: String, default: '', trim: true },
    pnKm:             { type: String, default: '', trim: true },
    setCopy:          { type: String, default: '', trim: true },
    totalMtr:         { type: String, default: '', trim: true },
    party:            { type: String, default: '', trim: true },
    expTime:          { type: String, default: '' },
    designer:         { type: String, default: '', trim: true },
    colourMatching:   { type: String, default: '', trim: true },
    paperType:        { type: String, default: '', trim: true },
    temperature:      { type: String, default: '', trim: true },
    speed:            { type: String, default: '', trim: true },
    profile:          { type: String, default: '', trim: true },
    billTo:           { type: String, default: '', trim: true },
    shipTo:           { type: String, default: '', trim: true },
    machineName:      { type: String, default: '', trim: true },
    note1:            { type: String, default: '', trim: true },
    note2:            { type: String, default: '', trim: true },
    emergencyNotes:   { type: String, default: '', trim: true },
    imageUrl1:        { type: String, default: '', trim: true },
    imageUrl2:        { type: String, default: '', trim: true },
    printStatus:      { type: String, default: 'Printing Pending', enum: ['Printing Pending', 'Printing Done'] },
    printDate:        { type: String, default: '' },
    printMtr:         { type: String, default: '', trim: true },
    fusingStatus:     { type: String, default: 'Fusing Pending', enum: ['Fusing Pending', 'Fusing Done'] },
    fusingDate:       { type: String, default: '' },
    fusingMtr:        { type: String, default: '', trim: true },
    freshMtr:         { type: String, default: '', trim: true },
    fabricFaultMtr:   { type: String, default: '', trim: true },
    fusingFaultMtr:   { type: String, default: '', trim: true },
    printFaultMtr:    { type: String, default: '', trim: true },
    genuineFaultMtr:  { type: String, default: '', trim: true },
    totalWastageMtr:  { type: String, default: '', trim: true },
    fusingSpeed:      { type: String, default: '', trim: true },
    fusingMachine:    { type: String, default: '', trim: true },
    fusingOperator:   { type: String, default: '', trim: true },
    butterPaperWeightKg: { type: String, default: '', trim: true },
    shift:            { type: String, default: '', trim: true },
    deliveryStatus:   { type: String, default: 'Delivery Pending', enum: ['Delivery Pending', 'Delivery Done'] },
    deliveryDate:     { type: String, default: '' },
    status:           { type: String, default: 'Pending', enum: ['Pending', 'In Progress', 'Done'] },

    // ── QA & Quality Checking Fields ──
    qaStatus:           { type: String, default: 'QA Pending', enum: ['QA Pending', 'QA Passed', 'QA Rejected'] },
    qaDate:             { type: String, default: '', trim: true },
    qaInspector:        { type: String, default: '', trim: true },
    qaNotes:            { type: String, default: '', trim: true },
    totalFabricUsedMtr: { type: String, default: '', trim: true },

    // ── Module 1 Enhancements: Print Specifications & Dynamic Costing ──
    operatorName:     { type: String, default: '', trim: true },
    productionStage:  {
      type: String,
      enum: ['Order Received', 'File Ready/Proofing', 'Printing', 'Heat Press/Finishing', 'Quality Check', 'Ready for Dispatch'],
      default: 'Order Received'
    },
    printSpecifications: {
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
      dimensionsUnit: { type: String, enum: ['inch', 'ft'], default: 'inch' },
      totalSqFt: { type: Number, default: 0 },
      totalSqMtr: { type: Number, default: 0 },
      materialType: { type: String, default: 'Sublimation' },
      resolutionPass: { type: String, default: '4 Pass' },
      wastageFactorPct: { type: Number, default: 5 },
      unitPricePerSqFt: { type: Number, default: 0 },
      totalCalculatedCost: { type: Number, default: 0 }
    },
    proofing: {
      artworkUrl: { type: String, default: '' },
      artworkFileName: { type: String, default: '' },
      approvalStatus: { type: String, enum: ['Pending', 'Approved', 'Revision Requested'], default: 'Pending' },
      clientFeedback: { type: String, default: '' },
      approvedAt: { type: Date }
    },
    createdBy:        { type: String, default: 'Admin', trim: true },
    createdByName:    { type: String, default: '', trim: true },
    updatedBy:        { type: String, default: '', trim: true },
    updatedByName:    { type: String, default: '', trim: true },
    auditTrail: [
      {
        performedBy: { type: String, default: '' },
        performedByName: { type: String, default: '' },
        performedById: { type: String, default: '' },
        action: { type: String, default: 'UPDATE' },
        timestamp: { type: Date, default: Date.now },
        details: { type: String, default: '' },
        changesSummary: { type: String, default: '' }
      }
    ],
    orderChatRoomId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom' }
  },
  {
    timestamps: {
      createdAt: 'created_date_time',
      updatedAt: 'modified_date_time',
    },
    collection: 'jobCards',
  }
);

// ── Indexes for query optimization ──
// Main listing filter + getFabricRequirement
jobCardSchema.index({ status: 1, printStatus: 1, department: 1 });
// Search and departmentReport busiest parties
jobCardSchema.index({ party: 1 });
// getFabricRequirement and departmentReport fabric trends
jobCardSchema.index({ fabric: 1 });
// Default sort order for job card listing
jobCardSchema.index({ created_date_time: -1 });

const JobCard = mongoose.model('JobCard', jobCardSchema);
module.exports = JobCard;
