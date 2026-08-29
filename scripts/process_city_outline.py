from PIL import Image, ImageOps, ImageFilter, ImageEnhance

def process_city_from_photo(input_path, output_path):
    img = Image.open(input_path).convert("RGB")
    
    # Resize to good standard dimensions if huge
    img.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
    
    # Convert to grayscale
    gray = ImageOps.grayscale(img)
    
    # Auto contrast
    gray = ImageOps.autocontrast(gray, cutoff=2)
    
    # Extract edges with multiple passes for sharp architectural geometry
    edges = gray.filter(ImageFilter.FIND_EDGES)
    edges = edges.filter(ImageFilter.SMOOTH_MORE)
    
    # Enhance edge contrast
    enhancer = ImageEnhance.Contrast(edges)
    edges = enhancer.enhance(2.5)
    
    # Invert edges so lines are bright and dark areas are background
    # (FIND_EDGES outputs bright edges on black, so edges are already white on black)
    
    # Clean noise: remove dim noise below threshold 45
    alpha = edges.point(lambda p: 0 if p < 45 else min(255, int((p - 45) * (255 / 210) * 1.4)))
    
    # Fade bottom-to-top so the buildings blend cleanly into the ground
    w, h = alpha.size
    fade_mask = Image.new("L", (w, h))
    for y in range(h):
        # Fade out top 15% and bottom 10%
        factor = 1.0
        if y < h * 0.15:
            factor = y / (h * 0.15)
        elif y > h * 0.85:
            factor = (h - y) / (h * 0.15)
        
        row_val = int(255 * factor)
        for x in range(w):
            orig_a = alpha.getpixel((x, y))
            fade_mask.putpixel((x, y), min(orig_a, row_val))
            
    # Create ivory/chartreuse tinted outline
    # #f1eee6 (241, 238, 230)
    fg = Image.new("RGBA", (w, h), (241, 238, 230, 255))
    fg.putalpha(fade_mask)
    
    fg.save(output_path, "PNG")
    print(f"Saved city outline to {output_path}")

def process_pixel_city(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    w, h = img.size
    
    # Convert to grayscale to identify silhouettes
    gray = ImageOps.grayscale(img)
    
    # Extract edges of buildings
    edges = gray.filter(ImageFilter.FIND_EDGES)
    enhancer = ImageEnhance.Contrast(edges)
    edges = enhancer.enhance(3.0)
    
    alpha = edges.point(lambda p: 0 if p < 40 else min(255, int(p * 1.5)))
    
    fg = Image.new("RGBA", (w, h), (241, 238, 230, 255))
    fg.putalpha(alpha)
    fg.save(output_path, "PNG")
    print(f"Saved pixel city outline to {output_path}")

if __name__ == "__main__":
    photo_file = "/Users/karteeksai/.gemini/antigravity/brain/062a4b97-d636-4cb8-a477-e88239703b69/.user_uploaded/media_1787994711719.jpg"
    pixel_file = "/Users/karteeksai/.gemini/antigravity/brain/062a4b97-d636-4cb8-a477-e88239703b69/.user_uploaded/media_1787994743425.png"
    
    out_file1 = "/Users/karteeksai/Desktop/LegalAid/apps/web/public/city-buildings.png"
    out_file2 = "/Users/karteeksai/Desktop/LegalAid/apps/web/public/city-skyline.png"
    
    process_city_from_photo(photo_file, out_file1)
    process_pixel_city(pixel_file, out_file2)
