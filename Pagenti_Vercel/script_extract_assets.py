import os
import json
import re
from PIL import Image
from google import genai
from google.genai import types

# Configuration
ASSET_DIR = r"c:\Users\Shaun\OneDrive\Desktop\Pagenti\assets\avatars"
# All uploaded grids
INPUT_FILES = [
    r"C:/Users/Shaun/.gemini/antigravity/brain/740ecd85-3c85-48cf-91f6-d868af79e012/uploaded_media_0_1770123921746.jpg",
    r"C:/Users/Shaun/.gemini/antigravity/brain/740ecd85-3c85-48cf-91f6-d868af79e012/uploaded_media_1_1770123921746.jpg",
    r"C:/Users/Shaun/.gemini/antigravity/brain/740ecd85-3c85-48cf-91f6-d868af79e012/uploaded_media_2_1770123921746.jpg"
]

def load_api_key():
    try:
        with open('.env.local', 'r') as f:
            for line in f:
                if line.startswith('VITE_GOOGLE_API_KEY='):
                    return line.strip().split('=')[1].strip('"')
                if line.startswith('VITE_GEMINI_API_KEY='):
                    return line.strip().split('=')[1].strip('"')
    except Exception as e:
        print(f"Error loading .env.local: {e}")
    return os.environ.get("GOOGLE_API_KEY")

def extract_json(text):
    try:
        text = re.sub(r'```json\s*|\s*```', '', text)
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1:
            return json.loads(text[start:end+1])
        return json.loads(text)
    except Exception as e:
        print(f"JSON Parse Error: {e}")
        return None

def crop_inset(image, percentage=0.03):
    """Crops a percentage off each side to remove borders."""
    w, h = image.size
    left = w * percentage
    top = h * percentage
    right = w * (1 - percentage)
    bottom = h * (1 - percentage)
    return image.crop((left, top, right, bottom))

def force_aspect_ratio(image, ratio=(3, 4)):
    """Center crops to specific ratio (default 3:4 portrait)."""
    target_ratio = ratio[0] / ratio[1]
    w, h = image.size
    current_ratio = w / h
    
    if current_ratio > target_ratio:
        # Too wide, crop width
        new_w = h * target_ratio
        left = (w - new_w) / 2
        return image.crop((left, 0, left + new_w, h))
    else:
        # Too tall, crop height
        new_h = w / target_ratio
        top = (h - new_h) / 2
        return image.crop((0, top, w, top + new_h))

def process_grid(file_path, client):
    print(f"Processing: {file_path}")
    try:
        image = Image.open(file_path)
        
        prompt = """
        Analyze this image containing a grid of agent portraits.
        
        1. Identify grid dimension (rows, cols).
        2. For each agent, analyze their VISUAL STYLE suitable for a filename description.
           DO NOT try to read the text.
           Just describe: Gender, Vibe (Cyberpunk, Corporate, Minimalist), and a suggested Role based on the look.

        Return JSON:
        {
            "grid_layout": { "rows": int, "cols": int },
            "agents": [
                {
                    "row": int,
                    "col": int,
                    "style_desc": "string (e.g. 'Cyber_Female_Hacker')"
                }
            ]
        }
        """
        
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[prompt, image],
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        data = extract_json(response.text)
        if not data: return

        rows = data['grid_layout']['rows']
        cols = data['grid_layout']['cols']
        img_w, img_h = image.size
        
        cell_w = img_w / cols
        cell_h = img_h / rows
        
        for agent in data['agents']:
            r = agent['row']
            c = agent['col']
            desc = agent['style_desc']
            safe_desc = re.sub(r'[^a-zA-Z0-9]', '', desc.replace(" ", ""))
            
            # 1. Extract Cell
            left = c * cell_w
            top = r * cell_h
            right = left + cell_w
            bottom = top + cell_h
            
            cell_img = image.crop((left, top, right, bottom))
            
            # 2. Remove Grid Borders (Inset by 4% to be safe)
            clean_img = crop_inset(cell_img, percentage=0.04)
            
            # 3. Force 3:4 Aspect Ratio (Portrait)
            final_crop = force_aspect_ratio(clean_img, ratio=(3, 4))
            
            # Generate Unique ID
            uid = f"{os.path.basename(file_path).split('_')[2]}_{r}_{c}" 
            
            filename = f"pAGENTi_Style_{safe_desc}_{uid}.png"
            out_path = os.path.join(ASSET_DIR, filename)
            
            final_crop.save(out_path)
            print(f"Saved: {filename}")
            
    except Exception as e:
        print(f"Error processing {file_path}: {e}")

def main():
    api_key = load_api_key()
    if not api_key: return
    client = genai.Client(api_key=api_key)
    if not os.path.exists(ASSET_DIR): os.makedirs(ASSET_DIR)
    
    for f in INPUT_FILES:
        process_grid(f, client)

if __name__ == "__main__":
    main()
