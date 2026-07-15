import sys
from PIL import Image

logo_path = "/Users/harshitsidapara/Node projects/Elite_Edition/EliteEditionMongo/src/controllers/Logo.png"

try:
    img = Image.open(logo_path)
    img = img.convert("RGBA")
    
    # Get background color sample from the top-left corner
    bg_r, bg_g, bg_b, _ = img.getpixel((5, 5))
    print(f"Sampled background color: ({bg_r}, {bg_g}, {bg_b})")
    
    datas = img.getdata()
    newData = []
    
    for item in datas:
        r, g, b, a = item
        
        # Calculate color distance from background
        dist = abs(r - bg_r) + abs(g - bg_g) + abs(b - bg_b)
        
        if dist < 35:
            # Fully transparent background
            newData.append((0, 0, 0, 0))
        elif dist > 100:
            # Fully opaque black text
            newData.append((0, 0, 0, 255))
        else:
            # Interpolated semi-transparent edge
            factor = (dist - 35) / (100 - 35)
            alpha = int(255 * factor)
            newData.append((0, 0, 0, alpha))
            
    img.putdata(newData)
    img.save(logo_path, "PNG")
    print("Logo processed successfully!")
    sys.exit(0)
except Exception as e:
    print(f"Error processing logo: {e}")
    sys.exit(1)
