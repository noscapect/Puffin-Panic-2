import fs from "node:fs/promises";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [k, ...rest] = arg.replace(/^--/, "").split("=");
    return [k, rest.join("=") || true];
  })
);

const endpoint = (args.endpoint || process.env.COMFYUI_URL || "http://127.0.0.1:8188").replace(/\/$/, "");
const presetName = args.preset || "water";
const size = Number(args.size || 1024);
const steps = Number(args.steps || 9);
const cfg = Number(args.cfg || 1.2);
const seed = Number(args.seed || Math.floor(Math.random() * 2147483647));
const timeoutSec = Number(args.timeout || 900);
const checkpoint = args.ckpt || "zImageTurbo_turbo.safetensors";
const outputName = args.out || `${presetName}_${Date.now()}.png`;

const presetPath = path.resolve("scripts", "texture-presets.json");
const presets = JSON.parse(await fs.readFile(presetPath, "utf8"));
const preset = presets[presetName];
if (!preset) {
  console.error(`Unknown preset '${presetName}'. Available: ${Object.keys(presets).join(", ")}`);
  process.exit(1);
}

const workflow = {
  // Load zImageTurbo model (model only — no embedded CLIP/VAE)
  "1": {
    inputs: { ckpt_name: checkpoint },
    class_type: "CheckpointLoaderSimple"
  },
  // Load CLIP separately (Qwen 3 4B, lumina2 type required by zImageTurbo)
  "2": {
    inputs: { clip_name: "qwen_3_4b_fp8_mixed.safetensors", type: "lumina2" },
    class_type: "CLIPLoader"
  },
  // Load VAE separately
  "3": {
    inputs: { vae_name: "ae_zim.safetensors" },
    class_type: "VAELoader"
  },
  // Wrap model with flow-based sampling (shift=3)
  "4": {
    inputs: { model: ["1", 0], shift: 3.0 },
    class_type: "ModelSamplingAuraFlow"
  },
  // Positive prompt
  "5": {
    inputs: { text: preset.positive, clip: ["2", 0] },
    class_type: "CLIPTextEncode"
  },
  // Negative prompt
  "6": {
    inputs: { text: preset.negative, clip: ["2", 0] },
    class_type: "CLIPTextEncode"
  },
  // Latent image
  "7": {
    inputs: { width: size, height: size, batch_size: 1 },
    class_type: "EmptyLatentImage"
  },
  // KSampler: euler_flow + zimage_turbo scheduler
  "8": {
    inputs: {
      seed, steps, cfg,
      sampler_name: "euler_flow",
      scheduler: "zimage_turbo",
      denoise: 1.0,
      model: ["4", 0],
      positive: ["5", 0],
      negative: ["6", 0],
      latent_image: ["7", 0]
    },
    class_type: "KSampler"
  },
  // VAE Decode using separate VAE
  "9": {
    inputs: { samples: ["8", 0], vae: ["3", 0] },
    class_type: "VAEDecode"
  },
  // Save output
  "10": {
    inputs: { filename_prefix: "puffin_texture", images: ["9", 0] },
    class_type: "SaveImage"
  }
};

async function queuePrompt() {
  const res = await fetch(`${endpoint}/prompt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: workflow })
  });
  if (!res.ok) throw new Error(`Queue failed: ${res.status}`);
  return res.json();
}

async function waitForImage(promptId) {
  const started = Date.now();
  const maxPolls = Math.max(1, timeoutSec);
  for (let i = 0; i < maxPolls; i++) {
    const res = await fetch(`${endpoint}/history/${promptId}`);
    if (res.ok) {
      const data = await res.json();
      const item = data[promptId];
      const images = item?.outputs?.["10"]?.images;
      if (images?.length) return images[0];
    }
    if ((i + 1) % 10 === 0) {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      console.log(`  waiting... ${elapsed}s`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timed out waiting for image result from ComfyUI after ${timeoutSec}s`);
}

async function downloadImage(meta) {
  const params = new URLSearchParams({
    filename: meta.filename,
    subfolder: meta.subfolder || "",
    type: meta.type || "output"
  });
  const res = await fetch(`${endpoint}/view?${params.toString()}`);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  console.log(`Generating '${presetName}' texture via ${endpoint}`);
  const { prompt_id: promptId } = await queuePrompt();
  if (!promptId) throw new Error("No prompt_id returned by ComfyUI");

  const meta = await waitForImage(promptId);
  const bytes = await downloadImage(meta);

  const outDir = path.resolve("img", "generated");
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, outputName);
  await fs.writeFile(outPath, bytes);

  console.log(`Saved texture: ${outPath}`);
  console.log(`seed=${seed} size=${size} steps=${steps} cfg=${cfg} timeout=${timeoutSec}s preset=${presetName}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
