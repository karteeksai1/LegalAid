from PIL import Image, ImageDraw, ImageFilter
import math

def generate_architectural_skyline(output_path, width=1200, height=900):
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Base color for architectural lines (#f1eee6)
    color_main = (241, 238, 230, 160)
    color_dim = (241, 238, 230, 80)
    color_accent = (215, 255, 82, 190) # Electric chartreuse
    
    # Perspective vanishing point at center bottom
    vp_x = width * 0.45
    vp_y = height * 1.05
    
    # 1. Background tall towers (faint lines)
    bg_buildings = [
        (100, 150, 180, height),
        (250, 80, 200, height),
        (420, 40, 220, height),
        (620, 110, 190, height),
        (780, 70, 230, height),
        (980, 140, 180, height),
    ]
    for x, top, w, btm in bg_buildings:
        draw.rectangle([x, top, x + w, btm], outline=color_dim, width=1)
        # Window grids
        for wy in range(top + 20, btm - 50, 25):
            for wx in range(x + 15, x + w - 15, 20):
                draw.rectangle([wx, wy, wx + 8, wy + 14], outline=(241, 238, 230, 40), width=1)
                
    # 2. Diagonal perspective street lines receding into distance
    for angle in range(-65, 70, 12):
        rad = math.radians(angle)
        end_x = vp_x + math.sin(rad) * height * 1.2
        end_y = vp_y - math.cos(rad) * height * 1.2
        draw.line([(vp_x, vp_y), (end_x, end_y)], fill=(241, 238, 230, 45), width=1)
        
    # Center median guideline with chartreuse accent
    draw.line([(vp_x, vp_y), (vp_x, height * 0.35)], fill=color_accent, width=2)
    
    # 3. Foreground prominent architectural skyscrapers with crisp borders
    fg_buildings = [
        # (x, y_top, width, height, spire, accent)
        (50, 220, 180, height, 40, False),
        (200, 160, 220, height, 70, True),
        (400, 90, 260, height, 110, True),
        (640, 140, 240, height, 60, False),
        (860, 190, 220, height, 50, True),
        (1040, 260, 160, height, 30, False),
    ]
    
    for x, top, w, btm, spire, has_accent in fg_buildings:
        # Building outline
        draw.rectangle([x, top, x + w, btm], outline=color_main, width=2)
        
        # Rooftop antenna/spire
        if spire > 0:
            cx = x + w // 2
            draw.line([(cx, top), (cx, top - spire)], fill=color_main, width=2)
            draw.ellipse([cx - 3, top - spire - 3, cx + 3, top - spire + 3], fill=color_accent if has_accent else color_main)
            
        # Stepped roof architecture
        if w > 200:
            draw.rectangle([x + 20, top - 25, x + w - 20, top], outline=color_main, width=1)
            draw.rectangle([x + 45, top - 45, x + w - 45, top - 25], outline=color_main, width=1)
            
        # Vertical structural mullions
        for mx in range(x + 30, x + w - 20, 35):
            draw.line([(mx, top), (mx, btm)], fill=color_dim, width=1)
            
        # Horizontal floor divisions
        for fy in range(top + 30, btm, 40):
            draw.line([(x, fy), (x + w, fy)], fill=color_dim, width=1)
            # Occasional lit windows
            for wx in range(x + 10, x + w - 15, 20):
                if (x + fy + wx) % 7 == 0:
                    draw.rectangle([wx, fy + 8, wx + 10, fy + 22], fill=(215, 255, 82, 120) if has_accent else (241, 238, 230, 90))
                    
    # 4. Fade out gradient mask towards edges
    alpha = img.split()[-1]
    fade = Image.new("L", (width, height), 255)
    fade_draw = ImageDraw.Draw(fade)
    
    # Linear fade towards left and top
    for x in range(width):
        for y in range(height):
            a_val = 255
            if x < 150:
                a_val = min(a_val, int(255 * (x / 150)))
            if y < 80:
                a_val = min(a_val, int(255 * (y / 80)))
            if y > height - 100:
                a_val = min(a_val, int(255 * ((height - y) / 100)))
            fade.putpixel((x, y), a_val)
            
    img.putalpha(Image.composite(alpha, Image.new("L", (width, height), 0), fade))
    
    img.save(output_path, "PNG")
    print(f"Generated architectural skyline to {output_path}")

if __name__ == "__main__":
    generate_architectural_skyline("/Users/karteeksai/Desktop/LegalAid/apps/web/public/city-architectural.png")
