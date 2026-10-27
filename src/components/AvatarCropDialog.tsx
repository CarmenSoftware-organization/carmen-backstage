import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from './ui/dialog';
import { useI18n } from '../hooks/useI18n';

/** ขนาดช่องมอง (px) — วงกลมเต็มช่องนี้ ไม่ใช่ขนาดของไฟล์ที่ได้ */
const VIEWPORT = 256;
const MAX_ZOOM = 4;

interface AvatarCropDialogProps {
  /** ไฟล์ที่ผู้ใช้เพิ่งเลือก — null = ปิด dialog */
  file: File | null;
  label: string;
  /** ด้านยาวสุดของไฟล์ผลลัพธ์ (px) รูปที่เล็กกว่านี้ไม่ถูกขยาย */
  outputSize: number;
  onCancel: () => void;
  onConfirm: (cropped: File) => Promise<void>;
}

interface Pos { x: number; y: number }

/**
 * ตัด avatar เป็นจัตุรัสด้วยกรอบวงกลมก่อนอัปโหลด — ลากเพื่อเลื่อน ใช้แถบเลื่อนซูม ปุ่มลูกศรเลื่อนทีละ 8px
 *
 * ไฟล์ที่ได้เป็นจัตุรัส (ไม่ใช่วงกลมโปร่งใส): ทุกที่ที่แสดง avatar ใส่ rounded-full + object-cover
 * อยู่แล้ว การตัดเป็นจัตุรัสจึงให้ผลบนจอเหมือนวงกลมทุกจุด โดยไม่บังคับให้ JPEG ต้องกลายเป็น PNG
 *
 * เขียนเองแทน library crop — กฎของ repo ห้ามเพิ่ม dependency โดยไม่ถาม และงานนี้ต้องการแค่
 * pan + zoom บนช่องจัตุรัสเดียว
 */
export function AvatarCropDialog({ file, label, outputSize, onCancel, onConfirm }: AvatarCropDialogProps) {
  const { t } = useI18n();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState<Pos>({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const drag = useRef<{ id: number; start: Pos; origin: Pos } | null>(null);

  useEffect(() => {
    setImg(null);
    setFailed(false);
    setZoom(1);
    if (!file) return;
    const url = URL.createObjectURL(file);
    const el = new Image();
    let alive = true;
    el.onload = () => {
      if (!alive) return;
      const s = VIEWPORT / Math.min(el.naturalWidth, el.naturalHeight);
      setPos({ x: (VIEWPORT - el.naturalWidth * s) / 2, y: (VIEWPORT - el.naturalHeight * s) / 2 });
      setImg(el);
    };
    el.onerror = () => { if (alive) setFailed(true); };
    el.src = url;
    return () => { alive = false; URL.revokeObjectURL(url); };
  }, [file]);

  // scale ที่ zoom = 1 คือ "cover": ด้านสั้นของรูปพอดีช่องมอง
  const scaleFor = (z: number) => (img ? (VIEWPORT / Math.min(img.naturalWidth, img.naturalHeight)) * z : 1);
  const scale = scaleFor(zoom);
  const w = img ? img.naturalWidth * scale : 0;
  const h = img ? img.naturalHeight * scale : 0;

  // รูปต้องคลุมช่องมองเต็มเสมอ — ห้ามมีขอบว่างโผล่ในวงกลม
  const clamp = (p: Pos, cw = w, ch = h): Pos => ({
    x: Math.min(0, Math.max(VIEWPORT - cw, p.x)),
    y: Math.min(0, Math.max(VIEWPORT - ch, p.y)),
  });

  const changeZoom = (next: number) => {
    if (!img) return;
    // ซูมรอบจุดกลางช่องมอง ไม่ใช่มุมซ้ายบน — จุดที่ผู้ใช้กำลังดูอยู่ต้องอยู่กับที่
    const ratio = scaleFor(next) / scale;
    const c = VIEWPORT / 2;
    const p = { x: c - (c - pos.x) * ratio, y: c - (c - pos.y) * ratio };
    setZoom(next);
    setPos(clamp(p, img.naturalWidth * scaleFor(next), img.naturalHeight * scaleFor(next)));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!img) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, start: { x: e.clientX, y: e.clientY }, origin: pos };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setPos(clamp({ x: d.origin.x + e.clientX - d.start.x, y: d.origin.y + e.clientY - d.start.y }));
  };
  const onPointerUp = () => { drag.current = null; };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = 8;
    const delta: Record<string, Pos> = {
      ArrowLeft: { x: step, y: 0 }, ArrowRight: { x: -step, y: 0 },
      ArrowUp: { x: 0, y: step }, ArrowDown: { x: 0, y: -step },
    };
    const dd = delta[e.key];
    if (!dd) return;
    e.preventDefault();
    setPos((p) => clamp({ x: p.x + dd.x, y: p.y + dd.y }));
  };

  const confirm = async () => {
    if (!img || !file) return;
    const srcSize = VIEWPORT / scale;
    const out = Math.max(1, Math.min(outputSize, Math.round(srcSize)));
    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, -pos.x / scale, -pos.y / scale, srcSize, srcSize, 0, 0, out, out);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, file.type, 0.9));
    if (!blob) return;
    setSaving(true);
    try {
      await onConfirm(new File([blob], file.name, { type: blob.type || file.type, lastModified: Date.now() }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!file} onOpenChange={(open) => { if (!open && !saving) onCancel(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('common.upload.cropTitle', { label: label.toLowerCase() })}</DialogTitle>
          <DialogDescription>{t('common.upload.cropDescription')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {/* button ไม่ใช่ div: ต้องรับ focus + ลูกศรได้ และ jsx-a11y ไม่ยอมให้ element ที่ไม่ใช่ตัวโต้ตอบรับ event
              ป้ายบอกวิธีใช้ (ลาก/ลูกศร) ไม่ใช่ชื่อรูป เพราะสิ่งที่ผู้ใช้ทำกับมันคือการเลื่อน */}
          <button
            type="button"
            aria-label={t('common.upload.cropDescription')}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
            className="bg-muted focus-visible:ring-ring relative block cursor-grab touch-none overflow-hidden rounded-md select-none focus-visible:ring-2 focus-visible:outline-hidden active:cursor-grabbing"
            style={{ width: VIEWPORT, height: VIEWPORT }}
          >
            {img && (
              <img
                src={img.src}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none"
                style={{ left: pos.x, top: pos.y, width: w, height: h }}
              />
            )}
            {!img && !failed && (
              <div className="absolute inset-0 grid place-items-center">
                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
              </div>
            )}
            {failed && (
              <p className="text-destructive absolute inset-0 grid place-items-center p-4 text-center text-sm">
                {t('common.upload.cropLoadFailed')}
              </p>
            )}
            {/* หน้ากากวงกลม: เงาขนาดใหญ่รอบวงกลมทำให้ส่วนนอกวงทึบลง ส่วนในวงคือสิ่งที่จะได้ */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/80 shadow-[0_0_0_9999px_hsl(var(--foreground)/0.55)]"
            />
          </button>

          <label className="flex w-full items-center gap-3 text-sm">
            <span className="text-muted-foreground w-12 shrink-0 text-xs">{t('common.upload.cropZoom')}</span>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              disabled={!img}
              onChange={(e) => changeZoom(Number(e.target.value))}
              className="accent-primary w-full"
            />
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={() => void confirm()} disabled={!img || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? t('common.busy.uploading') : t('common.upload.cropConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
