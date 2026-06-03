import os
import json
import base64
import urllib.request

api_key = "AIzaSyB5RTmpfecnpZOeW663hntIYhTJnc5sZFo"
brain_dir = "/Users/giulianobuzetti/.gemini/antigravity/brain/1475333e-0eed-4c23-b36c-fc30769d4988"
files = ["media__1780442347004.png", "media__1780443793031.png", "media__1780443797007.png"]

url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"

for f in files:
    p = os.path.join(brain_dir, f)
    if not os.path.exists(p):
        print(f"File {f} does not exist!")
        continue
    print(f"Analyzing {f}...")
    try:
        with open(p, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
        
        req_data = {
            "contents": [
                {
                    "parts": [
                        {"text": "Describe this image in Spanish. Tell me what type of diesel valve or part this is, its physical characteristics, its color, shape, threaded ends, or hose fittings."},
                        {
                            "inlineData": {
                                "mimeType": "image/png",
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
            print(f"Result for {f}:\n{text}\n" + "-"*50)
            
    except Exception as e:
        print(f"Error analyzing {f}: {e}")
