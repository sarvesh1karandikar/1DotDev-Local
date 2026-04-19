# Feature 3: AI Developer Portfolio Website

## Goal

Build a personal portfolio website with live, interactive demos of all ML/AI projects.
Runs locally (Next.js on port 4000), exposed publicly via Cloudflare Tunnel for
recruiter sharing. Demos are hosted on HuggingFace Spaces (free) and embedded as iframes.

---

## Sarvesh's Projects — Demo Status Assessment

From reading all CLAUDE.md files:

| Project | Demo-ability | Action needed |
|---|---|---|
| **1DotDev** | ✅ Live product | Screenshot + description only (private) |
| **chromadb-orm** | ✅ High | Run locally; add `/ask` endpoint; embed Swagger |
| **CNN CIFAR-10** | ✅ High | `app.py` (Gradio) exists → deploy to HF Spaces |
| **GANs CIFAR-10** | ✅ High | Pre-trained weights exist → Gradio app → HF Spaces |
| **RNN/LSTM** | 🟡 Medium | Add 15-line Gradio UI → HF Spaces |
| **Cricket NLP** | 🟡 Medium | Add `predict(text)` function → Gradio → HF Spaces |
| **Offspring Face** | 🔴 Low | Needs training run + GPU; use GIF demo |
| **Road Detection** | 🔴 Low | MATLAB only; use output images in README |

**Priority order:** Deploy CNN → GANs → RNN/LSTM first. They need no model training.
Cricket NLP needs a minor refactor. Offspring Face + Road Detection: showcase as
"research projects" with result screenshots, not live demos.

---

## Phase 1: Deploy Demos to HuggingFace Spaces

### 1a. CNN CIFAR-10 — Gradio app already exists (`app.py` in repo)

```bash
# Clone the repo
cd /home/sskgameon/sarvesh1karandikar
git clone https://github.com/sarvesh1karandikar/Object-Detection-using-CNN-on-CIFAR-10.git

# Test locally first
cd Object-Detection-using-CNN-on-CIFAR-10
pip install -r requirements.txt
python train.py       # trains and saves weights (~10 min on CPU / 1 min on GPU)
python app.py         # starts Gradio on localhost:7860
# Upload a test image, verify top-3 predictions appear
```

**Deploy to HuggingFace Spaces:**
```bash
# 1. Create a new Space at huggingface.co/new-space
#    Name: cifar10-classifier, SDK: Gradio, Hardware: CPU Basic (free)

# 2. Push the repo
git remote add hf https://huggingface.co/spaces/sarvesh1karandikar/cifar10-classifier
# Make sure app.py is at root, requirements.txt is present
git push hf main
```

`app.py` already exists in this repo (per README: `python app.py` → localhost:7860).
**No code changes needed.** Just push and it runs.

---

### 1b. GANs CIFAR-10 — Pre-trained weights exist; add Gradio app

Pre-trained weights are at `model/dcgan.*` in the repo. Need to create `app.py`:

```python
# app.py — create this file in sarvesh1karandikar/GANs-on-CIFAR-10-Dataset
import gradio as gr
import numpy as np

# Use the existing trained generator via the TF1 checkpoint.
# Since TF1 is complex, use a simpler approach: pre-generate 1000 sample images
# during app startup, then let users "roll" random ones.
# This avoids TF1 dependency entirely.

# Steps:
# 1. Run the notebook once locally to generate 1000 images → save as numpy array
# 2. app.py loads the .npy file and returns random samples on button click

import os
SAMPLES_FILE = "generated_samples.npy"

def load_or_generate_samples():
    if os.path.exists(SAMPLES_FILE):
        return np.load(SAMPLES_FILE)
    # If no samples file, return placeholder
    return np.zeros((100, 32, 32, 3), dtype=np.uint8)

samples = load_or_generate_samples()

CIFAR_CLASSES = ['airplane','automobile','bird','cat','deer','dog','frog','horse','ship','truck']

def generate_random():
    idx = np.random.randint(len(samples))
    img = (samples[idx] * 255).clip(0, 255).astype(np.uint8)
    return img

with gr.Blocks(title="CIFAR-10 GAN Generator") as demo:
    gr.Markdown("## CIFAR-10 GAN — Generated Images\nDCGAN trained from scratch on CIFAR-10")
    with gr.Row():
        with gr.Column():
            btn = gr.Button("Generate Random Image", variant="primary")
        with gr.Column():
            img_out = gr.Image(label="Generated image", width=256, height=256)
    btn.click(fn=generate_random, outputs=img_out)
    gr.Markdown("""
    **Architecture:** DCGAN with 4-layer generator and 3-layer discriminator.
    **Training:** 20 epochs on 50,000 CIFAR-10 images. Optimizer: RMSProp lr=1e-4.
    **Extras:** Includes activation maximization and image reconstruction capabilities.
    """)

demo.launch()
```

**To generate the samples file (run locally once, then commit):**
Run the existing GAN notebook to produce 1000 images, save with:
```python
np.save("generated_samples.npy", all_generated_images)
```

---

### 1c. RNN/LSTM Text Generation — Add minimal Gradio wrapper

The notebook already has the core model. Create `app.py`:

```python
# app.py for RNN-LSTM-for-sequential-text-generation
# Load pre-trained weights (need to add save/load to the notebook first)

import gradio as gr
import numpy as np
import pickle

# Load saved model weights and vocab
# (Train the model in notebook, then add: np.savez("weights.npz", **model_weights))
# (Also save: pickle.dump(vocab, open("vocab.pkl","wb")))

def generate_text(seed_word, length, temperature, cell_type):
    # placeholder until weights are saved
    return f"[{cell_type.upper()} model] Generating {length} words from '{seed_word}' at temp={temperature}...\n(Deploy weights to enable generation)"

with gr.Blocks(title="RNN/LSTM Text Generation") as demo:
    gr.Markdown("## RNN & LSTM — Sequential Text Generation\nFrom-scratch NumPy implementation trained on Alice in Wonderland")
    with gr.Row():
        seed = gr.Textbox(label="Seed word", value="she", max_lines=1)
        length = gr.Slider(10, 100, value=30, step=5, label="Words to generate")
        temperature = gr.Slider(0.5, 2.0, value=1.0, step=0.1, label="Temperature")
        cell = gr.Radio(["RNN", "LSTM"], value="LSTM", label="Cell type")
    btn = gr.Button("Generate", variant="primary")
    output = gr.Textbox(label="Generated text", lines=5)
    btn.click(fn=generate_text, inputs=[seed, length, temperature, cell], outputs=output)
    gr.Markdown("""
    **Model:** Pure NumPy — no PyTorch or TensorFlow.
    Forward pass, BPTT, and Adam optimizer all hand-coded.
    Achieves ~90.5% word-prediction accuracy after 50 epochs.
    """)

demo.launch()
```

**Before deploying:** Run the notebook, add weight-saving code, commit `weights.npz` + `vocab.pkl`.

---

### 1d. Cricket NLP — Add predict function + Gradio

The classifier needs a `predict(text) -> int` wrapper. Read `numericclassification.py`
to understand the feature extraction pipeline, then:

```python
# Add to numericclassification.py or create predict.py:
def predict_excitement(summary_text: str) -> dict:
    # Extract features using existing sentiment2.py functions
    # Run through the trained MLP
    # Return score + label
    labels = {1:"Dull", 2:"Below average", 3:"Average", 4:"Exciting", 5:"Classic Thriller"}
    score = ...  # existing MLP predict call
    return {"score": score, "label": labels[score]}
```

Then `app.py`:
```python
import gradio as gr
from predict import predict_excitement

EXAMPLE = """India vs Pakistan, ICC World Cup. After a tense start where Pakistan took 
early wickets, Virat Kohli anchored the chase with a masterful century. The match 
came down to the last over, with India needing 14 runs. Two sixes off consecutive 
balls sealed one of cricket's greatest upsets."""

def classify(text):
    result = predict_excitement(text)
    return f"Score: {result['score']}/5 — {result['label']}"

demo = gr.Interface(
    fn=classify,
    inputs=gr.Textbox(label="Match summary (100-300 words)", lines=8, value=EXAMPLE),
    outputs=gr.Textbox(label="Excitement rating"),
    title="Cricket Match Excitement Classifier",
    description="Paste a cricket match summary and get an excitement rating from 1 (dull) to 5 (classic thriller).",
)
demo.launch()
```

---

## Phase 2: Build the Portfolio Website (Next.js)

### Initialize

```bash
cd /home/sskgameon/sarvesh1karandikar
npx create-next-app@latest portfolio \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*"

cd portfolio
npm run dev   # → http://localhost:3000 (change to 4000 in package.json if needed)
```

Change port to 4000 in `package.json`:
```json
"scripts": {
  "dev": "next dev -p 4000",
  "start": "next start -p 4000"
}
```

---

### Site Structure

```
app/
├── page.tsx                  ← Home (hero + about + CTA)
├── projects/
│   └── page.tsx              ← Projects grid (all 8 projects)
├── projects/[slug]/
│   └── page.tsx              ← Individual project page with live demo
├── contact/
│   └── page.tsx              ← Contact info
└── components/
    ├── ProjectCard.tsx       ← Card component
    ├── HFSpaceEmbed.tsx      ← HuggingFace iframe wrapper
    └── Nav.tsx               ← Navigation
```

---

### Key Component: `HFSpaceEmbed.tsx`

HuggingFace Spaces can be embedded as iframes:

```tsx
// components/HFSpaceEmbed.tsx
interface Props {
  owner: string;   // "sarvesh1karandikar"
  space: string;   // "cifar10-classifier"
  height?: number;
}

export default function HFSpaceEmbed({ owner, space, height = 500 }: Props) {
  return (
    <iframe
      src={`https://huggingface.co/spaces/${owner}/${space}`}
      frameBorder="0"
      width="100%"
      height={height}
      className="rounded-xl border border-neutral-200 dark:border-neutral-700"
      allow="accelerometer; camera; microphone"
    />
  );
}
```

---

### Projects Data (single source of truth)

Create `lib/projects.ts`:

```ts
export const PROJECTS = [
  {
    slug: "whatsapp-ai-bridge",
    title: "1DotDev — WhatsApp AI Assistant",
    tagline: "Personal AI assistant over WhatsApp with reminders, notes, and NL routing",
    tags: ["Node.js", "Claude API", "WhatsApp", "SQLite"],
    github: "https://github.com/sarvesh1karandikar/1DotDev",
    demoType: "screenshot",   // no live demo (private WhatsApp)
    screenshot: "/demos/1dotdev.png",
    highlights: [
      "17 slash commands + natural-language routing via Haiku tool-use",
      "Per-user SQLite state: history, facts, todos, reminders, news digests",
      "End-to-end HMAC-SHA256 webhook security",
      "Runs on $5/mo AWS Lightsail (moving to local WSL)",
    ],
  },
  {
    slug: "rag-backend",
    title: "chromadb-orm — RAG Backend",
    tagline: "FastAPI backend for PDF/DOCX ingestion, semantic chunking, and vector retrieval",
    tags: ["FastAPI", "ChromaDB", "SentenceTransformers", "LangChain", "Python"],
    github: "https://github.com/sarvesh1karandikar/chromadb",
    demoType: "hf-space",
    hfSpace: "sarvesh1karandikar/rag-demo",  // create this space
    highlights: [
      "Centroid-based collection routing — documents cluster semantically",
      "768-dim dense embeddings via all-mpnet-base-v2",
      "Recursive chunking (1000 chars, 150 overlap)",
      "Model-agnostic: returns raw chunks for any LLM",
    ],
  },
  {
    slug: "cifar10-classifier",
    title: "CNN Image Classifier — CIFAR-10",
    tagline: "3-layer CNN achieving 75.1% accuracy from scratch in TensorFlow",
    tags: ["TensorFlow", "CNN", "Computer Vision", "Gradio"],
    github: "https://github.com/sarvesh1karandikar/Object-Detection-using-CNN-on-CIFAR-10",
    demoType: "hf-space",
    hfSpace: "sarvesh1karandikar/cifar10-classifier",
    highlights: [
      "75.1% test accuracy on 10 CIFAR-10 classes",
      "Custom architecture: 3 conv layers + exponential LR decay",
      "Interactive Gradio demo — upload any image",
    ],
  },
  {
    slug: "dcgan-cifar10",
    title: "DCGAN — Image Generation on CIFAR-10",
    tagline: "Deep Convolutional GAN with activation maximization and reconstruction",
    tags: ["TensorFlow", "GAN", "Generative AI", "Gradio"],
    github: "https://github.com/sarvesh1karandikar/GANs-on-CIFAR-10-Dataset",
    demoType: "hf-space",
    hfSpace: "sarvesh1karandikar/dcgan-cifar10",
    highlights: [
      "Standard DCGAN trained 20 epochs on 50K images",
      "Latent-space image reconstruction via gradient descent",
      "Activation maximization reveals discriminator learned features",
    ],
  },
  {
    slug: "rnn-lstm-textgen",
    title: "RNN & LSTM — Text Generation from Scratch",
    tagline: "Vanilla RNN and LSTM built entirely in NumPy — no PyTorch, no TensorFlow",
    tags: ["NumPy", "RNN", "LSTM", "NLP"],
    github: "https://github.com/sarvesh1karandikar/RNN-LSTM-for-sequential-text-generation",
    demoType: "hf-space",
    hfSpace: "sarvesh1karandikar/rnn-lstm-textgen",
    highlights: [
      "From-scratch: forward pass, BPTT, Adam optimizer — all in NumPy",
      "~90.5% word-prediction accuracy after 50 epochs",
      "Temperature sampling, RNN vs LSTM comparison",
    ],
  },
  {
    slug: "cricket-nlp",
    title: "Cricket Match Excitement Classifier",
    tagline: "5-class ordinal NLP classifier using hand-crafted features and MLP",
    tags: ["NLP", "scikit-learn", "Feature Engineering", "Sports Analytics"],
    github: "https://github.com/sarvesh1karandikar/NLP-Project",
    demoType: "hf-space",
    hfSpace: "sarvesh1karandikar/cricket-excitement",
    highlights: [
      "Domain-specific lexicons (excitement, controversy, rain, turn-of-play)",
      "WordNet-expanded feature vectors + TextBlob sentiment",
      "MLP with grid-search over 24 hidden layer configurations",
    ],
  },
  {
    slug: "offspring-face-generator",
    title: "Offspring Face Generator",
    tagline: "Dual-encoder CNN that predicts a child's face from both parents' photos",
    tags: ["TensorFlow", "Keras", "GAN", "Computer Vision"],
    github: "https://github.com/sarvesh1karandikar/Offspring-Face-Generator",
    demoType: "screenshot",
    screenshot: "/demos/offspring.png",
    highlights: [
      "Dual-encoder: two parallel CNN branches for father and mother",
      "Feature fusion via concatenation + Conv2DTranspose decoder",
      "DCGAN + WGAN-GP baseline; TF2 Keras encoder-decoder primary model",
    ],
  },
  {
    slug: "road-detection",
    title: "Road Pixel Detection from Satellite Images",
    tagline: "Classical CV pipeline: morphological ops + K-means segmentation",
    tags: ["MATLAB", "Computer Vision", "Image Processing"],
    github: "https://github.com/sarvesh1karandikar/Road-Pixel-Detection-from-Satellite-Images",
    demoType: "screenshot",
    screenshot: "/demos/road-detection.png",
    highlights: [
      "Two independent pipelines: connected component analysis + morphological K-means",
      "No deep learning — pure signal processing with deterministic results",
      "Custom Canny thinning implementation supporting 5 edge operators",
    ],
  },
] as const;

export type Project = (typeof PROJECTS)[number];
```

---

### Home Page (`app/page.tsx`)

Key sections:
1. **Hero** — Name, title ("AI/ML Engineer"), one-liner, GitHub + contact buttons
2. **Featured projects** — 3 cards (1DotDev, chromadb-orm, CNN CIFAR-10)
3. **Skills** — Python, TypeScript, TensorFlow, PyTorch, ChromaDB, Claude API, Node.js
4. **CTA** — "View all projects" button

---

### Project Page (`app/projects/[slug]/page.tsx`)

Each project page shows:
- Title, tags, GitHub link
- Bullet highlights from the PROJECTS array
- **Live demo iframe** (if `demoType === "hf-space"`)
- **Screenshot** (if `demoType === "screenshot"`)
- Architecture diagram (embed from README via iframe or copied markdown)

The iframe embed is the core portfolio differentiator — recruiters can **interact with the
model directly on the page** without installing anything.

---

### Styling Direction

Use Tailwind + shadcn/ui components. Color scheme: dark mode default, clean minimal.
No excessive animations. Focus on: fast load, readable project descriptions, prominent demo embeds.

Initialize shadcn:
```bash
npx shadcn@latest init
# Choose: Default style, Zinc base color, CSS variables: yes
npx shadcn@latest add button card badge
```

---

## Phase 3: Expose Portfolio Publicly

```bash
# Start portfolio in production mode
cd /home/sskgameon/sarvesh1karandikar/portfolio
npm run build
npm start &   # or via PM2

# Start a second ngrok tunnel for the portfolio
# (use a different static domain from the webhook domain)
ngrok http 4000 --domain=<portfolio-static-domain> &
```

Portfolio URL to share with recruiters: `https://<portfolio-static-domain>`

---

## Phase 4: Add to PM2

Update `infra/pm2/ecosystem.config.cjs` in the 1DotDev repo:

```js
{
  name: "portfolio",
  script: "node_modules/.bin/next",
  args: "start -p 4000",
  cwd: "/home/sskgameon/sarvesh1karandikar/portfolio",
  interpreter: "node",
  autorestart: true,
  watch: false,
},
```

---

## HuggingFace Spaces Deployment Checklist

For each HF Space:

```
[ ] Create Space at huggingface.co/new-space
    - Owner: sarvesh1karandikar
    - SDK: Gradio
    - Hardware: CPU Basic (free)

[ ] Push code:
    git remote add hf https://huggingface.co/spaces/sarvesh1karandikar/<name>
    git push hf main

[ ] Required files in repo root:
    - app.py          ← Gradio demo entry point
    - requirements.txt
    - (model weights if needed)

[ ] Test Space URL: https://huggingface.co/spaces/sarvesh1karandikar/<name>

[ ] Embed in portfolio: <HFSpaceEmbed owner="sarvesh1karandikar" space="<name>" />
```

---

## Build Order (suggested sequence)

1. **Day 1**: Deploy CNN CIFAR-10 to HF Spaces (app.py exists, just push)
2. **Day 1**: Create Next.js portfolio skeleton with home page
3. **Day 2**: Deploy GANs CIFAR-10 (generate samples, write app.py, push)
4. **Day 2**: Add project pages + HF iframe embeds
5. **Day 3**: Add weight-saving to RNN/LSTM notebook, write app.py, deploy
6. **Day 3**: Add predict wrapper to Cricket NLP, write app.py, deploy
7. **Day 4**: Polish: styling, mobile responsive, screenshots for non-demo projects
8. **Day 4**: Expose via ngrok, share URL
