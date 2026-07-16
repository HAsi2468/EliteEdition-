import sys
from PIL import Image

src_path = "/Users/harshitsidapara/.gemini/antigravity-ide/brain/94ee5792-3c72-4f8f-a3bc-8927f70540c2/media__1784192933322.jpg"
dest_path = "/Users/harshitsidapara/Node projects/Elite_Edition/EliteEditionMongo/src/controllers/Logo_previous.png"

try:
    img = Image.open(src_path)
    img = img.convert("RGBA")
    
    # Sample background color near top-left corner
    bg_r, bg_g, bg_b, _ = img.getpixel((5, 5))
    print(f"Sampled background color: ({bg_r}, {bg_g}, {bg_b})")
    
    datas = img.getdata()
    newData = []
    
    for item in datas:
        r, g, b, a = item
        
        # Calculate color distance from background (black/dark color)
        dist = abs(r - bg_r) + abs(g - bg_g) + abs(b - bg_b)
        
        if dist < 45:
            # Fully transparent background
            newData.append((0, 0, 0, 0))
        elif dist > 110:
            # Fully opaque original color (gold)
            newData.append((r, g, b, 255))
        else:
            # Semi-transparent transition
            factor = (dist - 45) / (110 - 45)
            alpha = int(255 * factor)
            newData.append((r, g, b, alpha))
            
    img.putdata(newData)
    img.save(dest_path, "PNG")
    print("Gold logo processed and saved successfully!")
    sys.exit(0)
except Exception as e:
    print(f"Error processing logo: {e}")
    sys.exit(1)
