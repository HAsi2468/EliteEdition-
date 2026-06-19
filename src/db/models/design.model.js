const mongoose = require('mongoose');

const designSchema = new mongoose.Schema(
  {
    designName:     { type: String, required: true, trim: true },  // e.g. ED1, ED2
    designerName:   { type: String, default: '', trim: true },
    colourMatching: { type: String, default: '', trim: true },
    fabricName:     { type: String, default: '', trim: true },
    fusingTemp:     { type: String, default: '', trim: true },
    speed:          { type: String, default: '', trim: true },
    machineProfiles:{ type: Map, of: String, default: {} },
    colors:         { type: String, default: '', trim: true },
    panna:          { type: String, default: '', trim: true },
    pass:           { type: String, default: '', trim: true },
    category:       { type: String, default: '', trim: true },   // e.g. "SUIT", "DUPATTA"
    imageUrl:       { type: String, default: '', trim: true },   // Main design image
    imageUrl2:      { type: String, default: '', trim: true },   // Optional second image
    paperType:      { type: String, default: '', trim: true },
    notes:          { type: String, default: '', trim: true },
    status:         { type: String, default: 'Active', enum: ['Active', 'Inactive'] },
    
    // 100 Pcs Standards for auto-calculations
    top100:         { type: Number, default: 0 },
    sleeve100:      { type: Number, default: 0 },
    bottom100:      { type: Number, default: 0 },
    dupatta100:     { type: Number, default: 0 },
    cut100:         { type: Number, default: 0 },
    totalMtr100:    { type: Number, default: 0 },
    setCopy100:     { type: Number, default: 0 },
  },
  {
    timestamps: {
      createdAt: 'created_date_time',
      updatedAt: 'modified_date_time',
    },
    collection: 'designs',
  }
);

// Case-insensitive unique index on designName
designSchema.index({ designName: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

const Design = mongoose.model('Design', designSchema);
module.exports = Design;
