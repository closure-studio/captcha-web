import { GEETEST4_JS_URL } from "../../consts/consts";
import { GEETEST3_JS_URL } from "../../consts/consts";

/**
 * 动态加载 GeeTest v4 SDK
 */
export function loadGeeTestV4Script(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.initGeetest4 === "function") {
      resolve();
      return;
    }

    const existingScript = document.querySelector(
      `script[src="${GEETEST4_JS_URL}"]`,
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve());
      existingScript.addEventListener("error", () =>
        reject(new Error("Failed to load GeeTest v4 SDK")),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = GEETEST4_JS_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load GeeTest v4 SDK"));
    document.head.appendChild(script);
  });
}

/**
 * 动态加载 GeeTest v3 SDK
 */
export function loadGeeTestV3Script(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.initGeetest === "function") {
      resolve();
      return;
    }

    const existingScript = document.querySelector(
      `script[src="${GEETEST3_JS_URL}"]`,
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve());
      existingScript.addEventListener("error", () =>
        reject(new Error("Failed to load GeeTest v3 SDK")),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = GEETEST3_JS_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load GeeTest v3 SDK"));
    document.head.appendChild(script);
  });
}
