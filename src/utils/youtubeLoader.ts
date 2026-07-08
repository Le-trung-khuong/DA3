// src/utils/youtubeLoader.ts

let ytPromise: Promise<void> | null = null;
let ytResolve: (() => void) | null = null;
let ytReject: ((err: Error) => void) | null = null;

export function loadYouTubeAPI(): Promise<void> {
  if (window.YT && window.YT.Player) {
    return Promise.resolve();
  }
  if (ytPromise) {
    return ytPromise;
  }

  ytPromise = new Promise((resolve, reject) => {
    ytResolve = resolve;
    ytReject = reject;

    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    const timeout = setTimeout(() => {
      reject(new Error('YouTube API load timeout'));
    }, 15000);

    if (existingScript) {
      const check = () => {
        if (window.YT && window.YT.Player) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
      return;
    }

    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      resolve();
      ytResolve = null;
      ytReject = null;
    };

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Failed to load YouTube API script'));
      ytResolve = null;
      ytReject = null;
    };
    document.body.appendChild(script);
  });

  return ytPromise;
}