"""
============================================================
AVISHU — ai/main.py
Python FastAPI service for AI model inference.

Endpoints:
  POST /predict          — Fabric quality check (your model)
  POST /analyze-texture  — Texture / pattern analysis
  GET  /health           — Health check

Run:
  pip install fastapi uvicorn pillow numpy
  uvicorn ai.main:app --host 0.0.0.0 --port 8000 --reload
============================================================
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn
import io
import time

# ── Optional imports (install when your models are ready) ──
try:
    from PIL import Image
    import numpy as np
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

# ── Plug in your own model here ──────────────────────────────
# from your_model_module import FabricQualityModel
# model = FabricQualityModel(weights="weights/fabric_v2.pt")
# ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="AVISHU AI Service",
    description="Fabric quality analysis and texture classification",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Response schemas ─────────────────────────────────────────

class QualityResult(BaseModel):
    score: int                    # 0–100 overall quality index
    material_class: str           # 'A+' | 'A' | 'B+' | 'B' | 'C'
    weave_uniformity: int         # 0–100 %
    thread_density: int           # 0–100 %
    surface_defects: str          # 'none' | 'minimal' | 'moderate' | 'severe'
    confidence: float             # 0.0 – 1.0
    processing_ms: int
    mock: bool = False            # True when real model is unavailable


class TextureResult(BaseModel):
    texture_type: str             # 'smooth' | 'rough' | 'knit' | 'woven' | 'denim'
    color_dominant: str           # hex color string
    pattern: str                  # 'solid' | 'striped' | 'checkered' | 'floral'
    confidence: float
    processing_ms: int


# ── Helpers ──────────────────────────────────────────────────

def load_image(upload: UploadFile) -> "Image.Image":
    """Read uploaded file into a PIL Image."""
    if not PIL_AVAILABLE:
        raise HTTPException(status_code=500, detail="PIL not installed")
    contents = upload.file.read()
    return Image.open(io.BytesIO(contents)).convert("RGB")


def mock_quality_result(processing_ms: int) -> QualityResult:
    """Return demo result when the real model is not loaded."""
    import random
    score = random.randint(75, 97)
    return QualityResult(
        score=score,
        material_class="A+" if score >= 90 else "A" if score >= 80 else "B+",
        weave_uniformity=random.randint(78, 96),
        thread_density=random.randint(74, 94),
        surface_defects="none" if score > 88 else "minimal",
        confidence=round(random.uniform(0.87, 0.98), 2),
        processing_ms=processing_ms,
        mock=True,
    )


# ── Endpoints ─────────────────────────────────────────────────

@app.get("/health")
def health():
    """Health check — used by Node.js server to verify AI service is up."""
    return {
        "status": "ok",
        "service": "AVISHU AI",
        "pil_available": PIL_AVAILABLE,
        # "model_loaded": model is not None,   # uncomment when model is plugged in
    }


@app.post("/predict", response_model=QualityResult)
async def predict_quality(image: UploadFile = File(...)):
    """
    Fabric quality analysis.

    ── How to plug in your model ────────────────────────────
    1. Load your model at module level (top of file):
         model = YourModel("weights/fabric_v2.pt")

    2. Replace the mock block below with:
         img   = load_image(image)
         arr   = preprocess(img)          # your preprocessing
         pred  = model.predict(arr)       # your inference call
         return QualityResult(
             score            = int(pred["score"] * 100),
             material_class   = pred["class"],
             weave_uniformity = int(pred["weave"] * 100),
             thread_density   = int(pred["density"] * 100),
             surface_defects  = pred["defects"],
             confidence       = float(pred["confidence"]),
             processing_ms    = int((time.time() - t0) * 1000),
         )
    ─────────────────────────────────────────────────────────
    """
    t0 = time.time()

    # Validate file type
    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # ── REPLACE THIS BLOCK WITH REAL MODEL INFERENCE ──────
    # img  = load_image(image)
    # pred = model.predict(preprocess(img))
    # ──────────────────────────────────────────────────────

    # Mock while model is not connected
    elapsed = int((time.time() - t0) * 1000)
    result  = mock_quality_result(elapsed)

    return result


@app.post("/analyze-texture", response_model=TextureResult)
async def analyze_texture(image: UploadFile = File(...)):
    """
    Texture and pattern classification.
    Plug in your texture model here.
    """
    t0 = time.time()

    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # ── REPLACE WITH REAL TEXTURE MODEL ───────────────────
    # img  = load_image(image)
    # pred = texture_model.predict(preprocess(img))
    # ──────────────────────────────────────────────────────

    import random
    elapsed = int((time.time() - t0) * 1000)
    return TextureResult(
        texture_type=random.choice(["smooth", "knit", "woven", "denim"]),
        color_dominant="#" + "".join([hex(random.randint(100, 200))[2:] for _ in range(3)]),
        pattern=random.choice(["solid", "striped", "checkered"]),
        confidence=round(random.uniform(0.82, 0.96), 2),
        processing_ms=elapsed,
    )


# ── Entry point ──────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
