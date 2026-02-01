import { uploadR2Files, type R2UploadFile } from "../r2/r2Helper";
import { createModuleLogger } from "../logger";

const logger = createModuleLogger("CaptchaUploader");

interface UploadArgs {
  captures: Record<string, string>;
  metadata: Record<string, unknown>;
  captchaProvider: string;
  captchaType: string;
  containerId: string;
}

export async function uploadCaptchaData(args: UploadArgs) {
  const { captures, metadata, captchaProvider, captchaType, containerId } = args;
  const baseDir = `captchas/${captchaProvider}/${captchaType}/${containerId}`;

  const files: R2UploadFile[] = [];

  // Add images
  for (const [name, base64] of Object.entries(captures)) {
    // Determine extension, default to png if not present in base64 prefix
    const extMatch = base64.match(/^data:image\/(\w+);base64,/);
    const ext = extMatch ? extMatch[1] : "png";
    
    // Strip prefix if exists
    const data = base64.replace(/^data:image\/\w+;base64,/, "");
    files.push({
      path: `${baseDir}/${name}.${ext}`,
      data: data
    });
  }

  // Add metadata
  files.push({
    path: `${baseDir}/data.json`,
    data: btoa(unescape(encodeURIComponent(JSON.stringify(metadata, null, 2)))) // Base64 encode JSON (UTF-8 safe)
  });

  try {
    await uploadR2Files(files);
  } catch (error) {
    logger.error("Upload failed:", error);
  }
}
