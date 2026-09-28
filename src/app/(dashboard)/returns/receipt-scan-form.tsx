"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOrderFromReceipt } from "@/actions/returns";
import { canvasToJpegFile, clampCorners, detectCorners, warpToCanvas, type Point } from "@/lib/receipt-scanner";

type Stage = "camera" | "adjust" | "uploading";

const CORNER_LABELS = ["linksboven", "rechtsboven", "rechtsonder", "linksonder"];
const DETECT_INTERVAL_MS = 200;

// Photograph a physical (in-store) receipt with a live scanner view: the edge
// detection runs continuously on the camera feed (like a document-scanner
// app), the corners it last saw become the starting crop, and the user can
// still drag them straight before the photo is read.
export function ReceiptScanForm() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const liveFrameRef = useRef<HTMLDivElement>(null);
  const adjustFrameRef = useRef<HTMLDivElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragIndex = useRef<number | null>(null);

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("camera");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [liveCorners, setLiveCorners] = useState<[Point, Point, Point, Point] | null>(null);
  const [video, setVideo] = useState({ w: 0, h: 0 });
  const [liveDisplayed, setLiveDisplayed] = useState({ w: 1, h: 1 });

  const [captured, setCaptured] = useState<{ w: number; h: number } | null>(null);
  const [adjustDisplayed, setAdjustDisplayed] = useState({ w: 1, h: 1 });
  const [corners, setCorners] = useState<[Point, Point, Point, Point] | null>(null);

  // --- Camera lifecycle -----------------------------------------------
  useEffect(() => {
    if (stage !== "camera") return;
    let cancelled = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("no-camera-api");
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        if (!cancelled) setCameraError("denied");
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [stage]);

  function onVideoReady() {
    const v = videoRef.current;
    if (!v) return;
    setVideo({ w: v.videoWidth, h: v.videoHeight });
    setCameraReady(true);
  }

  // Live edge detection loop, throttled — runs on the video feed while
  // camera stage is active.
  useEffect(() => {
    if (stage !== "camera" || !cameraReady) return;
    const id = window.setInterval(() => {
      const v = videoRef.current;
      const frame = liveFrameRef.current;
      if (!v || v.videoWidth === 0 || !frame) return;
      setLiveDisplayed({ w: frame.clientWidth, h: frame.clientHeight });
      setLiveCorners(detectCorners(v, v.videoWidth, v.videoHeight));
    }, DETECT_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [stage, cameraReady]);

  function takePhoto() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    captureCanvasRef.current = canvas;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    setCaptured({ w: v.videoWidth, h: v.videoHeight });
    setCorners(liveCorners ?? detectCorners(canvas, v.videoWidth, v.videoHeight));
    setStage("adjust");
  }

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
    setStage("camera");
    setCameraReady(false);
    setCameraError(null);
    setLiveCorners(null);
    setCaptured(null);
    setCorners(null);
    captureCanvasRef.current = null;
    setError(null);
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
      {stage === "camera" && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Richt de camera op de bon — de randen worden automatisch gevolgd. Tik op de knop zodra de bon goed in
            beeld staat.
          </p>

          {cameraError ? (
            <div className="space-y-2">
              <p className="text-sm text-amber-700">
                {cameraError === "denied"
                  ? "Geen toegang tot de camera. Zet cameratoegang aan voor deze app, of kies een foto."
                  : "Live camera wordt niet ondersteund op dit apparaat. Kies een foto."}
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
                Foto kiezen
              </label>
            </div>
          ) : (
            <>
              <div ref={liveFrameRef} className="relative w-full overflow-hidden rounded-xl bg-gray-900">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={onVideoReady}
                  className="block w-full"
                />
                {cameraReady && liveCorners && video.w > 0 && (
                  <svg
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    viewBox={`0 0 ${liveDisplayed.w} ${liveDisplayed.h}`}
                  >
                    <polygon
                      points={liveCorners
                        .map((p) => `${(p.x / video.w) * liveDisplayed.w},${(p.y / video.h) * liveDisplayed.h}`)
                        .join(" ")}
                      className="fill-teal-400/15 stroke-teal-400"
                      strokeWidth={3}
                    />
                  </svg>
                )}
                {!cameraReady && (
                  <p className="absolute inset-0 flex items-center justify-center text-sm text-gray-300">
                    Camera starten…
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={!cameraReady}
                onClick={takePhoto}
                className="min-h-[52px] w-full rounded-xl bg-teal-700 text-base font-medium text-white active:bg-teal-800 disabled:opacity-50"
              >
                Foto maken
              </button>
            </>
          )}
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
