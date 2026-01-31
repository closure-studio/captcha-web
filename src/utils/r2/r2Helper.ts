// r2Helper.ts
// Utility functions for interacting with the captcha-store R2 API


import axios from 'axios';
// Use environment variable for the captcha server host
const CAPTCHA_SERVER_HOST = import.meta.env.VITE_CAPTCHA_SERVER_HOST as string;

export interface R2UploadFile {
  path: string;
  data: string; // base64 encoded
}

export interface R2UploadResult {
  path: string;
  success: boolean;
}

export interface R2UploadResponse {
  success: boolean;
  results: R2UploadResult[];
  message: string;
}

export interface R2HealthResponse {
  status: string;
  service: string;
  timestamp: string;
}

/**
 * Upload one or more files to R2 storage.
 * @param files Array of files to upload
 */
export async function uploadR2Files(files: R2UploadFile[]): Promise<R2UploadResponse> {
  const res = await axios.post(`${CAPTCHA_SERVER_HOST}/store/upload`, { files });
  return res.data;
}
