import os
from PIL import Image, ImageDraw, ImageFont

def generate_icons():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    public_dir = os.path.join(base_dir, 'public')
    logo_path = os.path.join(public_dir, 'Logo.png')
    
    if not os.path.exists(logo_path):
        print(f"Error: {logo_path} does not exist")
        return

    logo = Image.open(logo_path)
    if logo.mode != 'RGBA':
        logo = logo.convert('RGBA')

    bg_color = (15, 23, 42, 255) # #0f172a

    # Helper to create square icon with optional safe zone scaling
    def create_square_icon(size, scale_factor=0.9, maskable=False):
        img = Image.new('RGBA', (size, size), bg_color if maskable else (0, 0, 0, 0))
        target_size = int(size * scale_factor)
        
        # Maintain aspect ratio of logo
        w, h = logo.size
        ratio = min(target_size / w, target_size / h)
        new_w, new_h = int(w * ratio), int(h * ratio)
        
        resized_logo = logo.resize((new_w, new_h), Image.Resampling.LANCZOS)
        offset_x = (size - new_w) // 2
        offset_y = (size - new_h) // 2
        
        img.paste(resized_logo, (offset_x, offset_y), resized_logo)
        return img

    # 1. Standard Icons (purpose: any)
    icon_192 = create_square_icon(192, scale_factor=0.92, maskable=False)
    icon_192.save(os.path.join(public_dir, 'pwa-192x192.png'), 'PNG')
    print("Saved pwa-192x192.png")

    icon_512 = create_square_icon(512, scale_factor=0.92, maskable=False)
    icon_512.save(os.path.join(public_dir, 'pwa-512x512.png'), 'PNG')
    print("Saved pwa-512x512.png")

    # 2. Maskable Icons (purpose: maskable) with safe zone (central 80%) on #0f172a background
    maskable_192 = create_square_icon(192, scale_factor=0.76, maskable=True)
    maskable_192.save(os.path.join(public_dir, 'pwa-maskable-192x192.png'), 'PNG')
    print("Saved pwa-maskable-192x192.png")

    maskable_512 = create_square_icon(512, scale_factor=0.76, maskable=True)
    maskable_512.save(os.path.join(public_dir, 'pwa-maskable-512x512.png'), 'PNG')
    print("Saved pwa-maskable-512x512.png")

    # 3. Apple Touch Icon (180x180) on #0f172a background
    apple_icon = create_square_icon(180, scale_factor=0.82, maskable=True)
    apple_icon.save(os.path.join(public_dir, 'apple-touch-icon.png'), 'PNG')
    print("Saved apple-touch-icon.png")

    # 4. Generate screenshots for richer install UI (wide 1280x720, narrow 750x1334)
    # Screenshot Wide (1280x720)
    wide_img = Image.new('RGB', (1280, 720), (248, 250, 252))
    draw_wide = ImageDraw.Draw(wide_img)
    # Header bar
    draw_wide.rectangle([(0, 0), (1280, 56)], fill=(15, 23, 42))
    # Paste logo in header
    h_logo = logo.resize((36, int(36 * logo.size[1] / logo.size[0])), Image.Resampling.LANCZOS)
    wide_img.paste(h_logo, (24, 10), h_logo)
    # Cards layout
    draw_wide.rectangle([(32, 88), (620, 240)], fill=(255, 255, 255), outline=(226, 232, 240), width=1)
    draw_wide.rectangle([(644, 88), (1248, 240)], fill=(255, 255, 255), outline=(226, 232, 240), width=1)
    draw_wide.rectangle([(32, 264), (1248, 680)], fill=(255, 255, 255), outline=(226, 232, 240), width=1)
    wide_img.save(os.path.join(public_dir, 'screenshot-wide.png'), 'PNG')
    print("Saved screenshot-wide.png")

    # Screenshot Narrow (750x1334)
    narrow_img = Image.new('RGB', (750, 1334), (248, 250, 252))
    draw_narrow = ImageDraw.Draw(narrow_img)
    # Top bar
    draw_narrow.rectangle([(0, 0), (750, 88)], fill=(15, 23, 42))
    n_logo = logo.resize((44, int(44 * logo.size[1] / logo.size[0])), Image.Resampling.LANCZOS)
    narrow_img.paste(n_logo, (24, 22), n_logo)
    # Mobile KPI cards (2 columns)
    draw_narrow.rectangle([(20, 112), (360, 260)], fill=(255, 255, 255), outline=(226, 232, 240), width=1)
    draw_narrow.rectangle([(380, 112), (730, 260)], fill=(255, 255, 255), outline=(226, 232, 240), width=1)
    # Mobile list cards
    draw_narrow.rectangle([(20, 280), (730, 520)], fill=(255, 255, 255), outline=(226, 232, 240), width=1)
    draw_narrow.rectangle([(20, 540), (730, 780)], fill=(255, 255, 255), outline=(226, 232, 240), width=1)
    draw_narrow.rectangle([(20, 800), (730, 1040)], fill=(255, 255, 255), outline=(226, 232, 240), width=1)
    narrow_img.save(os.path.join(public_dir, 'screenshot-narrow.png'), 'PNG')
    print("Saved screenshot-narrow.png")

if __name__ == '__main__':
    generate_icons()
