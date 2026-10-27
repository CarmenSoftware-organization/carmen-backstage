/**
 * ย่อรูปให้กว้างไม่เกิน `maxWidth` ก่อนอัปโหลด — ความสูงคำนวณจากสัดส่วนเดิมของรูป
 * (h × maxWidth / w) ภาพจึงไม่ถูกยืดหรือบีบ และไม่มีการ crop
 *
 * - รูปที่กว้างไม่เกินอยู่แล้วคืนไฟล์เดิมตัวเดิม ไม่ encode ซ้ำ (encode ซ้ำมีแต่เสียคุณภาพ)
 * - ชนิดไฟล์คงเดิม: PNG ยังเป็น PNG เพื่อรักษาพื้นหลังโปร่งใสของโลโก้, JPEG/WEBP ใช้ quality 0.85
 * - decode ไม่ได้ (ไฟล์เสีย, browser ไม่รองรับ) → throw ให้ผู้เรียกตัดสินเอง
 */
export async function resizeImageToMaxWidth(file: File, maxWidth: number, quality = 0.85): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image decode failed'));
      el.src = url;
    });

    const { naturalWidth: w, naturalHeight: h } = img;
    if (!w || !h || w <= maxWidth) return file;

    const width = maxWidth;
    const height = Math.max(1, Math.round((h * maxWidth) / w));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, file.type, quality));
    // บาง browser encode webp ไม่ได้แล้วคืน PNG แทน — ใช้ชนิดที่ได้จริงจาก blob ไม่ใช่ที่ขอ
    if (!blob) throw new Error('Canvas encode failed');
    return new File([blob], file.name, { type: blob.type || file.type, lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(url);
  }
}
