import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";

type Props = {
  src: string;
  aspect: number;
  maxOutputWidth: number;
  outputType?: string;
  outputQuality?: number;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
};

type Crop = { x: number; y: number; w: number; h: number };

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export default function ImageCropper({
  src,
  aspect,
  maxOutputWidth,
  outputType = "image/jpeg",
  outputQuality = 0.9,
  onCancel,
  onConfirm,
}: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [displaySize, setDisplaySize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [crop, setCrop] = useState<Crop | null>(null);
  const [processing, setProcessing] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; cropX: number; cropY: number } | null>(null);

  function maxCropForAspect(w: number, h: number): Crop {
    let cw = w;
    let ch = cw / aspect;
    if (ch > h) {
      ch = h;
      cw = ch * aspect;
    }
    return { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch };
  }

  useEffect(() => {
    function onResize() {
      if (!stageRef.current || !natural) return;
      const containerW = stageRef.current.clientWidth;
      const maxH = Math.min(window.innerHeight * 0.6, 480);
      const scale = Math.min(containerW / natural.w, maxH / natural.h, 1);
      setDisplaySize({ w: natural.w * scale, h: natural.h * scale });
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [natural]);

  function handleImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setNatural({ w, h });
    setCrop(maxCropForAspect(w, h));
  }

  function clampCrop(c: Crop): Crop {
    if (!natural) return c;
    const w = clamp(c.w, 32, natural.w);
    const h = w / aspect;
    const finalH = h > natural.h ? natural.h : h;
    const finalW = h > natural.h ? natural.h * aspect : w;
    return {
      w: finalW,
      h: finalH,
      x: clamp(c.x, 0, natural.w - finalW),
      y: clamp(c.y, 0, natural.h - finalH),
    };
  }

  const scale = natural && displaySize.w ? displaySize.w / natural.w : 1;

  function onPointerDown(e: RPointerEvent<HTMLDivElement>) {
    if (!crop) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, cropX: crop.x, cropY: crop.y };
  }
  function onPointerMove(e: RPointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !crop || !natural) return;
    const dx = (e.clientX - dragRef.current.startX) / scale;
    const dy = (e.clientY - dragRef.current.startY) / scale;
    setCrop(clampCrop({ ...crop, x: dragRef.current.cropX + dx, y: dragRef.current.cropY + dy }));
  }
  function onPointerUp(e: RPointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  }

  function onSizeChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!crop || !natural) return;
    const pct = Number(e.target.value) / 100;
    const max = maxCropForAspect(natural.w, natural.h);
    const minW = Math.max(64, max.w * 0.2);
    const newW = minW + (max.w - minW) * pct;
    const newH = newW / aspect;
    const cx = crop.x + crop.w / 2;
    const cy = crop.y + crop.h / 2;
    setCrop(clampCrop({ x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH }));
  }

  async function handleConfirm() {
    if (!crop || !natural || !imgRef.current) return;
    setProcessing(true);
    try {
      const outW = Math.min(maxOutputWidth, Math.round(crop.w));
      const outH = Math.round(outW / aspect);
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      if (outputType === "image/jpeg") {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, outW, outH);
      }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(imgRef.current, crop.x, crop.y, crop.w, crop.h, 0, 0, outW, outH);
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), outputType, outputQuality),
      );
      if (!blob) throw new Error("Falha ao processar a imagem.");
      onConfirm(blob);
    } catch (err) {
      console.error(err);
      setProcessing(false);
    }
  }

  const sizePct = (() => {
    if (!crop || !natural) return 100;
    const max = maxCropForAspect(natural.w, natural.h);
    const minW = Math.max(64, max.w * 0.2);
    if (max.w === minW) return 100;
    return Math.round(((crop.w - minW) / (max.w - minW)) * 100);
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Recortar imagem"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E0E3EB] flex items-center justify-between">
          <h3 className="font-bold text-[#0D0D0D]">Recortar imagem (16:9)</h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-[#7A7F8C] hover:text-[#0D0D0D] text-sm"
          >
            Fechar
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div
            ref={stageRef}
            className="relative w-full bg-[#0D0D0D] rounded-lg overflow-hidden flex items-center justify-center select-none"
            style={{ minHeight: 240 }}
          >
            <div
              className="relative"
              style={{ width: displaySize.w || "auto", height: displaySize.h || "auto" }}
            >
              <img
                ref={imgRef}
                src={src}
                alt=""
                onLoad={handleImgLoad}
                draggable={false}
                style={{
                  display: "block",
                  width: displaySize.w || "auto",
                  height: displaySize.h || "auto",
                  maxHeight: "60vh",
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />
              {crop && natural && (
                <>
                  <div
                    className="absolute inset-0"
                    style={{
                      boxShadow: `0 0 0 9999px rgba(0,0,0,0.55)`,
                      clipPath: `polygon(
                        0 0, 100% 0, 100% 100%, 0 100%, 0 0,
                        ${crop.x * scale}px ${crop.y * scale}px,
                        ${crop.x * scale}px ${(crop.y + crop.h) * scale}px,
                        ${(crop.x + crop.w) * scale}px ${(crop.y + crop.h) * scale}px,
                        ${(crop.x + crop.w) * scale}px ${crop.y * scale}px,
                        ${crop.x * scale}px ${crop.y * scale}px
                      )`,
                      pointerEvents: "none",
                    }}
                  />
                  <div
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    className="absolute cursor-move touch-none"
                    style={{
                      left: crop.x * scale,
                      top: crop.y * scale,
                      width: crop.w * scale,
                      height: crop.h * scale,
                      border: "2px solid #FFFFFF",
                      boxShadow: "0 0 0 1px rgba(0,64,255,0.6)",
                    }}
                  >
                    <div className="absolute inset-0 pointer-events-none" aria-hidden>
                      <div className="absolute left-0 right-0 top-1/3 border-t border-white/40" />
                      <div className="absolute left-0 right-0 top-2/3 border-t border-white/40" />
                      <div className="absolute top-0 bottom-0 left-1/3 border-l border-white/40" />
                      <div className="absolute top-0 bottom-0 left-2/3 border-l border-white/40" />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#7A7F8C] uppercase tracking-wide">
              Tamanho do recorte
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={sizePct}
              onChange={onSizeChange}
              className="w-full accent-[#0040FF]"
              aria-label="Tamanho do recorte"
            />
            <p className="text-xs text-[#7A7F8C]">
              Arraste a área destacada para reposicionar. A imagem será redimensionada para no máximo {maxOutputWidth}px de largura.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E0E3EB]">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[#7A7F8C] hover:text-[#0D0D0D] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!crop || processing}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: "#0040FF" }}
            >
              {processing ? "Processando..." : "Aplicar recorte"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
