import os
from PIL import Image

image_path = r"C:\Users\DELL\.gemini\antigravity\brain\7645c87c-f6c0-4af3-9b95-4476f113044d\media__1774075149787.png"
ico_path = r"d:\Cloudflares\deploy_generate.ico"

try:
    img = Image.open(image_path)
    # Crop to square if necessary to avoid distortion, but basic ICO save is usually fine
    width, height = img.size
    min_dim = min(width, height)
    left = (width - min_dim) / 2
    top = (height - min_dim) / 2
    right = (width + min_dim) / 2
    bottom = (height + min_dim) / 2
    img = img.crop((left, top, right, bottom))
    
    img.save(ico_path, format="ICO", sizes=[(256, 256)])
    print("ICO created successfully")
except Exception as e:
    print(f"Error: {e}")
