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
const size = Number(args.size || 512);
const steps = Number(args.steps || 22);
const cfg = Number(args.cfg || 6.5);
const seed = Number(args.seed || Math.floor(Math.random() * 2147483647));
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
  "1": {
    inputs: {
      ckpt_name: checkpoint
    },
    class_type: "CheckpointLoaderSimple"
  },
  "2": {
    inputs: {
      text: preset.positive,
      clip: ["1", 1]
    },
    class_type: "CLIPTextEncode"
  },
  "3": {
    inputs: {
      text: preset.negative,
      clip: ["1", 1]
    },
    class_type: "CLIPTextEncode"
  },
  "4": {
    inputs: {
      width: size,
      height: size,
      batch_size: 1
    },
    class_type: "EmptyLatentImage"
  },
  "5": {
    inputs: {
      seed,
      steps,
      cfg,
      sampler_name: "euler",
      scheduler: "normal",
      denoise: 1,
      model: ["1", 0],
      positive: ["2", 0],
      negative: ["3", 0],
      latent_image: ["4", 0]
    },
    class_type: "KSampler"
  },
  "6": {
    inputs: {
      samples: ["5", 0],
      vae: ["1", 2]
    },
    class_type: "VAEDecode"
  },
  "7": {
    inputs: {
      filename_prefix: "puffin_texture",
      images: ["6", 0]
    },
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
  for (let i = 0; i < 240; i++) {
    const res = await fetch(`${endpoint}/history/${promptId}`);
    if (res.ok) {
      const data = await res.json();
      const item = data[promptId];
      const images = item?.outputs?.["7"]?.images;
      if (images?.length) return images[0];
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Timed out waiting for image result from ComfyUI");
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
  console.log(`seed=${seed} size=${size} steps=${steps} cfg=${cfg} preset=${presetName}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
