from numbers_parser import Document

def main():
    doc = Document('/Users/harshitsidapara/Node projects/Elite_Edition/Fabric.numbers')
    for sheet in doc.sheets:
        print(f"\n================ SHEET: {sheet.name} ================")
        table = sheet.tables[0]
        rows = list(table.rows())
        
        # Headers are usually in row 1
        headers = [cell.value if cell is not None else None for cell in rows[1]]
        print("Headers:", headers[:30])
        
        # Print first 20 rows with valid LOT NO
        count = 0
        for r_idx, row in enumerate(rows):
            if r_idx < 2:
                continue
            row_vals = [cell.value if cell is not None else None for cell in row]
            if row_vals[0] is not None:
                print(f"Row {r_idx} (Lot {row_vals[0]}): {row_vals[:28]}")
                count += 1
                if count >= 20:
                    break

if __name__ == '__main__':
    main()
