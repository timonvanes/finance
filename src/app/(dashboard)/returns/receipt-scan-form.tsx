"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOrderFromReceipt } from "@/actions/returns";
import {
  autoDetectCorners,
  canvasToJpegFile,
  clampCorners,
  warpToCanvas,
  type Point,
} from "@/lib/receipt-scanner";

type Stage = "pick" | "adjust" | "uploading";

const CORNER_LABELS = ["linksboven", "rechtsboven", "rechtsonder", "linksonder"];

// Photograph a physical (in-store) receipt: detect its edges, let the user
// drag the four corners straight, then warp it flat before it's read — the
// same idea as a document-scanner app, done in canvas with no dependency.
export function ReceiptScanForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("pick");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState({ w: 1, h: 1 });
  const [displayed, setDisplayed] = useState({ w: 1, h: 1 });
  const [corners, setCorners] = useState<[Point, Point, Point, Point] | null>(null);
  const dragIndex = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  function reset() {
    setStage("pick");
    setCorners(null);
    setError(null);
    setResult(null);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    setImageUrl(URL.createObjectURL(file));
    setStage("adjust");
  }

  function onImageLoad() {
    const img = imgRef.current;
    const frame = frameRef.current;
    if (!img || !frame) return;
    setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    setDisplayed({ w: frame.clientWidth, h: frame.clientHeight });
    setCorners(autoDetectCorners(img));
  }

  // Scale between natural image pixels and the on-screen displayed size.
  const scaleX = displayed.w / natural.w;
  const scaleY = displayed.h / natural.h;

  function pointFromEvent(e: PointerEvent | React.PointerEvent): Point {
    const rect = frameRef.current!.getBoundingClientRect();
    return {
      x: ((e as PointerEvent).clientX - rect.left) / scaleX,
      y: ((e as PointerEvent).clientY - rect.top) / scaleY,
    };
  }

  useEffect(() => {
    function move(e: PointerEvent) {
      if (dragIndex.current == null || !corners) return;
      const p = pointFromEvent(e);
      const next = [...corners] as [Point, Point, Point, Point];
      next[dragIndex.current] = p;
      setCorners(clampCorners(next, natural.w, natural.h));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corners, natural, scaleX, scaleY]);

  function confirmCrop() {
    if (!imgRef.current || !corners) return;
    setError(null);
    startTransition(async () => {
      try {
        const canvas = warpToCanvas(imgRef.current!, corners);
        const file = await canvasToJpegFile(canvas, "bon.jpg");
        const formData = new FormData();
        formData.set("file", file);
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
        <>
          <p className="text-sm text-gray-600">
            Maak een foto van een kassabon. Je kunt de randen daarna aanpassen — de app leest winkel, artikelen,
            bedrag en de retourtermijn die erop staat.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="hidden"
            id="receipt-file-input"
          />
          <label
            htmlFor="receipt-file-input"
            className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800"
          >
            Bonnetje fotograferen
          </label>
        </>
      )}

      {stage === "adjust" && imageUrl && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Sleep de vier hoekpunten zodat ze precies op de randen van de bon liggen.
          </p>
          <div
            ref={frameRef}
            className="relative w-full select-none overflow-hidden rounded-xl bg-gray-900"
            style={{ touchAction: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Gefotografeerde bon"
              onLoad={onImageLoad}
              className="block w-full"
              draggable={false}
            />
            {corners && (
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox={`0 0 ${displayed.w} ${displayed.h}`}
              >
                <polygon
                  points={corners.map((p) => `${p.x * scaleX},${p.y * scaleY}`).join(" ")}
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
                  className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center touch-none"
                  style={{ left: p.x * scaleX, top: p.y * scaleY }}
                >
                  <div className="h-6 w-6 rounded-full border-4 border-teal-500 bg-white shadow" />
                </div>
              ))}
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
