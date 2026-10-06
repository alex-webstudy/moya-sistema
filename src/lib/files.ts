// Client-side file prep for /api/ai/dictate: screenshots are downscaled so a request stays well under hosting body limits.
export interface Prepared {
  uploads: { kind: "image" | "pdf"; media_type: string; data: string; name: string }[];
  docs: { name: string; text: string }[];
  skipped: string[];
}

const MAX_SIDE = 1600;
const MAX_PDF = 3 * 1024 * 1024;

async function imageToJpeg(f: File): Promise<string> {
  const bmp = await createImageBitmap(f);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85).split(",")[1];
}

const toBase64 = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1]);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  });

export async function prepareFiles(files: File[]): Promise<Prepared> {
  const out: Prepared = { uploads: [], docs: [], skipped: [] };
  for (const f of files.slice(0, 5)) {
    try {
      if (f.type.startsWith("image/")) out.uploads.push({ kind: "image", media_type: "image/jpeg", data: await imageToJpeg(f), name: f.name });
      else if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) {
        if (f.size > MAX_PDF) out.skipped.push(f.name + " (больше 3 МБ)");
        else out.uploads.push({ kind: "pdf", media_type: "application/pdf", data: await toBase64(f), name: f.name });
      } else out.docs.push({ name: f.name, text: (await f.text()).slice(0, 20000) });
    } catch {
      out.skipped.push(f.name);
    }
  }
  return out;
}
