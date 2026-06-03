import os
import json
import base64
import urllib.request

api_key = "AIzaSyB5RTmpfecnpZOeW663hntIYhTJnc5sZFo"
image_dir = "/Users/giulianobuzetti/antigravity/Gestura:-Interactive-Motion-Showcase/public/images"
files = [f for f in os.listdir(image_dir) if f.startswith("WhatsApp") and (f.endswith(".jpeg") or f.endswith(".jpg") or f.endswith(".png"))]

url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"

for f in sorted(files):
    p = os.path.join(image_dir, f)
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
