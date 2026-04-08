#!/usr/bin/env python3
"""
Generate game textures using ComfyUI.
Supports water, ice, rock, lava, grass presets.
"""
import json
import argparse
import time
import urllib.request
import urllib.error
import os
from pathlib import Path

ENDPOINT = "http://127.0.0.1:8188"
PRESET_PATH = Path(__file__).parent / "texture-presets.json"

# Load presets
with open(PRESET_PATH) as f:
    PRESETS = json.load(f)

def load_presets():
    """Load texture presets from JSON file."""
    with open(PRESET_PATH) as f:
        return json.load(f)

def build_workflow(positive_prompt, negative_prompt, size, steps, cfg, seed, checkpoint):
    """Build a ComfyUI workflow for texture generation."""
    return {
        "1": {
            "inputs": {"ckpt_name": checkpoint},
            "class_type": "CheckpointLoaderSimple"
        },
        "2": {
            "inputs": {"text": positive_prompt, "clip": ["1", 1]},
            "class_type": "CLIPTextEncode"
        },
        "3": {
            "inputs": {"text": negative_prompt, "clip": ["1", 1]},
            "class_type": "CLIPTextEncode"  
        },
        "4": {
            "inputs": {"width": size, "height": size, "batch_size": 1},
            "class_type": "EmptyLatentImage"
        },
        "5": {
            "inputs": {
                "seed": seed,
                "steps": steps,
                "cfg": cfg,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": 1.0,
                "model": ["1", 0],
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["4", 0]
            },
            "class_type": "KSampler"
        },
        "6": {
            "inputs": {"samples": ["5", 0], "vae": ["1", 2]},
            "class_type": "VAEDecode"
        },
        "7": {
            "inputs": {"filename_prefix": "puffin_texture", "images": ["6", 0]},
            "class_type": "SaveImage"
        }
    }

def post_prompt(workflow):
    """Submit a workflow to ComfyUI and return prompt_id."""
    url = f"{ENDPOINT}/prompt"
    data = json.dumps({"prompt": workflow}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            if response.status == 200:
                return result.get("prompt_id")
            else:
                print(f"Error: HTTP {response.status}")
                print(result)
                return None
    except urllib.error.HTTPError as e:
        error_data = json.loads(e.read().decode())
        print(f"HTTP Error {e.code}: {error_data}")
        return None
    except Exception as e:
        print(f"Error submitting prompt: {e}")
        return None

def wait_for_result(prompt_id, timeout=240):
    """Poll ComfyUI for generation results."""
    url = f"{ENDPOINT}/history/{prompt_id}"
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        try:
            with urllib.request.urlopen(url) as response:
                data = json.loads(response.read().decode())
                if prompt_id in data:
                    item = data[prompt_id]
                    # Check if generation is complete
                    if "outputs" in item and "7" in item["outputs"]:
                        images = item["outputs"]["7"].get("images", [])
                        if images:
                            return images[0]
            print(f"Waiting... ({int(time.time() - start_time)}s)")
        except:
            pass
        time.sleep(1)
    
    return None

def download_image(image_meta):
    """Download generated image from ComfyUI."""
    filename = image_meta["filename"]
    subfolder = image_meta.get("subfolder", "")
    
    params = f"filename={filename}&subfolder={subfolder}&type=output"
    url = f"{ENDPOINT}/view?{params}"
    
    try:
        with urllib.request.urlopen(url) as response:
            return response.read()
    except Exception as e:
        print(f"Error downloading image: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description="Generate game textures using ComfyUI")
    parser.add_argument("--preset", default="water", help="Texture preset (water, ice, rock, lava, grass)")
    parser.add_argument("--size", type=int, default=256, help="Image size in pixels")
    parser.add_argument("--steps", type=int, default=15, help="Generation steps")
    parser.add_argument("--cfg", type=float, default=6.5, help="CFG scale")
    parser.add_argument("--seed", type=int, default=None, help="Random seed")
    parser.add_argument("--ckpt", default="zImageTurbo_turbo.safetensors", help="Checkpoint model")
    parser.add_argument("--out", default=None, help="Output filename")
    
    args = parser.parse_args()
    
    # Validate preset
    if args.preset not in PRESETS:
        print(f"Unknown preset '{args.preset}'. Available: {', '.join(PRESETS.keys())}")
        return 1
    
    preset = PRESETS[args.preset]
    seed = args.seed if args.seed is not None else int(time.time() * 1000) % 2147483647
    output_name = args.out or f"{args.preset}_{int(time.time())}.png"
    
    print(f"Generating '{args.preset}' texture...")
    print(f"  Size: {args.size}x{args.size}, Steps: {args.steps}, CFG: {args.cfg}, Seed: {seed}")
    
    # Build and submit workflow
    workflow = build_workflow(
        preset["positive"],
        preset["negative"],
        args.size,
        args.steps,
        args.cfg,
        seed,
        args.ckpt
    )
    
    prompt_id = post_prompt(workflow)
    if not prompt_id:
        print("Failed to submit prompt to ComfyUI")
        return 1
    
    print(f"Prompt queued: {prompt_id}")
    
    # Wait for result
    image_meta = wait_for_result(prompt_id)
    if not image_meta:
        print("Timeout waiting for generation result")
        return 1
    
    # Download image
    image_data = download_image(image_meta)
    if not image_data:
        print("Failed to download generated image")
        return 1
    
    # Save to file
    out_dir = Path("img") / "generated"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / output_name
    
    with open(out_path, "wb") as f:
        f.write(image_data)
    
    print(f"✓ Saved texture: {out_path}")
    return 0

if __name__ == "__main__":
    exit(main())
