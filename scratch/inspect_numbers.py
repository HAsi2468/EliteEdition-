import sys
from numbers_parser import Document

def main():
    doc = Document('/Users/harshitsidapara/Node projects/Elite_Edition/Fabric.numbers')
    print("Sheets count:", len(doc.sheets))
    for sheet_idx, sheet in enumerate(doc.sheets):
        print(f"\nSheet {sheet_idx}: {sheet.name}")
        print("Tables count:", len(sheet.tables))
        for table_idx, table in enumerate(sheet.tables):
            print(f"  Table {table_idx}: {table.name} (Rows: {table.num_rows}, Cols: {table.num_cols})")
            
            # Print the first few rows (e.g. up to 10 rows)
            rows = table.rows()
            for r_idx in range(min(15, len(rows))):
                row_vals = [cell.value if cell is not None else None for cell in rows[r_idx]]
                # Filter out completely empty rows
                if any(v is not None for v in row_vals):
                    # Check background color if possible, numbers-parser exposes it?
                    # Note: numbers-parser doesn't support reading background colors directly easily via API,
                    # but we can look for specific outward details like columns 1 to 10.
                    print(f"    Row {r_idx}: {row_vals}")

if __name__ == '__main__':
    main()
