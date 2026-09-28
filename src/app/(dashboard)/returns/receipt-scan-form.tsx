"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOrderFromReceipt } from "@/actions/returns";
import { canvasToJpegFile, clampCorners, detectCorners, warpToCanvas, type Point } from "@/lib/receipt-scanner";

type Stage = "pick" | "adjust";

const CORNER_LABELS = ["linksboven", "rechtsboven", "rechtsonder", "linksonder"];

// Photograph a physical (in-store) receipt: pick a photo (the phone's own
// camera app gives the sharpest result), adjust the four corners to crop it
// straight, and optionally fill in the return term by hand — a printed
// return term is often easier to just read and type than to trust OCR on.
export function ReceiptScanForm() {
  const router = useRouter();
  const adjustFrameRef = useRef<HTMLDivElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragIndex = useRef<number | null>(null);

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("pick");

  const [captured, setCaptured] = useState<{ w: number; h: number } | null>(null);
  const [adjustDisplayed, setAdjustDisplayed] = useState({ w: 1, h: 1 });
  const [corners, setCorners] = useState<[Point, Point, Point, Point] | null>(null);

  const [manualDeadline, setManualDeadline] = useState("");
  const [manualWindowDays, setManualWindowDays] = useState("");

  function handleFilePicked(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      captureCanvasRef.current = canvas;
      setCaptured({ w: img.naturalWidth, h: img.naturalHeight });
      setCorners(detectCorners(canvas, img.naturalWidth, img.naturalHeight));
      setStage("adjust");
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  }

  function reset() {
    setStage("pick");
    setCaptured(null);
    setCorners(null);
    captureCanvasRef.current = null;
    setError(null);
    setManualDeadline("");
    setManualWindowDays("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // --- Corner dragging on the captured still ---------------------------
  useEffect(() => {
    if (stage !== "adjust" || !captured) return;
    const frame = adjustFrameRef.current;
    if (frame) setAdjustDisplayed({ w: frame.clientWidth, h: frame.clientHeight });
  }, [stage, captured]);

  const adjustScaleX = captured ? adjustDisplayed.w / captured.w : 1;
  const adjustScaleY = captured ? adjustDisplayed.h / captured.h : 1;

  useEffect(() => {
    function move(e: PointerEvent) {
      if (dragIndex.current == null || !corners || !captured || !adjustFrameRef.current) return;
      const rect = adjustFrameRef.current.getBoundingClientRect();
      const p: Point = { x: (e.clientX - rect.left) / adjustScaleX, y: (e.clientY - rect.top) / adjustScaleY };
      const next = [...corners] as [Point, Point, Point, Point];
      next[dragIndex.current] = p;
      setCorners(clampCorners(next, captured.w, captured.h));
    }
    function up() {
      dragIndex.current = null;
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [corners, captured, adjustScaleX, adjustScaleY]);

  function confirmCrop() {
    if (!captureCanvasRef.current || !corners || !captured) return;
    setError(null);
    startTransition(async () => {
      try {
        const cropped = warpToCanvas(captureCanvasRef.current!, captured.w, captured.h, corners);
        const file = await canvasToJpegFile(cropped, "bon.jpg");
        const formData = new FormData();
        formData.set("file", file);
        if (manualDeadline) formData.set("manualDeadline", manualDeadline);
        else if (manualWindowDays) formData.set("manualWindowDays", manualWindowDays);
        const r = await createOrderFromReceipt(formData);
        setResult(`${r.merchant} toegevoegd — retour vóór ${new Date(r.deadline).toLocaleDateString("nl-NL")}.`);
        reset();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Bonnetje lezen mislukt");
      }
    });
  }

  return (
    <div className="space-y-3">
      {stage === "pick" && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Maak een foto van een kassabon. De app leest winkel, artikelen en bedrag — de retourtermijn mag je ook
            gewoon zelf intypen, dat gaat vaak sneller dan dat de app hem van de bon leest.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handleFilePicked(e.target.files?.[0])}
            className="hidden"
            id="receipt-file-input"
          />
          <label
            htmlFor="receipt-file-input"
            className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800"
          >
            Bonnetje fotograferen
          </label>
        </div>
      )}

      {stage === "adjust" && captured && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Klopt het niet helemaal? Sleep de hoekpunten recht op de randen.</p>
          <div
            ref={adjustFrameRef}
            className="relative w-full select-none overflow-hidden rounded-xl bg-gray-900"
            style={{ touchAction: "none", aspectRatio: `${captured.w} / ${captured.h}` }}
          >
            {captureCanvasRef.current && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={captureCanvasRef.current.toDataURL("image/jpeg", 0.7)}
                alt="Gefotografeerde bon"
                className="block w-full"
                draggable={false}
              />
            )}
            {corners && (
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox={`0 0 ${adjustDisplayed.w} ${adjustDisplayed.h}`}
              >
                <polygon
                  points={corners.map((p) => `${p.x * adjustScaleX},${p.y * adjustScaleY}`).join(" ")}
                  className="fill-teal-400/20 stroke-teal-400"
                  strokeWidth={2}
                />
              </svg>
            )}
            {corners &&
              corners.map((p, i) => (
                <div
                  key={i}
                  role="slider"
                  aria-label={`Hoekpunt ${CORNER_LABELS[i]}`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    dragIndex.current = i;
                  }}
                  className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center"
                  style={{ left: p.x * adjustScaleX, top: p.y * adjustScaleY }}
                >
                  <div className="h-6 w-6 rounded-full border-4 border-teal-500 bg-white shadow" />
                </div>
              ))}
          </div>

          <div className="space-y-2 rounded-xl bg-gray-50 p-3">
            <p className="text-sm font-medium text-gray-700">Retourtermijn (optioneel)</p>
            <p className="text-xs text-gray-500">
              Leeg laten = de app probeert de termijn van de bon of van de winkel te bepalen.
            </p>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              Retour vóór
              <input
                type="date"
                value={manualDeadline}
                onChange={(e) => {
                  setManualDeadline(e.target.value);
                  if (e.target.value) setManualWindowDays("");
                }}
                className="min-h-[44px] flex-1 rounded-lg border border-gray-300 bg-white px-2 text-gray-900"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              Of: aantal dagen bedenktijd
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={manualWindowDays}
                onChange={(e) => {
                  setManualWindowDays(e.target.value);
                  if (e.target.value) setManualDeadline("");
                }}
                placeholder="bijv. 30"
                className="min-h-[44px] w-24 rounded-lg border border-gray-300 bg-white px-2 text-gray-900"
              />
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={confirmCrop}
              className="min-h-[48px] flex-1 rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
            >
              {isPending ? "Bonnetje lezen…" : "Uitsnijden en doorgaan"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={reset}
              className="min-h-[48px] rounded-xl border border-gray-300 bg-white px-4 text-base text-gray-800 disabled:opacity-50"
            >
              Opnieuw
            </button>
          </div>
        </div>
      )}

      {result && <p className="text-sm text-teal-700">{result}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
