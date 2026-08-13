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
    deliveryStatus:   { type: String, default: 'Delivery Pending', enum: ['Delivery Pending', 'Delivery Done'] },
    deliveryDate:     { type: String, default: '' },
    billNo:           { type: String, default: '', trim: true },
    status:           { type: String, default: 'Pending', enum: ['Pending', 'In Progress', 'Done'] },

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

const JobCard = mongoose.model('JobCard', jobCardSchema);
module.exports = JobCard;
