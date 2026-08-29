from PIL import Image, ImageOps, ImageEnhance

def process_lady_justice(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    
    # Split into channels
    r, g, b, a = img.split()
    
    # Convert to grayscale to measure luminance
    gray = ImageOps.grayscale(img)
    
    # Invert grayscale: black lines become white (255), white background becomes black (0)
    inverted = ImageOps.invert(gray)
    
    # Enhance contrast to make the lines clean and remove background noise
    enhancer = ImageEnhance.Contrast(inverted)
    clean_alpha = enhancer.enhance(1.8)
    
    # Threshold low noise: pixels below 40 brightness in inverted image become completely transparent
    clean_alpha = clean_alpha.point(lambda p: 0 if p < 35 else min(255, int((p - 35) * (255 / (255 - 35)) * 1.2)))
    
    # Create white/ivory foreground image
    # Color #f1eee6 (241, 238, 230)
    colored_fg = Image.new("RGBA", img.size, (241, 238, 230, 255))
    
    # Apply our inverted mask as the alpha channel
    colored_fg.putalpha(clean_alpha)
    
    # Save transparent PNG
    colored_fg.save(output_path, "PNG")
    print(f"Successfully processed Lady Justice to {output_path}")

if __name__ == "__main__":
    input_file = "/Users/karteeksai/.gemini/antigravity/brain/062a4b97-d636-4cb8-a477-e88239703b69/.user_uploaded/media_1787994080048.png"
    output_file = "/Users/karteeksai/Desktop/LegalAid/apps/web/public/lady-justice.png"
    process_lady_justice(input_file, output_file)
