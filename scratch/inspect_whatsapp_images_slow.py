import os
import json
import base64
import urllib.request
import time

api_key = "AIzaSyB5RTmpfecnpZOeW663hntIYhTJnc5sZFo"
image_dir = "/Users/giulianobuzetti/antigravity/Gestura:-Interactive-Motion-Showcase/public/images"
files = [
    "WhatsApp Image 2026-05-11 at 12.22.35.jpeg",
    "WhatsApp Image 2026-05-29 at 09.54.35.jpeg",
    "WhatsApp Image 2026-05-29 at 09.54.56.jpeg",
    "WhatsApp Image 2026-05-29 at 09.54.56 (1).jpeg",
    "WhatsApp Image 2026-05-29 at 09.54.56 (2).jpeg",
    "WhatsApp Image 2026-05-29 at 09.54.57.jpeg",
    "WhatsApp Image 2026-05-29 at 09.57.36.jpeg"
]

url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"

for f in files:
    p = os.path.join(image_dir, f)
    if not os.path.exists(p):
        print(f"File {f} does not exist!")
        continue
    time.sleep(3) # Avoid 429
    try:
        with open(p, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
        
        req_data = {
            "contents": [
                {
                    "parts": [
                        {"text": "Is this a check valve (válvula antirretorno) or overpressure valve (válvula de sobrepresión) for diesel? Answer in one short sentence starting with YES or NO, and describe what it is."},
                        {
                            "inlineData": {
                                "mimeType": "image/jpeg",
                                "data": encoded_string
                            }
                        }
                    ]
                }
            ]
        }
        
        req = urllib.request.Request(
            url, 
            data=json.dumps(req_data).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            text = res_data['candidates'][0]['content']['parts'][0]['text']
            print(f"{f}: {text.strip()}")
            
    except Exception as e:
        print(f"Error {f}: {e}")
