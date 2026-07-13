import json
from numbers_parser import Document

def clean_val(val):
    if val is None:
        return None
    if isinstance(val, float) and val.is_integer():
        return int(val)
    return val

def main():
    doc = Document('/Users/harshitsidapara/Node projects/Elite_Edition/Fabric.numbers')
    all_records = []
    
    for sheet in doc.sheets:
        sheet_name = sheet.name
        # Find date defaults for this sheet
        # JUNE-2026 -> 2026-06-15, JULY-2026 -> 2026-07-15
        if 'JUN' in sheet_name:
            default_date = '2026-06-15'
        elif 'JUL' in sheet_name:
            default_date = '2026-07-15'
        else:
            default_date = '2026-07-15'
            
        table = sheet.tables[0]
        rows = list(table.rows())
        
        for r_idx, row in enumerate(rows):
            if r_idx < 2:  # Skip headers
                continue
            
            row_vals = [cell.value for cell in row]
            
            # Check if row has valid LOT NO
            lot_no = clean_val(row_vals[0])
            if lot_no is None:
                continue
                
            vendor = clean_val(row_vals[1])
            fabric_quality = clean_val(row_vals[2])
            challan_no = clean_val(row_vals[3])
            inward_qty = clean_val(row_vals[4])
            
            if not fabric_quality or inward_qty is None:
                continue
                
            # Parse Inward record
            record = {
                "sheet": sheet_name,
                "type": "INWARD",
                "lotNo": int(lot_no) if isinstance(lot_no, (int, float)) else lot_no,
                "vendorName": str(vendor) if vendor else "",
                "fabricQuality": str(fabric_quality),
                "challanNo": str(challan_no) if challan_no is not None else "",
                "qty": float(inward_qty),
                "date": default_date,
                "outwards": []
            }
            
            # Parse Outward columns 5 to 24 in pairs (qty, job/challan)
            for pair_idx in range(10):
                qty_col = 5 + (pair_idx * 2)
                job_col = 6 + (pair_idx * 2)
                
                if qty_col >= len(row_vals) or job_col >= len(row_vals):
                    break
                    
                o_qty = clean_val(row_vals[qty_col])
                o_job = clean_val(row_vals[job_col])
                
                if o_qty is not None:
                    out_qty = float(o_qty)
                    out_job = ""
                    out_notes = ""
                    
                    if o_job is not None:
                        # Check if job is numeric
                        if isinstance(o_job, (int, float)):
                            out_job = str(int(o_job))
                        else:
                            # String like 'RETURN'
                            out_notes = str(o_job).strip()
                            
                    record["outwards"].append({
                        "qty": out_qty,
                        "jobNo": out_job,
                        "notes": out_notes
                    })
                    
            all_records.append(record)
            
    # Write output to JSON
    with open('/Users/harshitsidapara/Node projects/Elite_Edition/EliteEditionMongo/scratch/fabric_data.json', 'w') as f:
        json.dump(all_records, f, indent=2)
        
    print(f"Successfully parsed {len(all_records)} Inward lots with outward distributions.")

if __name__ == '__main__':
    main()
