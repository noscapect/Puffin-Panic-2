#!/usr/bin/env python3
"""
Complete texture generation pipeline integrating ComfyUI with the game.
Generates textures, copies them to the game folder, and tracks usage.
"""
import json
import argparse
import time
import urllib.request
import urllib.error
import os
import shutil
from pathlib import Path

COMFYUI_PATH = Path(r"C:\Intel\ComfyUI_windows_portable\ComfyUI")
ENDPOINT = "http://127.0.0.1:8188"
GAME_IMG_DIR = Path("img")
GAME_GENERATED_DIR = GAME_IMG_DIR / "generated"
PRESET_PATH = Path("scripts/texture-presets.json")

def load_presets():
    """Load texture presets from JSON file."""
    with open(PRESET_PATH) as f:
        return json.load(f)

def build_workflow(positive_prompt, negative_prompt, size, steps, cfg, seed, checkpoint):
    """Build a ComfyUI workflow for zImageTurbo (flow-based model).

    zImageTurbo architecture requirements:
    - Separate CLIPLoader (qwen_3_4b_fp8_mixed, lumina2 type) — no CLIP in checkpoint
    - Separate VAELoader (ae_zim.safetensors) — no VAE in checkpoint
    - ModelSamplingAuraFlow (shift=3) to configure flow-based sampling
    - euler_flow sampler + zimage_turbo scheduler
    - 9 steps, CFG ~1.2
    """
    return {
        # Load zImageTurbo model (model only — no CLIP/VAE embedded)
        "1": {
            "inputs": {"ckpt_name": checkpoint},
            "class_type": "CheckpointLoaderSimple"
        },
        # Load CLIP separately (Qwen 3 4B, lumina2 type required by zImageTurbo)
        "2": {
            "inputs": {"clip_name": "qwen_3_4b_fp8_mixed.safetensors", "type": "lumina2"},
            "class_type": "CLIPLoader"
        },
        # Load VAE separately
        "3": {
            "inputs": {"vae_name": "ae_zim.safetensors"},
            "class_type": "VAELoader"
        },
        # Wrap model with flow-based sampling (shift=3 as per user workflow)
        "4": {
            "inputs": {"model": ["1", 0], "shift": 3.0},
            "class_type": "ModelSamplingAuraFlow"
        },
        # Positive prompt
        "5": {
            "inputs": {"text": positive_prompt, "clip": ["2", 0]},
            "class_type": "CLIPTextEncode"
        },
        # Negative prompt
        "6": {
            "inputs": {"text": negative_prompt, "clip": ["2", 0]},
            "class_type": "CLIPTextEncode"
        },
        # Latent image
        "7": {
            "inputs": {"width": size, "height": size, "batch_size": 1},
            "class_type": "EmptyLatentImage"
        },
        # KSampler: euler_flow + zimage_turbo — required for this model
        "8": {
            "inputs": {
                "seed": seed,
                "steps": steps,
                "cfg": cfg,
                "sampler_name": "euler_flow",
                "scheduler": "zimage_turbo",
                "denoise": 1.0,
                "model": ["4", 0],
                "positive": ["5", 0],
                "negative": ["6", 0],
                "latent_image": ["7", 0]
            },
            "class_type": "KSampler"
        },
        # VAE Decode using separately loaded VAE
        "9": {
            "inputs": {"samples": ["8", 0], "vae": ["3", 0]},
            "class_type": "VAEDecode"
        },
        # Save output
        "10": {
            "inputs": {"filename_prefix": "puffin_texture", "images": ["9", 0]},
            "class_type": "SaveImage"
        }
    }

def post_prompt(workflow):
    """Submit a workflow to ComfyUI and return prompt_id."""
    url = f"{ENDPOINT}/prompt"
    data = json.dumps({"prompt": workflow}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            result = json.loads(response.read().decode())
            if response.status == 200:
                return result.get("prompt_id")
            else:
                print(f"Error: HTTP {response.status}")
                print(result)
                return None
    except urllib.error.HTTPError as e:
        try:
            error_data = json.loads(e.read().decode())
            print(f"HTTP Error {e.code}: {error_data}")
        except:
            print(f"HTTP Error {e.code}")
        return None
    except Exception as e:
        print(f"Error submitting prompt: {e}")
        return None

def wait_for_result(prompt_id, timeout=600):
    """Poll ComfyUI for generation results."""
    url = f"{ENDPOINT}/history/{prompt_id}"
    start_time = time.time()
    last_print = 0
    
    while time.time() - start_time < timeout:
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                data = json.loads(response.read().decode())
                if prompt_id in data:
                    item = data[prompt_id]
                    # Check if generation is complete
                    if "outputs" in item and "10" in item["outputs"]:
                        images = item["outputs"]["10"].get("images", [])
                        if images:
                            return images[0]
        except:
            pass
        
        # Print progress every 5 seconds
        now = time.time()
        if now - last_print >= 5:
            elapsed = int(now - start_time)
            print(f"  Generating... ({elapsed}s)", flush=True)
            last_print = now
        
        time.sleep(1)
    
    return None

def download_image(image_meta):
    """Download generated image from ComfyUI."""
    filename = image_meta["filename"]
    subfolder = image_meta.get("subfolder", "")
    
    params = f"filename={filename}&subfolder={subfolder}&type=output"
    url = f"{ENDPOINT}/view?{params}"
    
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            return response.read()
    except Exception as e:
        print(f"Error downloading image: {e}")
        return None

def find_latest_generated_file():
    """Find the latest puffin_texture file in ComfyUI output folder."""
    output_dir = COMFYUI_PATH / "output"
    if not output_dir.exists():
        return None
    
    puffin_files = sorted(
        output_dir.glob("puffin_texture_*.png"),
        key=lambda p: p.stat().st_mtime,
        reverse=True
    )
    return puffin_files[0] if puffin_files else None

def main():
    parser = argparse.ArgumentParser(description="Generate and integrate game textures using ComfyUI")
    parser.add_argument("--preset", default="water", help="Texture preset (water, ice, rock, lava, grass)")
    parser.add_argument("--size", type=int, default=1024, help="Image size in pixels (1024 recommended for zImageTurbo)")
    parser.add_argument("--steps", type=int, default=9, help="Generation steps (9 recommended for zImageTurbo)")
    parser.add_argument("--cfg", type=float, default=1.2, help="CFG scale (1.2 recommended for zImageTurbo)")
    parser.add_argument("--seed", type=int, default=None, help="Random seed")
    parser.add_argument("--ckpt", default="zImageTurbo_turbo.safetensors", help="Checkpoint model")
    parser.add_argument("--no-copy", action="store_true", help="Don't copy texture to game folder")
    
    args = parser.parse_args()
    
    # Validate preset
    presets = load_presets()
    if args.preset not in presets:
        print(f"Unknown preset '{args.preset}'. Available: {', '.join(presets.keys())}")
        return 1
    
    preset = presets[args.preset]
    seed = args.seed if args.seed is not None else int(time.time() * 1000) % 2147483647
    
    print(f"Generating '{args.preset}' texture...")
    print(f"  Size: {args.size}x{args.size}, Steps: {args.steps}, CFG: {args.cfg}")
    print(f"  Seed: {seed}, Checkpoint: {args.ckpt}")
    
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
    
    print(f"  Queued: {prompt_id[:8]}...")
    
    # Wait for result
    image_meta = wait_for_result(prompt_id)
    if not image_meta:
        print("Timeout waiting for generation result")
        return 1
    
    print(f"  Generated: {image_meta['filename']}")
    
    # Find and copy the file
    if not args.no_copy:
        src_file = find_latest_generated_file()
        raw_bytes = None
        if src_file and src_file.stat().st_mtime > time.time() - 60:
            raw_bytes = src_file.read_bytes()
        else:
            # Fallback: download via API
            raw_bytes = download_image(image_meta)

        if raw_bytes:
            GAME_GENERATED_DIR.mkdir(parents=True, exist_ok=True)
            # Seed-named copy for history
            dest_file = GAME_GENERATED_DIR / f"{args.preset}_zturbo_{seed}.png"
            dest_file.write_bytes(raw_bytes)
            # Canonical copy used by the game engine
            canonical = GAME_GENERATED_DIR / f"{args.preset}.png"
            canonical.write_bytes(raw_bytes)
            print(f"✓ Saved: {dest_file.name}")
            print(f"✓ Canonical: {canonical.name}")
            return 0
    
    print("✓ Texture generated (not copied to game folder)")
    return 0

if __name__ == "__main__":
    exit(main())
