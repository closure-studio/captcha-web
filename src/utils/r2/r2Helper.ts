// r2Helper.ts
// Utility functions for interacting with the captcha-store R2 API


import axios from 'axios';
// Use environment variable for the captcha store API base URL
const CAPTCHA_STORE_API_BASE_URL = import.meta.env.VITE_CAPTCHA_STORE_API_BASE_URL as string;

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
 * Health check for the captcha-store service.
 */
export async function checkR2Health(): Promise<R2HealthResponse> {
  const res = await axios.get(`${CAPTCHA_STORE_API_BASE_URL}/health`);
  return res.data;
}

/**
 * Upload one or more files to R2 storage.
 * @param files Array of files to upload
 */
export async function uploadR2Files(files: R2UploadFile[]): Promise<R2UploadResponse> {
  const res = await axios.post(`${CAPTCHA_STORE_API_BASE_URL}/upload`, { files });
  return res.data;
}
